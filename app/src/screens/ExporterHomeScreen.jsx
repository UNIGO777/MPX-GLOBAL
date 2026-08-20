import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { organisationApi } from '../api/organisation.js';
import { conversationsApi } from '../api/conversations.js';
import { sellerProductsApi } from '../api/sellerProducts.js';
import { BrandWordmark } from '../components/BrandMark.jsx';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PORTAL_LABEL } from './auth/portals.js';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';
import { draftCapBlock } from '../utils/productCaps.js';

/**
 * Exporter home — first tab. Rebuilt 2026-08-18 against an owner-supplied
 * mockup ("make exact same"), replacing the old NavyCanopy version whose
 * body was three inert "COMING SOON" cards.
 *
 * Same shell language as the rebuilt Buyer Home so the two portals read as
 * one product: plain white page, own sticky header (`headerShown: false` on
 * the tab), `radii.lg` on every card, one blue accent.
 *
 * EVERY number here is server-derived, from a single `GET /products/mine`
 * plus the org and the unread count:
 * - Stat tiles ← `counts.active|draft|inactive`
 * - Allowance meter ← `caps` (rendered ONLY while unverified; a verified
 *   account has no cap UI at all, per D1/§A10/§A15)
 * - 🔴 `caps.active.used` and `counts.active` are DIFFERENT numbers on
 *   purpose: the cap count excludes taken-down products (§A10) while the
 *   tile counts every active row. Each is used for its own job and they are
 *   never swapped — the meter must never imply a blocked product occupies a
 *   live slot.
 * - Enquiries badge ← `/conversations/unread-count` (unread, not total: a
 *   badge means "needs attention"; a total would nag forever). It never
 *   blocks the screen — a failure just hides the badge.
 *
 * 🚫 Nothing invented: no views/visitors/impressions, no revenue, orders or
 * shipments, no ratings, no promote/boost — none of that exists on this
 * platform. The mockup's generic "GLOBAL TRADE" wordmark is replaced with
 * the real `BrandWordmark`.
 *
 * ✅ 2026-08-18 (later) — fully wired: "+ Add product" → the category picker
 * (screen 6), "View all" → the Catalogue tab (screen 5), a product card →
 * the edit form (screen 7). The three coming-soon notices this screen
 * shipped with lasted one day; their ledger rows are closed.
 */
const GRID_PAGE_SIZE = 4;

