import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { organisationApi, DESCRIPTION_MAX } from '../../api/organisation.js';
import { Badge, VerifiedBadge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { CountryPicker } from '../../components/CountryPicker.jsx';
import { ErrorState, Spinner } from '../../components/Feedback.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { RadioCard } from '../../components/RadioCard.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { findCountry } from '../../constants/countries.js';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { KYC_STATUS_CHIP } from '../../utils/kycStatus.js';

/**
 * §A22 · Company profile — one screen, two lives.
 *
 * UNVERIFIED (the majority case): a completely ordinary editable form. No
 * locks, no warnings, nothing to explain.
 *
 * VERIFIED: the legal-identity fields (name · country · address · buyer's
 * entityType) become locked rows, and editing one is the three-beat consent
 * flow: locked → consequence sheet → unlocked-with-warning → "Save and
 * re-submit for review". Unlocking is FREE — only saving a changed locked
 * field demotes, and leaving the screen silently re-locks.
 *
 * Exporter extras: the storefront section (logo + description — always
 * editable, saved WITHOUT consequence) and the public-page preview, which
 * mirrors the live public projection and never shows a status.
 *
 * 🔴 The server is the enforcement: it decides demotion and audits it. This
 * screen's job is consent and feedback, never the rule itself.
 */

const ADDRESS_KEYS = ['line1', 'line2', 'city', 'state', 'postalCode'];

const LOCK_COPY = {
  name: {
    label: 'company name',
    body: 'Changing your company name removes your verified tick until our team reviews it again. Your account keeps working normally.',
  },
  country: {
    label: 'country of registration',
    body: 'Changing your country of registration removes your verified tick until our team reviews it again. Your account keeps working normally.',
  },
  address: {
    label: 'registered address',
    body: 'Changing your registered address removes your verified tick until our team reviews it again. Your account keeps working normally.',
  },
  entityType: {
    label: 'entity type',
    body: 'Changing your entity type removes your verified tick until our team reviews it again, and changes which documents we ask for. Your account keeps working normally.',
  },
};

const emptyAddress = () => ({ line1: '', line2: '', city: '', state: '', postalCode: '' });

const formFromOrg = (org) => ({
  name: org.name ?? '',
  country: findCountry(org.country) ?? (org.country ? { code: org.country, name: org.country } : null),
  entityType: org.entityType ?? null,
  description: org.description ?? '',
  address: { ...emptyAddress(), ...org.address },
});

const addressText = (a) =>
  [a.line1, a.line2, [a.city, a.postalCode].filter(Boolean).join(' '), a.state]
    .filter(Boolean)
    .join('\n');

export function CompanyProfileScreen({ navigation }) {
  const { role } = useAuth();
  const isExporter = role === 'exporter';
  const toast = useToast();

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null);
  const [unlocked, setUnlocked] = useState(() => new Set());
  const [sheetFor, setSheetFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const descriptionRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await organisationApi.mine();
      setOrg(data);
      setForm(formFromOrg(data));
      setUnlocked(new Set());
    } catch (err) {
      setLoadError(toAppError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const verified = org?.kycStatus === 'verified';

  // --- dirty tracking ---------------------------------------------------------
  const changedLocked = useMemo(() => {
    if (!org || !form) return [];
    const out = [];
    if (form.name.trim() !== (org.name ?? '')) out.push('name');
    if ((form.country?.code ?? '') !== (org.country ?? '')) out.push('country');
    if ((form.entityType ?? '') !== (org.entityType ?? '')) out.push('entityType');
    if (ADDRESS_KEYS.some((k) => (form.address[k] ?? '').trim() !== (org.address?.[k] ?? ''))) {
      out.push('address');
    }
    return out;
  }, [org, form]);

  const storefrontDirty =
    isExporter && org && form ? form.description.trim() !== (org.description ?? '') : false;
  const dirty = changedLocked.length > 0 || storefrontDirty;

  // Leaving with unsaved edits: confirm. Leaving with only an unlocked-but-
  // unchanged field: free — the unlock itself never cost anything.
  useEffect(() => {
    if (!dirty || saving) return undefined;
    const sub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert('Discard changes?', "Your edits haven't been saved.", [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return sub;
  }, [navigation, dirty, saving]);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setAddressField = (key) => (value) =>
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));

  const isLocked = (field) => verified && !unlocked.has(field);
  const requestUnlock = (field) => setSheetFor(field);
  const confirmUnlock = () => {
    setUnlocked((s) => new Set(s).add(sheetFor));
    setSheetFor(null);
  };

  // --- save -------------------------------------------------------------------
  const saveLabel =
    verified && changedLocked.length > 0 ? 'Save and re-submit for review' : 'Save';

  const save = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError({ message: 'Company name is required.' });
      return;
    }
    if (!form.country?.code) {
      setFormError({ message: 'Select your country of registration.' });
      return;
    }

    const patch = {};
    if (changedLocked.includes('name')) patch.name = form.name.trim();
    if (changedLocked.includes('country')) patch.country = form.country.code;
    if (changedLocked.includes('entityType')) patch.entityType = form.entityType;
    if (changedLocked.includes('address')) {
      patch.address = Object.fromEntries(
        ADDRESS_KEYS.map((k) => [k, (form.address[k] ?? '').trim()]),
      );
    }
    if (storefrontDirty) patch.description = form.description.trim();

    setSaving(true);
    try {
      const { organisation, demoted } = await organisationApi.update(patch);
      setOrg(organisation);
      setForm(formFromOrg(organisation));
      setUnlocked(new Set());
      toast.show(
        demoted
          ? 'Saved. Your verified tick returns after our team re-reviews your details.'
          : 'Saved.',
        { tone: demoted ? 'neutral' : 'success' },
      );
    } catch (err) {
      setFormError(toAppError(err));
    } finally {
      setSaving(false);
    }
  };

  // --- logo (exporter storefront — uploads immediately, never demotes) --------
  const pickLogo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (!a) return;

    setLogoBusy(true);
    setFormError(null);
    try {
      const organisation = await organisationApi.uploadLogo({
        uri: a.uri,
        name: a.fileName ?? 'logo.jpg',
        mimeType: a.mimeType ?? 'image/jpeg',
      });
      setOrg(organisation);
      toast.show('Logo updated.', { tone: 'success' });
    } catch (err) {
      setFormError(toAppError(err));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = () => {
    Alert.alert('Remove logo?', 'Your public page will show no logo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setLogoBusy(true);
          try {
            setOrg(await organisationApi.removeLogo());
          } catch (err) {
            setFormError(toAppError(err));
          } finally {
            setLogoBusy(false);
          }
        },
      },
    ]);
  };

  // --- render -----------------------------------------------------------------
  if (loading || (!org && !loadError)) {
    return (
      <NavyCanopy title="Company profile" onBack={() => navigation.goBack()}>
        <Spinner label="Loading your company…" />
      </NavyCanopy>
    );
  }
  if (loadError) {
    return (
      <NavyCanopy title="Company profile" onBack={() => navigation.goBack()}>
        <ErrorState error={loadError} onRetry={load} />
      </NavyCanopy>
    );
  }

  const chip = KYC_STATUS_CHIP[org.kycStatus];
  const showUnlockWarning = verified && unlocked.size > 0;

  return (
    <NavyCanopy
      title="Company profile"
      subtitle={isExporter ? 'Your storefront and legal identity.' : 'Manage your company details.'}
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        <Button label={saveLabel} onPress={save} loading={saving} disabled={!dirty || saving} />
      }
    >
      <View style={styles.body}>
        {/* Status: the tick, or the owner-only state chip. Never both. */}
        <View style={styles.statusRow}>
          {verified ? <VerifiedBadge verified /> : chip ? <Badge tone={chip.tone} label={chip.label} /> : null}
        </View>

        <FormError error={formError} />

        {showUnlockWarning ? (
          <View style={styles.warnBanner} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color={'#93370D'} accessible={false} />
            <Text style={styles.warnText}>
              You&apos;re editing verified details. Saving removes your verified tick until
              re-review.
            </Text>
          </View>
        ) : null}

        {isExporter ? (
          <>
            <SectionHeader title="Your storefront" note="Shown to buyers. Saves without review." />

            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                {logoBusy ? (
                  <ActivityIndicator color={colors.primary[600]} />
                ) : org.logo ? (
                  <Image source={{ uri: org.logo }} style={styles.logoImg} />
                ) : (
                  <Ionicons name="image-outline" size={26} color={colors.primary[400]} />
                )}
              </View>
              <View style={styles.logoActions}>
                <Button
                  label={org.logo ? 'Replace' : 'Add logo'}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={pickLogo}
                  disabled={logoBusy}
                />
                {org.logo ? (
                  <Pressable onPress={removeLogo} hitSlop={8} accessibilityRole="button" disabled={logoBusy}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.logoHint}>Square works best. JPG, PNG or WEBP, max 5 MB.</Text>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Company description</Text>
              <TextInput
                ref={descriptionRef}
                value={form.description}
                onChangeText={setField('description')}
                placeholder="What do you export, and for whom?"
                placeholderTextColor={colors.ink[400]}
                multiline
                maxLength={DESCRIPTION_MAX}
                editable={!saving}
                style={styles.textarea}
                accessibilityLabel="Company description"
              />
              <Text style={styles.counter}>
                {form.description.length}/{DESCRIPTION_MAX}
              </Text>
            </View>

            <PreviewCard
              org={org}
              draftDescription={form.description}
              open={previewOpen}
              onToggle={() => setPreviewOpen((v) => !v)}
              onInvite={() => descriptionRef.current?.focus()}
            />

            <SectionHeader
              title="Legal identity"
              note={verified ? 'These details match your verified documents.' : undefined}
            />
          </>
        ) : (
          <SectionHeader title="Entity type" />
        )}

        {/* Buyer entityType: a real choice until verified, then locked. */}
        {!isExporter &&
          (isLocked('entityType') ? (
            <LockedRow
              label="Entity type"
              value={form.entityType === 'business' ? 'Business' : form.entityType === 'individual' ? 'Individual' : 'Not set'}
              onChange={() => requestUnlock('entityType')}
            />
          ) : (
            <View style={styles.cards}>
              <RadioCard
                icon="business-outline"
                title="Business"
                description="A registered company, firm or LLP"
                selected={form.entityType === 'business'}
                onPress={() => setField('entityType')('business')}
                disabled={saving}
              />
              <RadioCard
                icon="person-outline"
                title="Individual"
                description="A sole proprietor trading in your own name"
                selected={form.entityType === 'individual'}
                onPress={() => setField('entityType')('individual')}
                disabled={saving}
              />
            </View>
          ))}

        {!isExporter ? <SectionHeader title="Company details" /> : null}

        {isLocked('name') ? (
          <LockedRow label="Company name" value={org.name} onChange={() => requestUnlock('name')} />
        ) : (
          <Input
            label="Company name"
            value={form.name}
            onChangeText={setField('name')}
            placeholder="Full legal company name"
            editable={!saving}
            required
          />
        )}

        {isLocked('country') ? (
          <LockedRow
            label="Country of registration"
            value={form.country?.name ?? org.country ?? '—'}
            onChange={() => requestUnlock('country')}
          />
        ) : (
          <CountryPicker
            label="Country of registration"
            value={form.country}
            onChange={setField('country')}
            disabled={saving}
            required
          />
        )}

        <SectionHeader title="Registered address" note={!verified ? 'Optional — used for verification.' : undefined} />

        {isLocked('address') ? (
          <LockedRow
            label="Registered address"
            value={addressText(form.address) || 'Not provided'}
            onChange={() => requestUnlock('address')}
          />
        ) : (
          <View style={styles.addressFields}>
            <Input label="Address line 1" value={form.address.line1} onChangeText={setAddressField('line1')} editable={!saving} />
            <Input label="Address line 2" value={form.address.line2} onChangeText={setAddressField('line2')} editable={!saving} />
            <View style={styles.row}>
              <Input label="City" value={form.address.city} onChangeText={setAddressField('city')} editable={!saving} style={styles.rowItem} />
              <Input label="State" value={form.address.state} onChangeText={setAddressField('state')} editable={!saving} style={styles.rowItem} />
            </View>
            <Input
              label="Postal code"
              value={form.address.postalCode}
              onChangeText={setAddressField('postalCode')}
              keyboardType="number-pad"
              editable={!saving}
            />
          </View>
        )}

        {isExporter ? (
          <>
            <SectionHeader title="Account" />
            <View style={styles.readonlyRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Entity type</Text>
                <Text style={styles.readonlyValue}>
                  {org.entityType === 'business' ? 'Business' : 'Individual'}
                </Text>
                <Text style={styles.readonlyHint}>Set at signup — it decides which documents we verify.</Text>
              </View>
              <Ionicons name="information-circle-outline" size={20} color={colors.ink[400]} accessible={false} />
            </View>
          </>
        ) : null}
      </View>

      <ConsequenceSheet
        field={sheetFor}
        isExporter={isExporter}
        onConfirm={confirmUnlock}
        onCancel={() => setSheetFor(null)}
      />
    </NavyCanopy>
  );
}

