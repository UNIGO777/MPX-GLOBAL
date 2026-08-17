import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
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
 * Exporter home — first tab (design brief `design-plans/m1/app-screens-design.md`
 * §13). Same shape as `BuyerHomeScreen`, plus the product-allowance notice
 * that is the real reason an exporter bothers to verify.
 *
 * 🔴 D1 / §A10: the cap is **3 active** products, taken-down ones excluded —
 * never a flat "3 products" limit. This is informational copy only (the same
 * fixed constant the web exporter dashboard states, `MAX_ACTIVE_UNVERIFIED` in
 * `product.service.js`) — the server is what actually enforces it once M2's
 * catalogue screens exist; nothing here computes or checks anything.
 *
 * The "Catalogue" placeholder card stays Coming-soon for now — M2's screens
 * 5–7 (My products / category picker / product form) aren't built yet, so
 * there is nowhere for it to link to. Wire it to screen 5 in the same change
 * that ships it (design brief §6 names this exact follow-up).
 */
export function ExporterHomeScreen({ navigation }) {
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
      title={org?.name || firstName || 'Welcome back'}
      subtitle={org?.country ? `${org.country} · Exporter account` : 'Your exporter account on MPX Global.'}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      // This is a tab ROOT — the native tab header still renders above this
      // canopy (white background), so the status bar needs dark icons, not
      // NavyCanopy's own 'light' default (which is right everywhere else).
      statusBarStyle="dark"
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

          {/* Disappears once verified — verified accounts have no cap at all. */}
          {!verified ? (
            <View style={styles.allowanceCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary[700]} accessible={false} />
              <Text style={styles.allowanceText}>
                You can publish up to 3 active products. Get verified to publish more.
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>COMING SOON</Text>
          <View style={styles.placeholderStack}>
            <PlaceholderCard icon="cube-outline" label="Catalogue" />
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

  allowanceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  allowanceText: { ...typography.caption, color: colors.primary[800], flex: 1 },

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
