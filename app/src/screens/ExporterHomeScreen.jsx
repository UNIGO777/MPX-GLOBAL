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
 * Exporter home — first tab. Redesigned 2026-08-21 against an owner-approved
 * spec (the seller-home mockup), replacing the 2026-08-18 build.
 *
 * WHAT THE REDESIGN CHANGED, and why:
 *
 * 1. 🔴 The screen is now mostly FLAT AND RULED, not a stack of bordered
 *    cards. Every block being a rounded card is what made the old version
 *    read as generic — real product surfaces reserve a card for a thing that
 *    is genuinely an OBJECT. Here only products get cards (they are objects);
 *    counts, enquiries and the storefront row are flat rows separated by
 *    hairlines.
 *
 * 2. 🔴 ONE bold element, and it goes to the thing that actually blocks the
 *    seller: verification. It is a full-bleed navy block with square corners
 *    while everything below is quiet — that contrast is the whole hierarchy.
 *    It renders ONLY while unverified, and when it goes the page moves up
 *    rather than leaving a dead slot.
 *
 * 3. Enquiries moved from near the BOTTOM to the top of the body, with the
 *    count set large. On a discovery marketplace answering buyers is the
 *    seller's entire job; burying it under the catalogue had the priority
 *    backwards.
 *
 * 4. The cap meter is SEGMENTED, not a percentage track. The limit is 3 —
 *    a proportional bar turns something countable into an abstraction. Three
 *    slots with two filled reads instantly; drafts use the same idea at ten.
 *
 * Because sections now own their horizontal padding (the ScrollView has
 * none), hairlines span edge to edge and the navy block can bleed full width.
 *
 * EVERY number is server-derived, from one `GET /products/mine` plus the org
 * and the unread count:
 * - Counts ← `counts.active|draft|inactive`
 * - Cap meter ← `caps`, rendered ONLY while unverified; a verified account
 *   has no cap UI at all (D1/§A10/§A15) — the server sends `{verified:true}`
 *   and no figures, so there is nothing to grey out.
 * - 🔴 `caps.active.used` and `counts.active` are DIFFERENT numbers on
 *   purpose: the cap count excludes taken-down products (§A10) while the
 *   count includes every active row. Never swap them — the meter must not
 *   imply a blocked product occupies a live slot.
 * - Enquiries ← `/conversations/unread-count` (unread, not total: a count
 *   means "needs attention"; a total would nag forever). Never blocks the
 *   screen — a failure just shows zero.
 *
 * 🚫 Nothing invented: no views/visitors/impressions, no revenue, orders or
 * shipments, no ratings, no promote/boost. None of it exists on this
 * platform (agreement §3.11.2 — no money moves in Phase 1), and a screen that
 * implies otherwise is worse than one that admits the truth.
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
        // Never blocks the page — no count is better than no home screen.
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
  const portalLabel = PORTAL_LABEL[role] ?? 'Exporter';
  // This is the seller's OWN organisation read, not a public projection, so
  // the raw status is legitimately available here — it is what the
  // verification hub needs to distinguish pending from rejected. The public
  // whitelist rule (never raw `kycStatus` to a buyer/guest) is unaffected.
  const verified = org?.kycStatus === 'verified';
  const monogram = (org?.name ?? user?.name ?? '?').trim().slice(0, 2).toUpperCase();

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
          // NOTE: the tab bar is a flow sibling, not an overlay — its height
          // is NOT reserved here on purpose.
          { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
        }
      >
        {/* Identity — the tick sits inline with the company name, the same
            place a buyer sees it on the public page, so the seller
            recognises exactly what buyers are looking at. There is NO
            "unverified" badge: the tick's absence is the only signal. */}
        <View style={styles.identity}>
          <View style={styles.monogram}>
            {org?.logo ? (
              <Image source={{ uri: org.logo }} style={styles.monogramImage} />
            ) : (
              <Text style={styles.monogramText}>{monogram}</Text>
            )}
          </View>
          <View style={styles.identityText}>
            <View style={styles.identityNameRow}>
              <Text style={styles.identityName} numberOfLines={1}>
                {org?.name ?? 'Your company'}
              </Text>
              {verified ? (
                <Ionicons name="checkmark-circle" size={15} color={colors.success} accessible={false} />
              ) : null}
            </View>
            <Text style={styles.identityMeta} numberOfLines={1}>
              {portalLabel}
              {org?.country ? ` · ${org.country}` : ''}
            </Text>
          </View>
        </View>

        {/* 🔴 The one bold element — full-bleed, square, unverified only. */}
        {caps && caps.verified === false ? (
          <View style={styles.verify}>
            <Text style={styles.verifyKicker}>Verification</Text>
            <Text style={styles.verifyTitle}>Get your verified tick</Text>
            <Text style={styles.verifyBody}>
              Send your registration and tax documents. Once approved, your listing limits are removed.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('KycHub')}
              accessibilityRole="button"
              accessibilityLabel="Start verification"
              style={({ pressed }) => [styles.verifyCta, pressed && styles.verifyCtaPressed]}
            >
              <Text style={styles.verifyCtaText}>Start verification</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary[800]} accessible={false} />
            </Pressable>
          </View>
        ) : null}

        {/* Enquiries — a row, not a card, with the count set large. */}
        <Pressable
          onPress={() => navigation.navigate('ExporterChats')}
          accessibilityRole="button"
          accessibilityLabel="Buyer enquiries"
          style={({ pressed }) => [styles.enquiry, pressed && styles.rowPressed]}
        >
          <Text style={[styles.enquiryCount, unread === 0 && styles.enquiryCountZero]}>
            {unread > 99 ? '99+' : unread}
          </Text>
          <View style={styles.enquiryText}>
            <Text style={styles.enquiryTitle}>
              {unread === 0 ? 'No unanswered enquiries' : 'Buyers waiting for a reply'}
            </Text>
            <Text style={styles.enquirySubtitle}>
              {unread === 0 ? 'New questions from buyers land here' : 'Replying quickly wins the order'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.ink[300]} accessible={false} />
        </Pressable>

        {/* Catalogue — flat numbers. No tiles, no borders. */}
        <View style={styles.section}>
          <Text style={styles.kicker}>Catalogue</Text>
          <View style={styles.counts}>
            <CountItem value={counts?.active ?? 0} label="Live" live />
            <CountItem value={counts?.draft ?? 0} label="Draft" />
            <CountItem value={counts?.inactive ?? 0} label="Hidden" />
          </View>
        </View>

        {/* Cap meter — unverified only, segmented because the limit is 3. */}
        {caps && caps.verified === false ? (
          <Pressable
            onPress={() => navigation.navigate('KycHub')}
            accessibilityRole="button"
            accessibilityLabel="Listing allowance"
            style={({ pressed }) => [styles.caps, pressed && styles.rowPressed]}
          >
            <CapMeter label="Live listings" used={caps.active.used} limit={caps.active.limit} />
            <CapMeter label="Drafts" used={caps.drafts.used} limit={caps.drafts.limit} />
            <Text style={styles.capsNote}>Both limits are removed once you&apos;re verified.</Text>
          </Pressable>
        ) : null}

        {/* Storefront — how buyers actually see this company. */}
        <Pressable
          onPress={
            org?.slug
              ? () => navigation.navigate('SupplierProfile', { idOrSlug: org.slug })
              : notBuilt('Your public profile')
          }
          accessibilityRole="button"
          accessibilityLabel="Preview public profile"
          style={({ pressed }) => [styles.storefront, pressed && styles.rowPressed]}
        >
          <Ionicons name="storefront-outline" size={19} color={colors.primary[600]} accessible={false} />
          <View style={styles.storefrontText}>
            <Text style={styles.storefrontTitle}>Preview your public page</Text>
            <Text style={styles.storefrontSubtitle}>
              {counts?.active ?? 0} {counts?.active === 1 ? 'product' : 'products'} live · what buyers see
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.ink[300]} accessible={false} />
        </Pressable>

        {/* Products — the ONLY cards on the screen, because they are the only
            objects. Uses the shared ProductCard everywhere, unchanged. */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your products</Text>
            {products.length > 0 ? (
              <Pressable
                onPress={() => navigation.navigate('ExporterCatalogue')}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.viewAll}>Manage</Text>
              </Pressable>
            ) : null}
          </View>

          {products.length > 0 ? (
            <>
              <View style={styles.grid}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    showStatus
                    // Owner-mode detail (works for drafts/hidden too, which
                    // have no public page); Edit is one tap from there.
                    onPress={(p) => navigation.navigate('ProductDetail', { ownerProductId: p.id })}
                    style={styles.gridSlot}
                  />
                ))}
              </View>
              <Pressable
                onPress={startAdd}
                accessibilityRole="button"
                accessibilityLabel="Add product"
                style={({ pressed }) => [styles.addOutline, pressed && styles.rowPressed]}
              >
                <Ionicons name="add" size={18} color={colors.primary[600]} accessible={false} />
                <Text style={styles.addOutlineText}>Add product</Text>
              </Pressable>
            </>
          ) : (
            /* First-run — the state that decides whether a new exporter ever
               lists anything. Encouraging, not empty, and the CTA is filled
               here because there is no navy block competing with it. */
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>List your first product</Text>
              <Text style={styles.emptyBody}>Buyers can&apos;t find you until you publish something.</Text>
              <Pressable
                onPress={startAdd}
                accessibilityRole="button"
                accessibilityLabel="Add product"
                style={({ pressed }) => [styles.addFilled, pressed && styles.addFilledPressed]}
              >
                <Ionicons name="add" size={18} color={colors.white} accessible={false} />
                <Text style={styles.addFilledText}>Add product</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function CountItem({ value, label, live = false }) {
  return (
    <View style={styles.countItem}>
      <View style={styles.countValueRow}>
        {live && value > 0 ? <View style={styles.liveDot} /> : null}
        <Text style={[styles.countValue, value === 0 && styles.countValueZero]}>{value}</Text>
      </View>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

/**
 * Segmented allowance meter. One slot per unit of the limit — deliberately
 * NOT a proportional bar: the limit is 3, and a percentage turns something
 * countable into an abstraction.
 *
 * `used` can exceed `limit` in theory (a cap lowered later), so the fill is
 * clamped and the printed figure stays truthful.
 */
function CapMeter({ label, used, limit }) {
  const filled = Math.max(0, Math.min(used, limit));
  return (
    <View style={styles.cap}>
      <View style={styles.capHead}>
        <Text style={styles.capLabel}>{label}</Text>
        <Text style={styles.capCount}>
          {used}/{limit}
        </Text>
      </View>
      <View style={styles.segments}>
        {Array.from({ length: limit }, (_, i) => (
          <View key={i} style={[styles.segment, i < filled && styles.segmentOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  // Rows tint rather than fade — a fade on a flat, ruled surface reads as the
  // row breaking, not responding.
  rowPressed: { backgroundColor: colors.ink[50] },

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

  // 🔴 No horizontal padding: sections own it, so hairlines reach both edges
  // and the verification block can bleed full width.
  scroll: { paddingTop: spacing[4] },
  section: { paddingHorizontal: spacing[5], paddingTop: spacing[5] },

  kicker: {
    ...typography.tiny,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ink[400],
    marginBottom: spacing[3],
  },

  // --- identity -------------------------------------------------------
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monogramImage: { width: '100%', height: '100%' },
  monogramText: { ...typography.label, fontWeight: '700', color: colors.primary[700] },
  identityText: { flex: 1, minWidth: 0 },
  identityNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  identityName: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },
  identityMeta: { ...typography.caption, color: colors.muted, marginTop: 1 },

  // --- verification (the one bold block) -------------------------------
  verify: {
    backgroundColor: colors.primary[800],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  verifyKicker: {
    ...typography.tiny,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.primary[200],
    marginBottom: spacing[2],
  },
  verifyTitle: { ...typography.h3, color: colors.white, marginBottom: spacing[1] },
  verifyBody: {
    ...typography.caption,
    color: colors.primary[200],
    lineHeight: 18,
    marginBottom: spacing[4],
    maxWidth: 300,
  },
  verifyCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  verifyCtaPressed: { backgroundColor: colors.primary[100] },
  verifyCtaText: { ...typography.label, fontWeight: '700', color: colors.primary[800] },

  // --- enquiries -------------------------------------------------------
  enquiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
  },
  enquiryCount: {
    ...typography.h1,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -1,
    color: colors.ink[900],
    minWidth: 34,
  },
  enquiryCountZero: { color: colors.ink[300] },
  enquiryText: { flex: 1, minWidth: 0 },
  enquiryTitle: { ...typography.bodyStrong, color: colors.ink[900] },
  enquirySubtitle: { ...typography.caption, color: colors.muted, marginTop: 1 },

  // --- catalogue counts ------------------------------------------------
  counts: { flexDirection: 'row', gap: spacing[8] },
  countItem: {},
  countValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  countValue: { ...typography.h2, color: colors.ink[900], letterSpacing: -0.6 },
  countValueZero: { color: colors.ink[300] },
  countLabel: { ...typography.caption, color: colors.muted, marginTop: 1 },
  liveDot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.success },

  // --- cap meter -------------------------------------------------------
  caps: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[5] },
  cap: { marginBottom: spacing[3] },
  capHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  capLabel: { ...typography.caption, fontWeight: '600', color: colors.ink[700] },
  capCount: { ...typography.caption, color: colors.muted },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 4, borderRadius: 1, backgroundColor: colors.ink[200] },
  segmentOn: { backgroundColor: colors.primary[600] },
  capsNote: { ...typography.tiny, color: colors.muted, marginTop: spacing[1] },

  // --- storefront ------------------------------------------------------
  storefront: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
  },
  storefrontText: { flex: 1, minWidth: 0 },
  storefrontTitle: { ...typography.label, fontWeight: '600', color: colors.ink[900] },
  storefrontSubtitle: { ...typography.caption, color: colors.muted, marginTop: 1 },

  // --- products --------------------------------------------------------
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  sectionTitle: { ...typography.h3, color: colors.ink[900] },
  viewAll: { ...typography.label, fontWeight: '600', color: colors.primary[600] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  gridSlot: { width: '48%' },

  addOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  addOutlineText: { ...typography.label, fontWeight: '700', color: colors.primary[700] },

  empty: { paddingVertical: spacing[6], alignItems: 'flex-start' },
  emptyTitle: { ...typography.h3, color: colors.ink[900] },
  emptyBody: { ...typography.body, color: colors.muted, marginTop: spacing[1], marginBottom: spacing[4] },
  addFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 46,
    paddingHorizontal: spacing[5],
    borderRadius: radii.md,
    backgroundColor: colors.primary[600],
  },
  addFilledPressed: { backgroundColor: colors.primary[700] },
  addFilledText: { ...typography.label, fontWeight: '700', color: colors.white },
});
