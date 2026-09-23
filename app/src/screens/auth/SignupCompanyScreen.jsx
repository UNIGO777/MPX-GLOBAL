import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { CountryPicker } from '../../components/CountryPicker.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { RadioCard } from '../../components/RadioCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { colors, spacing, typography } from '../../theme/index.js';
import { ERROR_CODES, isErrorCode, toAppError } from '../../utils/errors.js';
import { collectErrors, validateCompany, validateCountry } from '../../utils/validation.js';
import { ClaimOffer } from './ClaimOffer.jsx';
import { signupDraft } from './signupDraft.js';
import { postSignupPrompt } from '../kyc/postSignupPrompt.js';

/**
 * Screen 8 · Signup step 2 — your company. Submits the whole signup.
 *
 * ⚠️ This used to say Path A (claim) "has NO backend endpoint … nothing here
 * fakes the path". That was true until D7 shipped; it is not any more. The three
 * routes exist (`/auth/signup/organisation`, `/code`, `/verify`) and this screen
 * now implements the claim, per `mobile-app.md`: EVERY rule in build-prompt
 * §A21, never a simpler version. `web/src/pages/auth/SignupCompany.jsx` +
 * `ClaimOffer.jsx` are the reference.
 *
 * The enumeration worry in the old note is answered by §A21 line 248: the offer
 * sits behind BOTH OTPs, so it is never reachable by an anonymous caller.
 *
 * Three views:
 *   checking → the offer is still loading. The create form is not shown first
 *              and then yanked away.
 *   join     → something matched and was not declined.
 *   create   → nothing matched, or "set up a separate company".
 *
 * 🔴 Entity type is two full-width cards, never a dropdown (brief rule 6): it
 * decides which KYC documents get requested later and is publicly visible.
 */
