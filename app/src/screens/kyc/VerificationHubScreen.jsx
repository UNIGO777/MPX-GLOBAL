import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { kycApi, DOC_TYPE_LABEL, KYC_DOC_TYPES, KYC_MAX_DOCS } from '../../api/kyc.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { KYC_STATE_TITLE as TITLES, KYC_STATE_SUBTITLE as SUBTITLES } from '../../utils/verificationCopy.js';

/**
 * Verification hub — renders all four `kycStatus` states from one call.
 *
 * 🔴 Verification is NOT a gate and no copy here may suggest otherwise. A buyer
 * is fully active from signup and a buyer's KYC is genuinely optional (D3); an
 * exporter's profile is public from signup. So there is no "unlock full access",
 * no locked steps, no progress meter, and no "activate your account".
 *
 * The ONE real consequence is the exporter's 3-active / 10-draft listing cap
 * (D1) — that is what exporter copy leads with, because it is true. A buyer has
 * no limits at all, so their pitch is trust and nothing more.
 *
 * ⚠️ Documents render from METADATA ONLY (`docType`, `uploadedAt`, `verifiedAt`).
 * The API deliberately never returns the file, a thumbnail, a filename or a
 * size — KYC assets are private. Do not add a preview here; there is nothing to
 * preview with.
 */
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function VerificationHubScreen({ navigation }) {
  const { user } = useAuth();
  const isExporter = user?.role === 'exporter';

  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await kycApi.getVerification();
      setState({ loading: false, error: null, data });
    } catch (error) {
      setState({ loading: false, error: toAppError(error), data: null });
    }
  }, []);

  // Refetch on focus: the user comes back here right after an upload, and a
  // stale "nothing submitted" would contradict what they just did.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const v = state.data;
  const status = v?.kycStatus ?? 'pending';
  const documents = v?.documents ?? [];

  /**
   * Is there anything left worth adding?
   *
   * `other` is excluded from the check on purpose: it is a catch-all with no
   * natural end, so waiting for one would leave the button up forever even after
   * every named document is in. Once each NAMED type for this entity has an
   * upload, there is nothing more to ask for.
   *
   * The 20-document cap is the other way this ends — the server refuses beyond
   * it, so offering the button there would just walk the user into a 409.
   */
  const namedTypes = (KYC_DOC_TYPES[v?.entityType] ?? [])
    .map((d) => d.value)
    .filter((t) => t !== 'other');
  const uploadedTypes = new Set(documents.map((d) => d.docType));
  const allDocsIn = namedTypes.length > 0 && namedTypes.every((t) => uploadedTypes.has(t));
  const atDocCap = documents.length >= KYC_MAX_DOCS;
  const canAddMore = !allDocsIn && !atDocCap;

  // A22 gate (owner, 2026-08-05): documents are checked against the profile, so
  // name/country/address must be complete before an upload is offered. The
  // server refuses regardless (PROFILE_INCOMPLETE) — this routing is the UX.
  const profileIncomplete = v ? v.profileComplete === false : false;

  const startFlow = () => {
    if (profileIncomplete) {
      navigation.navigate('CompanyProfile');
      return;
    }
    // Entity type is asked ONCE. An exporter chose it at signup, so they skip
    // straight to picking a document; a buyer has none and the upload would be
    // refused without it.
    navigation.navigate(v?.entityType ? 'KycDocumentType' : 'KycEntityType');
  };

  return (
    <NavyCanopy
      eyebrow="VERIFICATION"
      title={TITLES[status]}
      subtitle={SUBTITLES[status]}
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        // Verified → nothing to do. Submitted with every named document already
        // in (or at the 20 cap) → also nothing to do, so no button at all rather
        // than one that leads to an empty list or a 409.
        // Rejected always keeps its button: the whole point is to send a fix.
        status === 'verified' || (status === 'submitted' && !canAddMore) ? null : (
          <Button
            // "Start verification" is only true BEFORE anything is sent. Once a
            // document is in, review has already started — saying "start" there
            // reads as though the upload did not register.
            label={profileIncomplete ? 'Complete company profile' : FOOTER_LABEL[status]}
            // Submitted: adding more is allowed and sometimes helps, but nothing
            // is required, so it must not look like an outstanding task.
            variant={status === 'submitted' ? 'secondary' : 'primary'}
            onPress={startFlow}
            disabled={state.loading}
          />
        )
      }
    >
      {state.loading && !v ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.primary[600]} />
        </View>
      ) : state.error ? (
        <View style={styles.block}>
          <FormError error={state.error} />
          <Button label="Try again" variant="secondary" onPress={load} />
        </View>
      ) : (
        <View style={styles.block}>
          {/* A22 gate: say WHY the button leads to the profile, or it reads as
              a wrong turn. Shown only while something is actually missing. */}
          {profileIncomplete ? (
            <View style={styles.gateNote}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary[700]} />
              <Text style={styles.gateNoteText}>
                We check your documents against your company profile — complete your company
                details and registered address first.
              </Text>
            </View>
          ) : null}

          {/* Rejected: the reason first, because it is the only thing that
              matters. Framed as "one more thing needed", never as a failure. */}
          {status === 'rejected' && v.kycRejectionReason ? (
            <View style={styles.reasonCard}>
              <View style={styles.reasonHead}>
                <Ionicons name="alert-circle" size={20} color={colors.danger.DEFAULT} />
                <Text style={styles.reasonTitle}>What we need changed</Text>
              </View>
              <Text style={styles.reasonBody}>{v.kycRejectionReason}</Text>
            </View>
          ) : null}

          {status === 'verified' ? (
            <View style={styles.verifiedCard}>
              <Ionicons name="shield-checkmark" size={28} color={colors.success} />
              <Text style={styles.verifiedTitle}>Your company is verified</Text>
              <Text style={styles.verifiedBody}>
                Verified on {fmtDate(v.verifiedAt)}. The tick now shows on your public profile.
              </Text>
            </View>
          ) : (
            <View style={styles.whyCard}>
              <Text style={styles.whyTitle}>Why verify?</Text>
              <Text style={styles.whyBody}>
                {isExporter
                  ? 'You can list 3 products while unverified. Verifying lifts that limit and adds the tick buyers filter for.'
                  : 'Verifying adds the tick to your company. Suppliers tend to reply faster to verified buyers.'}
              </Text>
              {/* Said plainly so nobody reads this screen as a blocker. */}
              <Text style={styles.whyNote}>
                {isExporter
                  ? 'Your profile is already public — verification is not needed to be found.'
                  : 'Your account already works in full. This is optional.'}
              </Text>
            </View>
          )}

          {status === 'submitted' ? (
            <View style={styles.reviewCard}>
              <Ionicons name="time-outline" size={20} color={colors.warning} />
              <View style={styles.flex1}>
                <Text style={styles.reviewTitle}>In review — nothing to do</Text>
                <Text style={styles.reviewBody}>
                  {/* No ETA anywhere — we genuinely do not have one, and inventing
                      one is a promise the product cannot keep. What we CAN say is
                      that the wait is ours, not theirs. */}
                  Sent {fmtDate(v.kycSubmittedAt)}.{' '}
                  {allDocsIn
                    ? 'Everything we need is in. '
                    : ''}
                  Our team is checking your documents — this page updates on its own, and
                  we&apos;ll only ask for more if something is missing.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.docsBlock}>
            <Text style={styles.sectionTitle}>Documents</Text>
            {documents.length === 0 ? (
              <Text style={styles.empty}>Nothing uploaded yet.</Text>
            ) : (
              documents.map((d, i) => (
                <View key={`${d.docType}-${d.uploadedAt}-${i}`} style={styles.docRow}>
                  <Ionicons
                    name={d.verifiedAt ? 'checkmark-circle' : 'document-text-outline'}
                    size={20}
                    color={d.verifiedAt ? colors.success : colors.muted}
                  />
                  <View style={styles.flex1}>
                    <Text style={styles.docName}>{DOC_TYPE_LABEL[d.docType] ?? d.docType}</Text>
                    <Text style={styles.docMeta}>
                      {d.verifiedAt ? 'Verified' : 'Uploaded'} {fmtDate(d.verifiedAt ?? d.uploadedAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </NavyCanopy>
  );
}

/**
 * The footer action per state. `submitted` deliberately does NOT offer to
 * "start" anything — review is already running — and it does not imply the user
 * still owes us something; adding another document is optional.
 */
const FOOTER_LABEL = {
  pending: 'Start verification',
  submitted: 'Upload another document',
  rejected: 'Fix and resubmit',
};

const styles = StyleSheet.create({
  gateNote: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
    backgroundColor: colors.primary[50],
    borderRadius: radii.md,
    padding: spacing[3],
  },
  gateNoteText: { ...typography.caption, color: colors.primary[800], flex: 1 },
  centre: { paddingVertical: spacing[10], alignItems: 'center' },
  block: { gap: spacing[4] },
  flex1: { flex: 1 },

  whyCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing[4],
    gap: spacing[2],
  },
  whyTitle: { ...typography.label, color: colors.ink[900] },
  whyBody: { ...typography.body, color: colors.ink[700] },
  whyNote: { ...typography.caption, color: colors.muted },

  reasonCard: {
    backgroundColor: '#FEECEA',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.danger.DEFAULT,
    padding: spacing[4],
    gap: spacing[2],
  },
  reasonHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  reasonTitle: { ...typography.label, color: colors.danger.DEFAULT },
  reasonBody: { ...typography.body, color: colors.ink[900] },

  reviewCard: {
    flexDirection: 'row',
    gap: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing[4],
  },
  reviewTitle: { ...typography.label, color: colors.ink[900] },
  reviewBody: { ...typography.caption, color: colors.muted, marginTop: spacing[1] },

  verifiedCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[2],
  },
  verifiedTitle: { ...typography.h2, color: colors.ink[900], textAlign: 'center' },
  verifiedBody: { ...typography.caption, color: colors.muted, textAlign: 'center' },

  docsBlock: { gap: spacing[2] },
  sectionTitle: { ...typography.label, color: colors.ink[900] },
  empty: { ...typography.caption, color: colors.muted },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing[4],
  },
  docName: { ...typography.label, color: colors.ink[900] },
  docMeta: { ...typography.caption, color: colors.muted, marginTop: spacing[1] },
});
