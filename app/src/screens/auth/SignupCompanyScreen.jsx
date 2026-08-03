import { useState } from 'react';
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
import { toAppError } from '../../utils/errors.js';
import { collectErrors, validateCompany, validateCountry } from '../../utils/validation.js';
import { signupDraft } from './signupDraft.js';
import { postSignupPrompt } from '../kyc/postSignupPrompt.js';

/**
 * Screen 8 · Signup step 2 — your company. Submits the whole signup.
 *
 * 🔴 Only Path B (create new) exists. The brief's Path A — "We found a company
 * registered with this email", claim vs create — has NO backend endpoint: there
 * is no organisation lookup and no claim route. It is also, as specified, an
 * account-enumeration surface, since it would confirm to an anonymous caller
 * that a company is registered to a given email. Both points are logged for the
 * owner; nothing here fakes the path.
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

  const submit = async () => {
    const found = collectErrors({
      company: validateCompany(company),
      country: validateCountry(country),
      entityType: isExporter && !entityType ? 'Choose how your business is registered.' : null,
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
        company: company.trim(),
        country: country.code,
        ...(isExporter ? { entityType, address: buildAddress() } : {}),
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
      setFormError(toAppError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NavyCanopy
      eyebrow="STEP 4 OF 4"
      title="Your company"
      subtitle="This is what buyers and suppliers will see."
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        <Button
          label="Create account"
          onPress={submit}
          loading={submitting}
          disabled={submitting}
        />
      }
    >
      <View style={styles.form}>
        <FormError error={formError} />

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

        <CountryPicker
          label="Country"
          value={country}
          onChange={onCountryChange}
          error={errors.country}
          disabled={submitting}
          required
        />

        {isExporter ? (
          <>
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
          </>
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
