import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { organisationApi } from '../api/organisation.js';
import { Badge, VerifiedBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { NavyCanopy } from '../components/NavyCanopy.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';
import { KYC_STATUS_CHIP } from '../utils/kycStatus.js';
import { PORTAL_LABEL } from './auth/portals.js';

/**
 * Screen 16 · Profile — the last tab, shared by both roles.
 *
 * 🔴 Biometric unlock is deliberately NOT on this screen (owner, 2026-08-05).
 * `expo-local-authentication` is installed and `secureStorage` already carries
 * a flag for it, but the actual re-entry gate (design brief screen 17) is not
 * built. Rendering a toggle with nothing behind it would be exactly the
 * "live-looking control that silently does nothing" this project's rules
 * forbid — it returns once screen 17 exists to give it something to control.
 *
 * Company name / verified tick / status chips all come from `/me/organisation`
 * — `/auth/me` (what AuthContext holds) never carried them, so this screen
 * loads its own copy rather than inventing fields on the auth user.
 *
 * Uses the navy canopy with no back arrow: this is a TAB ROOT, not a pushed
 * screen, so there is nowhere to go "back" to. Matches Company Profile /
 * Change Password visually, which is deliberate — Profile is the settings hub
 * and gets the same weight, while the still-placeholder tabs stay plain.
 */
export function ProfileScreen({ navigation }) {
  const { user, role, logout } = useAuth();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setOrg(await organisationApi.mine());
    } catch (err) {
      setLoadError(toAppError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus: the user lands back here right after verifying, editing
  // the company profile, or changing their password — a stale status chip
  // would contradict the screen they just came from.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmLogout = () => {
    const portalLabel = PORTAL_LABEL[role] ?? 'account';
    // Confirm first, and say WHICH account: a person may hold both a buyer and
    // an exporter account (§A21, independent sessions), so "Sign out?" alone
    // would leave them unsure whether they just lost the other one too.
    Alert.alert(
      'Sign out?',
      `This signs out of your ${portalLabel} account only. Your other portal accounts will remain signed in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await logout();
              // No navigation here — clearing the session is what swaps the stack.
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
    );
  };

  const portalLabel = PORTAL_LABEL[role] ?? 'Account';
  const verified = org?.kycStatus === 'verified';
  const chip = org ? KYC_STATUS_CHIP[org.kycStatus] : null;

  return (
    <NavyCanopy title="Profile" subtitle="Account and settings.">
      {loading && !org ? (
        <Spinner label="Loading your profile…" />
      ) : loadError ? (
        <ErrorState error={loadError} onRetry={load} />
      ) : (
        <View style={styles.body}>
          {/* Identity block */}
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={34} color={colors.primary[600]} accessible={false} />
            </View>
            <Text style={styles.name}>{user?.name ?? 'Your account'}</Text>
            {user?.email ? (
              <View style={styles.metaRow}>
                <Ionicons name="mail-outline" size={14} color={colors.muted} accessible={false} />
                <Text style={styles.metaText}>{user.email}</Text>
              </View>
            ) : null}
            {user?.mobile ? (
              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={14} color={colors.muted} accessible={false} />
                <Text style={styles.metaText}>{user.mobile}</Text>
              </View>
            ) : null}

            {/* Which portal this account is — the one thing that matters most
                for someone who holds both a buyer and an exporter account. */}
            <View style={styles.portalPill}>
              <Text style={styles.portalPillText}>{portalLabel} account</Text>
            </View>

            {org?.name ? (
              <View style={styles.companyPill}>
                {verified ? (
                  <Ionicons name="shield-checkmark" size={15} color={colors.success} accessible={false} />
                ) : (
                  <Ionicons name="business-outline" size={15} color={colors.ink[500]} accessible={false} />
                )}
                <Text style={styles.companyPillText} numberOfLines={1}>
                  {org.name}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Company profile + verification — status previews only; the real
              status chip lives on the screens they open. */}
          <View style={styles.card}>
            <Row
              icon="business-outline"
              label="Company profile"
              onPress={() => navigation.navigate('CompanyProfile')}
              right={verified ? <VerifiedBadge verified /> : chip ? <Badge tone={chip.tone} label={chip.label} /> : null}
            />
            <Divider />
            <Row
              icon="shield-checkmark-outline"
              label="Verification"
              onPress={() => navigation.navigate('KycHub')}
              right={verified ? <VerifiedBadge verified /> : chip ? <Badge tone={chip.tone} label={chip.label} /> : null}
            />
          </View>

          <SectionLabel title="Security" />
          <View style={styles.card}>
            <Row
              icon="lock-closed-outline"
              label="Change password"
              onPress={() => navigation.navigate('ChangePassword')}
            />
          </View>

          <SectionLabel title="Notifications" />
          <View style={styles.card}>
            {/* Visibly non-functional — the whole layer arrives later (D5).
                No switch, no chevron: nothing here should look tappable. */}
            <View style={styles.rowInner}>
              <Ionicons name="notifications-outline" size={20} color={colors.ink[400]} accessible={false} />
              <Text style={styles.rowLabelDisabled}>Push notifications</Text>
              <ComingSoon />
            </View>
          </View>

          <SectionLabel title="About" />
          <View style={styles.card}>
            <View style={styles.rowInner}>
              <Ionicons name="information-circle-outline" size={20} color={colors.ink[500]} accessible={false} />
              <Text style={styles.rowLabel}>App version</Text>
              <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '—'}</Text>
            </View>
            <Divider />
            {/* No Terms/Privacy page exists yet anywhere (app or web) — shown
                the same "coming soon" way as Notifications rather than as a
                dead link with a chevron that goes nowhere. */}
            <View style={styles.rowInner}>
              <Ionicons name="document-text-outline" size={20} color={colors.ink[400]} accessible={false} />
              <Text style={styles.rowLabelDisabled}>Terms of Service</Text>
              <ComingSoon />
            </View>
            <Divider />
            <View style={styles.rowInner}>
              <Ionicons name="document-text-outline" size={20} color={colors.ink[400]} accessible={false} />
              <Text style={styles.rowLabelDisabled}>Privacy Policy</Text>
              <ComingSoon />
            </View>
          </View>

          <Button
            label="Sign out"
            variant="danger"
            onPress={confirmLogout}
            loading={signingOut}
            disabled={signingOut}
            style={styles.signOut}
          />
        </View>
      )}
    </NavyCanopy>
  );
}

function Row({ icon, label, onPress, right }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowInner}>
        <Ionicons name={icon} size={20} color={colors.primary[600]} accessible={false} />
        <Text style={styles.rowLabel}>{label}</Text>
        {right}
        <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
      </View>
    </Pressable>
  );
}

function ComingSoon() {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonText}>Coming soon</Text>
    </View>
  );
}

function SectionLabel({ title }) {
  return <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  body: { gap: spacing[4], paddingBottom: spacing[6] },

  identity: { alignItems: 'center', gap: spacing[1], paddingVertical: spacing[3] },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  name: { ...typography.h2, color: colors.ink[900] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  metaText: { ...typography.caption, color: colors.muted },

  portalPill: {
    marginTop: spacing[3],
    backgroundColor: colors.primary[600],
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  portalPillText: { ...typography.bodyStrong, color: colors.white },

  companyPill: {
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    maxWidth: '90%',
  },
  companyPillText: { ...typography.label, color: colors.ink[700], flexShrink: 1 },

  sectionLabel: {
    ...typography.label,
    color: colors.muted,
    letterSpacing: 0.6,
  },

  card: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    overflow: 'hidden',
  },
  row: { minHeight: 52, justifyContent: 'center' },
  rowPressed: { backgroundColor: colors.ink[100] },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  rowLabel: { ...typography.body, color: colors.ink[900], flex: 1 },
  rowLabelDisabled: { ...typography.body, color: colors.ink[400], flex: 1 },
  rowValue: { ...typography.body, color: colors.muted },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface.border,
    marginLeft: spacing[4] + 20 + spacing[3],
  },

  comingSoon: {
    backgroundColor: colors.ink[100],
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  comingSoonText: { ...typography.tiny, color: colors.muted, fontWeight: '600' },

  signOut: { marginTop: spacing[2] },
});