// --- pieces --------------------------------------------------------------------

function SectionHeader({ title, note }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

/** The locked life of a field: calm, neutral, one quiet way out. */
function LockedRow({ label, value, onChange }) {
  return (
    <View style={styles.lockedRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.lockedValueRow}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.ink[500]} accessible={false} />
        <Text style={styles.lockedValue}>{value}</Text>
      </View>
      <Text style={styles.lockedReason}>Locked because your company is verified.</Text>
      <Pressable onPress={onChange} hitSlop={8} accessibilityRole="button">
        <Text style={styles.changeLink}>Need to change this?</Text>
      </Pressable>
    </View>
  );
}

/** Beat two of the consent flow — the consequence, before anything unlocks. */
function ConsequenceSheet({ field, isExporter, onConfirm, onCancel }) {
  if (!field) return null;
  const copy = LOCK_COPY[field];
  const body =
    field === 'name' && isExporter ? `${copy.body} Your public web address stays the same.` : copy.body;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Cancel" />
      <View style={styles.sheet}>
        <View style={styles.sheetIcon}>
          <Ionicons name="warning-outline" size={26} color={colors.warning} accessible={false} />
        </View>
        <Text style={styles.sheetTitle}>Change {copy.label}?</Text>
        <Text style={styles.sheetBody}>{body}</Text>
        <Button label="Confirm and unlock" variant="danger" onPress={onConfirm} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </Modal>
  );
}