export function SignupCompanyScreen({ navigation, route }) {
  const portal = route.params?.portal ?? 'buyer';
  const isExporter = portal === 'exporter';
  const { completeSignIn } = useAuth();

  // The signup token comes from the in-memory holder, not a navigation param —
  // see signupDraft.js. It no longer carries a password: under A21 that went to
  // the server at step 1 and was hashed into the pending record there.
  const account = signupDraft.get();

  const [company, setCompany] = useState('');
  const [country, setCountry] = useState(null);
  const [entityType, setEntityType] = useState(null);
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // D7 · the claim offers. `undefined` = not asked yet, `[]` = nothing to claim.
  const [offers, setOffers] = useState(undefined);
  const [picked, setPicked] = useState(null);
  // "Set up a separate company" — kept separate from `offers` so declining does
  // not destroy what the server found (rule: that choice is always available,
  // and going back must not require restarting the signup).
  const [declined, setDeclined] = useState(false);
  const [claimNotice, setClaimNotice] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(null);

  const setAddressField = (key) => (value) => setAddress((a) => ({ ...a, [key]: value }));

  /**
   * Clear a field's error the moment it is edited.
   *
   * Found on-device (2026-08-03): after a failed submit, filling the field left
   * the red border and "Enter your company name." sitting under a field that now
   * HAD a company name. An error that contradicts what the user just typed reads
   * as the form being broken, so it has to go as soon as the input changes —
   * validation still re-runs on submit.
   */
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));
  const onCompanyChange = (value) => {
    setCompany(value);
    clearError('company');
  };
  const onCountryChange = (value) => {
    setCountry(value);
    clearError('country');
  };
  const onEntityTypeChange = (value) => {
    setEntityType(value);
    clearError('entityType');
  };

  /**
   * Ask ONCE, on mount.
   *
   * 🔴 The ref guard is load-bearing, not tidiness: a re-render that re-ran this
   * and hit a transient 500 would have its `.catch` wipe `offers`, and a person
   * genuinely entitled to join would silently get the create form instead. A
   * failure here is not fatal — it falls through to `create`, which is the
   * correct degradation, so it must not be able to happen twice.
   */
  const offerAsked = useRef(false);
  useEffect(() => {
    if (!account?.signupToken || offerAsked.current) return;
    offerAsked.current = true;
    authApi
      .signupClaimOffer({ signupToken: account.signupToken })
      .then((rows) => {
        setOffers(rows);
        // One offer is pre-picked: there is nothing to choose between.
        if (rows.length === 1) setPicked(rows[0].choice);
      })
      .catch(() => setOffers([]));
  }, [account?.signupToken]);

  // The seat went (or the company was blocked) between offer and join. Same
  // outcome as "no offer": the signup itself is intact, so they finish by
  // creating rather than starting over.
  const onSeatTaken = (message) => {
    setClaimNotice(message);
    setOffers([]);
    setPicked(null);
  };

  /** Drops empty optional fields — the server strips unknown keys but not blanks. */
  const buildAddress = () => {
    const entries = Object.entries(address)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0);
    return entries.length ? Object.fromEntries(entries) : undefined;
  };

  // The draft is gone — the user reached this screen without completing step 1
  // (a deep link, or a back-navigation after the draft was cleared). Send them
  // back rather than submitting a half-built payload.
  if (!account) {
    return (
      <NavyCanopy
        title="Let's start again"
        subtitle="We didn't get your account details."
        onBack={() => navigation.goBack()}
        footer={
          <Button
            label="Back to step 1"
            onPress={() => navigation.replace('SignupAccount', { portal })}
          />
        }
      >
        <Text style={styles.outcome}>
          For your security we don&apos;t keep signup details once you leave the flow.
        </Text>
      </NavyCanopy>
    );
  }

  /**
   * 8c · the signup token lives an hour, and chasing a colleague for the rule-6
   * code can outlast it. A dead end here would lose a verified email AND a
   * verified phone, so it hands back a way to start over deliberately.
   */
  if (sessionExpired) {
    return (
      <NavyCanopy
        title="That took a little too long"
        subtitle="Your signup session has expired."
        onBack={() => navigation.goBack()}
        footer={
          <Button
            label="Start signup again"
            onPress={() => {
              signupDraft.clear();
              navigation.replace('SignupAccount', { portal });
            }}
          />
        }
      >
        <Text style={styles.outcome}>{sessionExpired}</Text>
      </NavyCanopy>
    );
  }

  const submit = async ({ claim = null } = {}) => {
    /**
     * On a CLAIM the company name and country belong to the organisation being
     * joined, so they are not asked for and not validated. Entity type still is,
     * but only when the server says this offer `needs` it — an exporter joining
     * a company that already has one must not be made to re-state it.
     */
    const found = collectErrors({
      company: claim ? null : validateCompany(company),
      country: claim ? null : validateCountry(country),
      entityType:
        (claim ? claim.needs?.includes('entityType') : isExporter) && !entityType
          ? 'Choose how your business is registered.'
          : null,
    });

    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      // The FIRST call that creates anything. The server refuses it unless both
      // the email and the mobile were verified, and it returns a real session —
      // both factors were just proved, so there is no third code to enter.
      const result = await authApi.signupComplete({
        signupToken: account.signupToken,
        // Sent on a claim too, and IGNORED there — the joined organisation's own
        // values win. The server re-resolves everything from the stored offer.
        company: claim ? (claim.name ?? '-') : company.trim(),
        country: claim ? (claim.country ?? 'IN') : country.code,
        ...(isExporter ? { entityType, address: buildAddress() } : {}),
        // 🔴 The OPAQUE choice, never an org id.
        ...(claim ? { claimChoice: claim.choice } : {}),
      });

      // The token has been spent; nothing about the signup should outlive it.
      signupDraft.clear();

      // Ask the signed-in shell to show the verification nudge ONCE. It cannot
      // be a navigate() from here: completeSignIn swaps the whole navigator and
      // unmounts this screen.
      postSignupPrompt.arm();

      // AuthContext flips isAuthenticated and RootNavigator takes over.
      await completeSignIn(result);
    } catch (error) {
      // The seat went between offer and join: drop to the create form with the
      // reason shown, rather than a dead end on an otherwise valid signup.
      if (claim && isErrorCode(error, ERROR_CODES.CLAIM_SEAT_TAKEN)) {
        onSeatTaken(toAppError(error).message);
        return;
      }
      if (isErrorCode(error, ERROR_CODES.SIGNUP_SESSION_EXPIRED)) {
        setSessionExpired(toAppError(error).message);
        return;
      }
      setFormError(toAppError(error));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * checking → the offer is still loading. Deliberately NOT the create form:
   *            showing it and then yanking it away is worse than a short wait.
   * join     → something matched and was not declined.
   * create   → nothing matched, or "set up a separate company".
   */
  const view = offers === undefined ? 'checking' : offers.length > 0 && !declined ? 'join' : 'create';
  const current = offers?.find((o) => o.choice === picked) ?? null;
  /**
   * Seller details are asked for ONLY when the server says this offer `needs`
   * them, and only after the rule-6 code has cleared — before that the offer is
   * still masked and we do not even know what it needs.
   */
  const joinNeeds = current && !current.needsOrgEmailOtp ? (current.needs ?? []) : [];
  const canJoin = Boolean(current) && !current.needsOrgEmailOtp;
  const wantsEntity = (view === 'create' && isExporter) || joinNeeds.includes('entityType');
  const wantsAddress = (view === 'create' && isExporter) || joinNeeds.includes('address');
  return (
    <NavyCanopy
      eyebrow="STEP 4 OF 4"
      title="Your company"
      subtitle="This is what buyers and suppliers will see."
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        view === 'join' ? (
          <View style={styles.joinActions}>
            <Button
              label={current?.name ? `Join ${current.name}` : 'Join this company'}
              onPress={() => submit({ claim: current })}
              loading={submitting}
              // Blocked until the rule-6 code clears: the server would refuse it
              // anyway, and an enabled button that always fails is worse.
              disabled={submitting || !canJoin}
            />
            {/* Always available — a person must never be trapped into joining. */}
            <Button
              label="Set up a separate company"
              variant="ghost"
              onPress={() => {
                setDeclined(true);
                setFormError(null);
              }}
              disabled={submitting}
            />
          </View>
        ) : (
          <Button
            label="Create account"
            onPress={() => submit()}
            loading={submitting}
            disabled={submitting || view === 'checking'}
          />
        )
      }
    >
      <View style={styles.form}>
        <FormError error={formError} />

        {/* Why the create form appeared when a company was expected (seat gone,
            company blocked). Stated, never silently swapped. */}
        {claimNotice ? <Text style={styles.notice}>{claimNotice}</Text> : null}

        {view === 'checking' ? (
          <Text style={styles.outcome}>Checking whether your company is already on MPX…</Text>
        ) : null}

        {view === 'join' ? (
          <ClaimOffer
            signupToken={account.signupToken}
            offers={offers}
            picked={picked}
            onPick={setPicked}
            // The verify call returns the offers again, now carrying the name
            // and with `needsOrgEmailOtp` cleared.
            onOffersChange={setOffers}
            onSeatTaken={onSeatTaken}
            onSessionExpired={setSessionExpired}
          />
        ) : null}

        {view === 'create' ? (
        <Input
          label="Company name"
          leftIcon="business-outline"
          value={company}
          onChangeText={onCompanyChange}
          placeholder="Registered business name"
          error={errors.company}
          autoCapitalize="words"
          editable={!submitting}
          required
        />

        ) : null}

        {view === 'create' ? (
        <CountryPicker
          label="Country"
          value={country}
          onChange={onCountryChange}
          error={errors.country}
          disabled={submitting}
          required
        />
        ) : null}

        {/* Asked when CREATING as an exporter, and on a JOIN only when the
            server says this offer needs it. */}
        {wantsEntity ? (
            <View style={styles.block}>
              <Text style={styles.label}>
                How is your business registered?<Text style={styles.required}> *</Text>
              </Text>
              <Text style={styles.help}>
                This decides which documents we ask for during verification, and it appears on your
                public profile.
              </Text>

              <View style={styles.cards} accessibilityRole="radiogroup">
                <RadioCard
                  icon="business-outline"
                  title="Business"
                  description="A registered company, firm or LLP"
                  selected={entityType === 'business'}
                  onPress={() => onEntityTypeChange('business')}
                  disabled={submitting}
                />
                <RadioCard
                  icon="person-outline"
                  title="Individual"
                  description="A sole proprietor trading in your own name"
                  selected={entityType === 'individual'}
                  onPress={() => onEntityTypeChange('individual')}
                  disabled={submitting}
                />
              </View>

              {errors.entityType ? <Text style={styles.errorText}>{errors.entityType}</Text> : null}
            </View>
        ) : null}

        {wantsAddress ? (
            <View style={styles.block}>
              <Text style={styles.label}>Business address</Text>
              <Text style={styles.help}>Optional — you can add this later.</Text>

              <View style={styles.addressFields}>
                <Input
                  label="Address line 1"
                  value={address.line1}
                  onChangeText={setAddressField('line1')}
                  editable={!submitting}
                />
                <Input
                  label="Address line 2"
                  value={address.line2}
                  onChangeText={setAddressField('line2')}
                  editable={!submitting}
                />
                <View style={styles.row}>
                  <Input
                    label="City"
                    value={address.city}
                    onChangeText={setAddressField('city')}
                    editable={!submitting}
                    style={styles.rowItem}
                  />
                  <Input
                    label="State"
                    value={address.state}
                    onChangeText={setAddressField('state')}
                    editable={!submitting}
                    style={styles.rowItem}
                  />
                </View>
                <Input
                  label="Postal code"
                  value={address.postalCode}
                  onChangeText={setAddressField('postalCode')}
                  keyboardType="number-pad"
                  editable={!submitting}
                />
              </View>
            </View>
        ) : null}

        {/* Brief rule 7 — set the expectation before they submit, not after.
            A buyer is active immediately; an exporter is public immediately,
            just without the tick. Neither is "awaiting approval". */}
        <Text style={styles.outcome}>
          {isExporter
            ? 'Your profile goes live straight away. A verified tick is added once our team reviews your documents.'
            : 'Your account is active as soon as you verify your code — there is nothing to wait for.'}
        </Text>
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  // The two actions in the join footer: joining is primary, "separate company"
  // sits under it and is always reachable.
  joinActions: { gap: spacing[2] },
  notice: {
    ...typography.caption,
    color: colors.ink[700],
    // Neutral, not the warning tint: `colors.warning` is a FLAT string in the
    // app (the web scale was never mirrored), so `warning[50]` is undefined.
    backgroundColor: colors.surface.subtle,
    borderRadius: 12,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  form: { gap: spacing[4] },
  block: { gap: spacing[2] },
  label: { ...typography.label, color: colors.ink[700] },
  required: { color: colors.danger.DEFAULT },
  help: { ...typography.caption, color: colors.muted },
  cards: { gap: spacing[3], marginTop: spacing[1] },
  errorText: { ...typography.caption, color: colors.danger.DEFAULT },
  addressFields: { gap: spacing[3], marginTop: spacing[1] },
  row: { flexDirection: 'row', gap: spacing[3] },
  rowItem: { flex: 1 },
  outcome: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing[2],
  },
});
