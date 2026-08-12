import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { organisationApi } from '../api/organisation.js';
import { kycApi } from '../api/kyc.js';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { NavyCanopy } from '../components/NavyCanopy.jsx';
import { VerificationSummaryCard } from '../components/VerificationSummaryCard.jsx';
import { VerifiedBadge } from '../components/Badge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * Buyer home — first tab (design brief `design-plans/m1/app-screens-design.md`
 * §9). Greeting + company identity + a verification card that taps through to
 * the hub + a real "Browse categories" entry (M2 screen 1 has no tab-bar slot
 * of its own — owner decision 2026-08-07 — so Home is where it hangs) +
 * placeholder cards for the modules arriving later (M3 search, M4
 * enquiries/chat) — those stay visibly "Coming soon", ledgered in
 * `docs/UiWebNotes.md`, not live-looking dead links.
 *
 * Two reads, not one: `/me/organisation` has the company name/country but not
 * `kycRejectionReason`/`kycSubmittedAt`, and `/me/verification` has the reverse
 * — see `organisation.service.js` `ownerView()` vs `kyc.controller.js`. Both
 * are cheap, cached-on-focus calls the Hub and Profile already make.
 */
export function BuyerHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, org: null, verification: null });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [org, verification] = await Promise.all([organisationApi.mine(), kycApi.getVerification()]);
      setState({ loading: false, error: null, org, verification });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { loading, error, org, verification } = state;
  const status = verification?.kycStatus ?? 'pending';
  const verified = org?.kycStatus === 'verified';
  const firstName = user?.name?.split(' ')[0];

  return (
    <NavyCanopy
      title={firstName ? `Welcome, ${firstName}` : 'Welcome back'}
      subtitle="Your buyer account on MPX Global."
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {loading && !org ? (
        <Spinner label="Loading your home…" />
      ) : error && !org ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <View style={styles.body}>
          {org?.name ? (
            <View style={styles.identityCard}>
              <View style={styles.identityRow}>
                <Ionicons name="business-outline" size={18} color={colors.primary[600]} accessible={false} />
                <Text style={styles.identityName} numberOfLines={1}>
                  {org.name}
                </Text>
                {verified ? <VerifiedBadge verified /> : null}
              </View>
              {org.country ? <Text style={styles.identityMeta}>{org.country}</Text> : null}
            </View>
          ) : null}

          <VerificationSummaryCard status={status} onPress={() => navigation.navigate('KycHub')} />

          {/* M2 screen 1. No tab-bar entry by design (owner, 2026-08-07) —
              Home is the entry point instead. */}
          <Pressable
            onPress={() => navigation.navigate('CategoryBrowse')}
            accessibilityRole="button"
            accessibilityLabel="Browse categories"
            style={({ pressed }) => [styles.browseCard, pressed && styles.browseCardPressed]}
          >
            <View style={styles.browseIconWrap}>
              <Ionicons name="grid-outline" size={22} color={colors.primary[600]} accessible={false} />
            </View>
            <View style={styles.browseBody}>
              <Text style={styles.browseTitle}>Browse categories</Text>
              <Text style={styles.browseSubtitle}>Find suppliers across 40 categories</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
          </Pressable>

          <Text style={styles.sectionLabel}>COMING SOON</Text>
          <View style={styles.placeholderStack}>
            <PlaceholderCard icon="search-outline" label="Search suppliers" />
            <PlaceholderCard icon="document-text-outline" label="Enquiries" />
            <PlaceholderCard icon="chatbubbles-outline" label="Chat" />
          </View>
        </View>
      )}
    </NavyCanopy>
  );
}

/** Visibly non-functional — no Pressable, no chevron, nothing that reads as tappable. */
function PlaceholderCard({ icon, label }) {
  return (
    <View style={styles.placeholderCard}>
      <Ionicons name={icon} size={20} color={colors.ink[400]} accessible={false} />
      <Text style={styles.placeholderLabel}>{label}</Text>
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>Coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4], paddingBottom: spacing[6] },

  identityCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    padding: spacing[4],
    gap: spacing[1],
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  identityName: { ...typography.label, color: colors.ink[900], flex: 1 },
  identityMeta: { ...typography.caption, color: colors.muted },

  browseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    padding: spacing[4],
  },
  browseCardPressed: { backgroundColor: colors.ink[50] },
  browseIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseBody: { flex: 1, gap: 2 },
  browseTitle: { ...typography.label, color: colors.ink[900] },
  browseSubtitle: { ...typography.caption, color: colors.muted },

  sectionLabel: {
    ...typography.label,
    color: colors.muted,
    letterSpacing: 0.6,
    marginTop: spacing[2],
  },
  placeholderStack: { gap: spacing[2] },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.ink[50],
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  placeholderLabel: { ...typography.body, color: colors.ink[400], flex: 1 },
  comingSoon: {
    backgroundColor: colors.ink[100],
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  comingSoonText: { ...typography.tiny, color: colors.muted, fontWeight: '600' },
});