/**
 * The public page as buyers see it — rendered ONLY from fields the live public
 * projection carries. No status, no rejection reason, no street address.
 */
function PreviewCard({ org, draftDescription, open, onToggle, onInvite }) {
  const description = draftDescription.trim() || org.description || '';
  const empty = !org.logo && !description;
  const countryName = findCountry(org.country)?.name ?? org.country ?? '';
  const verified = org.kycStatus === 'verified';

  return (
    <View style={styles.preview}>
      <Pressable onPress={onToggle} accessibilityRole="button" style={styles.previewHead}>
        <Ionicons name="eye-outline" size={18} color={colors.primary[700]} accessible={false} />
        <Text style={styles.previewHeadText}>How buyers see you</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.ink[500]} />
      </Pressable>

      {open ? (
        empty ? (
          <View style={styles.previewEmpty}>
            <Text style={styles.previewEmptyTitle}>Your page is looking bare</Text>
            <Text style={styles.previewEmptyText}>
              Buyers see this page. A logo and a few lines about what you export help them choose
              you.
            </Text>
            <Button label="Add a description" variant="ghost" fullWidth={false} onPress={onInvite} />
          </View>
        ) : (
          <View style={styles.previewPage}>
            <View style={styles.previewIdentity}>
              {org.logo ? (
                <Image source={{ uri: org.logo }} style={styles.previewLogo} />
              ) : (
                <View style={[styles.previewLogo, styles.previewLogoEmpty]}>
                  <Ionicons name="image-outline" size={18} color={colors.ink[400]} />
                </View>
              )}
              <View style={styles.flex}>
                <View style={styles.previewNameRow}>
                  <Text style={styles.previewName} numberOfLines={2}>
                    {org.name}
                  </Text>
                  <VerifiedBadge verified={verified} />
                </View>
                <View style={styles.previewMetaRow}>
                  <Text style={styles.previewMeta}>{countryName}</Text>
                  {org.entityType ? (
                    <Badge tone="info" label={org.entityType === 'business' ? 'Business' : 'Individual'} />
                  ) : null}
                </View>
              </View>
            </View>
            {description ? <Text style={styles.previewDesc}>{description}</Text> : null}
            {org.slug ? <Text style={styles.previewUrl}>mpx.global/supplier/{org.slug}</Text> : null}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  flex: { flex: 1 },
  statusRow: { flexDirection: 'row' },

  section: { marginTop: spacing[2], gap: 2 },
  sectionTitle: { ...typography.h3, color: colors.ink[900] },
  sectionNote: { ...typography.caption, color: colors.muted },

  label: { ...typography.label, color: colors.ink[700], marginBottom: spacing[1] },
  cards: { gap: spacing[3] },

  warnBanner: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
    backgroundColor: '#FEF0DC',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing[3],
  },
  warnText: { ...typography.caption, color: '#93370D', flex: 1 },

  // storefront
  logoRow: { flexDirection: 'row', gap: spacing[4], alignItems: 'flex-start' },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 72, height: 72 },
  logoActions: { flex: 1, gap: spacing[2], alignItems: 'flex-start' },
  removeLink: { ...typography.label, color: colors.danger.DEFAULT },
  logoHint: { ...typography.tiny, color: colors.muted },

  textarea: {
    ...typography.body,
    minHeight: 110,
    textAlignVertical: 'top',
    color: colors.ink[900],
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    padding: spacing[3],
  },
  counter: { ...typography.tiny, color: colors.muted, alignSelf: 'flex-end', marginTop: spacing[1] },

  // locked row
  lockedRow: {
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    padding: spacing[3],
    gap: spacing[1],
  },
  lockedValueRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  lockedValue: { ...typography.body, color: colors.ink[900], flex: 1 },
  lockedReason: { ...typography.tiny, color: colors.muted },
  changeLink: { ...typography.label, color: colors.primary[600], marginTop: spacing[1] },

  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    padding: spacing[3],
  },
  readonlyValue: { ...typography.body, color: colors.ink[900] },
  readonlyHint: { ...typography.tiny, color: colors.muted, marginTop: 2 },

  addressFields: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3] },
  rowItem: { flex: 1 },

  // consequence sheet
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing[5],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  sheetIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: '#FEF0DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { ...typography.h2, color: colors.ink[900], textAlign: 'center' },
  sheetBody: { ...typography.body, color: colors.ink[700], textAlign: 'center', marginBottom: spacing[2] },

  // preview
  preview: {
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
  },
  previewHeadText: { ...typography.label, color: colors.primary[700], flex: 1 },
  previewEmpty: { padding: spacing[4], paddingTop: 0, gap: spacing[2], alignItems: 'flex-start' },
  previewEmptyTitle: { ...typography.bodyStrong, color: colors.ink[900] },
  previewEmptyText: { ...typography.caption, color: colors.muted },
  previewPage: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    padding: spacing[4],
    gap: spacing[3],
  },
  previewIdentity: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  previewLogo: { width: 48, height: 48, borderRadius: radii.md },
  previewLogoEmpty: {
    backgroundColor: colors.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  previewName: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },
  previewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  previewMeta: { ...typography.caption, color: colors.muted },
  previewDesc: { ...typography.body, color: colors.ink[700] },
  previewUrl: { ...typography.tiny, color: colors.muted },
});