export function ExporterHomeScreen({ navigation }) {
  const { user, role } = useAuth();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState({
    loading: true,
    error: null,
    org: null,
    products: [],
    counts: null,
    caps: null,
    unread: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [org, mine, unread] = await Promise.all([
        organisationApi.mine(),
        sellerProductsApi.mine({ pageSize: GRID_PAGE_SIZE }),
        // Never blocks the page — no badge is better than no home screen.
        conversationsApi.unreadCount().catch(() => 0),
      ]);
      setState({
        loading: false,
        error: null,
        org,
        products: mine.products ?? [],
        counts: mine.counts ?? null,
        caps: mine.caps ?? null,
        unread: unread ?? 0,
      });
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

  const { loading, error, org, products, counts, caps, unread } = state;
  const firstName = user?.name?.split(' ')[0];
  const portalLabel = PORTAL_LABEL[role] ?? 'Exporter';
  const verified = org?.kycStatus === 'verified';

  const notBuilt = (what) => () =>
    Alert.alert('Coming soon', `${what} isn't built yet — hang tight.`);

  // Explain the draft cap BEFORE the form, not after a filled-in save (M2
  // brief). The server still enforces it; this only saves wasted effort.
  const startAdd = () => {
    const blocked = draftCapBlock(caps);
    if (blocked) {
      Alert.alert('Draft limit reached', blocked, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Get verified', onPress: () => navigation.navigate('KycHub') },
      ]);
      return;
    }
    navigation.navigate('ProductCategoryPicker');
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
      <BrandWordmark tone="onWhite" height={20} />
      <Pressable
        onPress={() => navigation.navigate('ExporterProfile')}
        accessibilityRole="button"
        accessibilityLabel="Open Profile"
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
      >
        <Ionicons name="person" size={18} color={colors.primary[600]} accessible={false} />
      </Pressable>
    </View>
  );

  if (loading && !org) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        {header}
        <View style={styles.centered}>
          <Spinner label="Loading your dashboard…" />
        </View>
      </View>
    );
  }
  if (error && !org) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        {header}
        <View style={styles.centered}>
          <ErrorState error={error} onRetry={load} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          // Floor keeps content clear of Android's translucent gesture-nav
          // strip even when the inset reports 0 (2026-08-18 safe-area fix).
          { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
        }
      >
        <Text style={styles.welcome} numberOfLines={1}>
          Welcome, {firstName ?? 'there'}
        </Text>
        <View style={styles.identityRow}>
          <Text style={styles.orgName} numberOfLines={1}>
            {org?.name ?? 'Your company'}
          </Text>
          {verified ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.success} accessible={false} />
          ) : null}
          <Text style={styles.identityMeta}>· {portalLabel} account</Text>
        </View>

        {/* Allowance — unverified only. A verified seller sees no cap UI. */}
        {caps && caps.verified === false ? (
          <Pressable
            onPress={() => navigation.navigate('KycHub')}
            accessibilityRole="button"
            accessibilityLabel="Listing allowance — get verified"
            style={({ pressed }) => [styles.allowance, pressed && styles.allowancePressed]}
          >
            <View style={styles.allowanceHead}>
              <Ionicons name="shield-outline" size={20} color={colors.primary[600]} accessible={false} />
              <Text style={styles.allowanceTitle}>Listing allowance</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, (caps.active.used / caps.active.limit) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.allowanceCounts}>
              {caps.active.used} of {caps.active.limit} live{'   '}·{'   '}
              {caps.drafts.used} of {caps.drafts.limit} drafts
            </Text>
            <View style={styles.allowanceDivider} />
            <View style={styles.allowanceCta}>
              <Text style={styles.allowanceCtaText}>Get verified to publish unlimited products</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary[700]} accessible={false} />
            </View>
          </Pressable>
        ) : null}

        {/* Stat tiles — the seller's own catalogue, nothing derived. */}
        <View style={styles.statRow}>
          <StatTile
            icon="checkmark-circle-outline"
            tint="#E7F7EF"
            glyph="#05603A"
            value={counts?.active ?? 0}
            label="Live"
          />
          <StatTile
            icon="document-text-outline"
            tint={colors.primary[50]}
            glyph={colors.primary[600]}
            value={counts?.draft ?? 0}
            label="Drafts"
          />
          <StatTile
            icon="eye-off-outline"
            tint={colors.ink[100]}
            glyph={colors.ink[600]}
            value={counts?.inactive ?? 0}
            label="Hidden"
          />
        </View>

        <Pressable
          onPress={startAdd}
          accessibilityRole="button"
          accessibilityLabel="Add product"
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Ionicons name="add" size={20} color={colors.white} accessible={false} />
          <Text style={styles.addButtonText}>Add product</Text>
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>My products</Text>
          {products.length > 0 ? (
            <Pressable
              onPress={() => navigation.navigate('ExporterCatalogue')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          ) : null}
        </View>

        {products.length > 0 ? (
          <View style={styles.grid}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showStatus
                // Owner-mode detail (works for drafts/hidden too, which have
                // no public page); Edit is one tap from there.
                onPress={(p) => navigation.navigate('ProductDetail', { ownerProductId: p.id })}
                style={styles.gridSlot}
              />
            ))}
          </View>
        ) : (
          /* First-run — the state that decides whether a new exporter ever
             lists anything. Encouraging, not empty. */
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={30} color={colors.primary[600]} accessible={false} />
            </View>
            <Text style={styles.emptyTitle}>List your first product</Text>
            <Text style={styles.emptyBody}>Buyers can&apos;t find you until you publish something.</Text>
          </View>
        )}

        <Pressable
          onPress={() => navigation.navigate('ExporterChats')}
          accessibilityRole="button"
          accessibilityLabel="Buyer enquiries"
          style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary[600]} accessible={false} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Buyer enquiries</Text>
            <Text style={styles.rowSubtitle}>Questions from buyers land here</Text>
          </View>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
        </Pressable>

        {/* How buyers see you — opens the REAL public supplier profile. */}
        <View style={styles.publicCard}>
          <View style={styles.publicLogo}>
            {org?.logo ? (
              <Image source={{ uri: org.logo }} style={styles.publicLogoImage} />
            ) : (
              <Ionicons name="storefront-outline" size={26} color={colors.primary[600]} accessible={false} />
            )}
          </View>
          <View style={styles.publicNameRow}>
            <Text style={styles.publicName} numberOfLines={1}>
              {org?.name ?? 'Your company'}
            </Text>
            {verified ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.success} accessible={false} />
            ) : null}
          </View>
          {/* The seller's own Live count. A taken-down product still counts
              here but is not visible publicly — the public page itself shows
              the authoritative buyer-facing number when opened. */}
          <Text style={styles.publicCount}>
            {counts?.active ?? 0} {counts?.active === 1 ? 'product' : 'products'} live
          </Text>
          <Pressable
            onPress={
              org?.slug
                ? () => navigation.navigate('SupplierProfile', { idOrSlug: org.slug })
                : notBuilt('Your public profile')
            }
            accessibilityRole="button"
            accessibilityLabel="Preview public profile"
            style={({ pressed }) => [styles.ghostButton, pressed && styles.ghostButtonPressed]}
          >
            <Text style={styles.ghostButtonText}>Preview public profile</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function StatTile({ icon, tint, glyph, value, label }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={glyph} accessible={false} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    backgroundColor: colors.surface.DEFAULT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  welcome: { ...typography.h1, color: colors.primary[900] },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing[1] },
  orgName: { ...typography.bodyStrong, color: colors.primary[700], flexShrink: 1 },
  identityMeta: { ...typography.body, color: colors.muted },

  allowance: {
    marginTop: spacing[5],
    backgroundColor: colors.primary[50],
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  allowancePressed: { backgroundColor: colors.primary[100] },
  allowanceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  allowanceTitle: { ...typography.bodyStrong, color: colors.primary[800] },
  track: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.primary[100],
    marginTop: spacing[3],
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radii.full, backgroundColor: colors.primary[600] },
  allowanceCounts: { ...typography.caption, color: colors.primary[800], marginTop: spacing[2] },
  allowanceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.primary[200],
    marginVertical: spacing[3],
  },
  allowanceCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  allowanceCtaText: { ...typography.caption, color: colors.primary[700], flexShrink: 1 },

  statRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[5] },
  statTile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
    paddingVertical: spacing[4],
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { ...typography.h1, color: colors.primary[900], marginTop: spacing[2] },
  statLabel: { ...typography.tiny, color: colors.muted, marginTop: 2 },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    marginTop: spacing[5],
  },
  addButtonPressed: { backgroundColor: colors.primary[700] },
  addButtonText: { ...typography.bodyStrong, color: colors.white },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  sectionTitle: { ...typography.h3, color: colors.primary[900] },
  viewAll: { ...typography.label, color: colors.primary[700] },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
  gridSlot: { width: '47%', marginBottom: spacing[2] },

  empty: {
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  emptyTitle: { ...typography.h3, color: colors.ink[900], textAlign: 'center' },
  emptyBody: { ...typography.caption, color: colors.muted, textAlign: 'center', marginTop: spacing[1] },

  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.ink[900] },
  rowSubtitle: { ...typography.caption, color: colors.muted, marginTop: 1 },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { ...typography.caption, fontWeight: '700', color: colors.white },

  publicCard: {
    alignItems: 'center',
    marginTop: spacing[5],
    padding: spacing[5],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  publicLogo: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  publicLogoImage: { width: 64, height: 64 },
  publicNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  publicName: { ...typography.h3, color: colors.primary[900], flexShrink: 1 },
  publicCount: { ...typography.caption, color: colors.muted, marginTop: spacing[1] },
  ghostButton: {
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
  },
  ghostButtonPressed: { backgroundColor: colors.primary[50] },
  ghostButtonText: { ...typography.bodyStrong, color: colors.primary[700] },
});
