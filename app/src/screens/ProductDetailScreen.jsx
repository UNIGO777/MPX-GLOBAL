import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { sellerProductsApi } from '../api/sellerProducts.js';
import { findCountry } from '../constants/countries.js';
import { Button } from '../components/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSavedProducts } from '../hooks/useSavedProducts.js';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 3 — product detail ("the screen buyers judge the platform
 * by", design brief §4). Built 2026-08-18; product cards everywhere now tap
 * through here instead of the "coming soon" alert.
 *
 * Two fetches, by design: the product (public projection, id or slug) and
 * its category's attribute DEFINITIONS — the product stores `{key, value}`
 * snapshots only, and the labels/units live on the category (same split
 * web's SpecTable documents). A value whose definition was since deleted
 * still renders under its raw key — the seller did enter it.
 *
 * Brief rules kept, not re-decided:
 * - Gallery: full-width pager, dots + "2/5" counter, designed no-image
 *   fallback (images are optional at publish).
 * - Price is information in all three modes — "Price on request" is never
 *   styled as an absence. Unit shown when the product has one. No currency
 *   conversion in this phase (§A27.1) — ISO code as-is.
 * - Facts strip renders ONLY filled fields (goods and service sets differ);
 *   a sparse listing must still look intentional.
 * - 🔴 No status word, no takedown trace, no "seller not yet verified" line.
 *   404 covers every unavailable case indistinguishably.
 * - "Send Enquiry" (buyers only; the server enforces the role, the
 *   buyer-side-org check AND the self-enquiry guard): 2026-08-18 it was a
 *   note-only compose sheet; 2026-08-20 (M4 screens) it pushes the
 *   full-screen note-first enquiry form, and success lands IN THE THREAD —
 *   a second enquiry continues the existing one (M4-5).
 * - Seller card taps through to the supplier profile (M2 screen 4).
 * - Share omitted for now: the OS share needs the real public web URL and
 *   the app has no web-origin config — inventing one would ship a broken
 *   link. Flagged, not silently skipped.
 */
const WINDOW_WIDTH = Dimensions.get('window').width;

// Owner-mode lifecycle chip (§1.2 vocabulary). Seller surfaces only — a
// buyer-facing view never shows status.
const OWNER_STATUS = {
  active: { label: 'Live', fg: '#05603A', bg: '#E7F7EF' },
  draft: { label: 'Draft', fg: colors.ink[600], bg: colors.ink[100] },
  inactive: { label: 'Hidden', fg: '#93370D', bg: '#FEF0DC' },
  archived: { label: 'Archived', fg: colors.ink[500], bg: colors.ink[100] },
};
// Title bar fades in as the square gallery scrolls mostly out of view.
const BAR_REVEAL_START = WINDOW_WIDTH * 0.45;
const BAR_REVEAL_END = WINDOW_WIDTH * 0.75;

// Fixed-field rows, per type — label + payload key, rendered only when filled.
const GOODS_FACTS = [
  ['MOQ', 'moqLine'], // synthesised below so the unit rides along
  ['HS code', 'hsCode'],
  ['Country of origin', 'originName'],
  ['Supply ability', 'supplyAbility'],
  ['Lead time', 'leadTime'],
  ['Packaging', 'packaging'],
  ['Payment terms', 'terms'],
];
const SERVICE_FACTS = [
  ['Engagement type', 'engagementType'],
  ['Delivery model', 'deliveryModel'],
  ['Team size', 'teamSize'],
  ['Pricing model', 'pricingModel'],
  ['Timeline', 'timeline'],
];

export function ProductDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  // Two modes (owner mode added 2026-08-19 — owner: tapping your own product
  // card should open its DETAILS, whatever state it's in):
  // - buyer/public: `idOrSlug` → `GET /public/products/:idOrSlug`, live
  //   listings only.
  // - owner: `ownerProductId` → the seller read, which serves ANY status.
  //   A draft/hidden product has no public page at all (the public endpoint
  //   404s by design), so the seller's own view must not go through it.
  const { idOrSlug, ownerProductId } = route.params ?? {};
  const ownerMode = ownerProductId != null;
  const [state, setState] = useState({ loading: true, error: null, product: null, defs: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  // Reveal-on-scroll title bar (owner, 2026-08-18: "on scroll we also need a
  // header") — same pattern as Home's: the floating back circle serves the
  // top-of-page state over the gallery, and once the gallery scrolls mostly
  // away a solid white bar (back + product name) fades in while the circle
  // fades out. `barVisible` (plain state, from the scroll listener) drives
  // `pointerEvents` so whichever control is invisible can't eat taps.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [barVisible, setBarVisible] = useState(false);
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e) => {
      const shouldShow = e.nativeEvent.contentOffset.y > BAR_REVEAL_END - 40;
      setBarVisible((prev) => (prev === shouldShow ? prev : shouldShow));
    },
  });
  const barOpacity = scrollY.interpolate({
    inputRange: [BAR_REVEAL_START, BAR_REVEAL_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const circleOpacity = scrollY.interpolate({
    inputRange: [BAR_REVEAL_START, BAR_REVEAL_END],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Guarded: a stale callback surviving a Fast Refresh would otherwise
  // dispatch GO_BACK at the stack root ("not handled by any navigator").
  const goBackSafely = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  // M3 extension (2026-08-19): the save heart, buyers only and never on
  // your own product — same rules as every card (§A13/§7).
  const { savedIndex, loadIndex, toggleSave } = useSavedProducts();
  const canSave = role === 'buyer' && !ownerMode;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const product = ownerMode
          ? await sellerProductsApi.get(ownerProductId)
          : await catalogueApi.product(idOrSlug);
        // Labels ride along but never block the product — a failed defs read
        // just renders specs under their raw keys. The owner payload carries
        // `categoryId`; the public one carries a nested `category`.
        const catRef = ownerMode ? product.categoryId : (product.category?.slug ?? product.category?.id);
        const defs = await catalogueApi.categoryAttributes(catRef).catch(() => []);
        if (canSave) await loadIndex();
        setState({ loading: false, error: null, product, defs });
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [idOrSlug, ownerMode, ownerProductId, canSave, loadIndex],
  );

  useEffect(() => {
    load();
  }, [load]);

  const { loading, error, product, defs } = state;

  const header = (
    <Animated.View
      pointerEvents={barVisible ? 'none' : 'auto'}
      style={[styles.headerOverlay, { top: insets.top + spacing[2], opacity: circleOpacity }]}
    >
      <Pressable
        onPress={goBackSafely}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.backCircle}
      >
        <Ionicons name="arrow-back" size={22} color={colors.ink[900]} />
      </Pressable>
    </Animated.View>
  );

  if (loading && !product) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <DetailSkeleton topInset={insets.top} />
        {header}
      </View>
    );
  }

  if (error && !product) {
    const notFound = error.status === 404;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        {notFound ? (
          <EmptyState
            icon="cube-outline"
            title="Product not available"
            message="It may have been removed or the link is out of date."
            actionLabel="Go back"
            onAction={goBackSafely}
          />
        ) : (
          <ErrorState error={error} onRetry={load} />
        )}
        {header}
      </View>
    );
  }

  // Public projection sends bare URL strings; the owner read sends REFS
  // ({url, publicId}) because PATCH replaces the whole array. Normalise.
  const images = (product.images ?? []).map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean);
  const price = formatPrice(product.price, product.unit);
  // Owner payload has no `listedSince` — it carries `createdAt`.
  const listed = formatListedSince(product.listedSince ?? product.createdAt);
  const seller = product.seller ?? {};
  const sellerCountry = seller.country ? findCountry(seller.country)?.name ?? seller.country : null;

  // Facts — synthesise the two derived values, then keep only filled rows.
  const isService = product.engagementType != null || product.deliveryModel != null || product.pricingModel != null;
  const factSource = {
    ...product,
    moqLine: product.moq != null ? `${product.moq.toLocaleString('en-IN')}${product.unit ? ` ${product.unit}` : ''}` : null,
    originName: product.countryOfOrigin ? findCountry(product.countryOfOrigin)?.name ?? product.countryOfOrigin : null,
  };
  const facts = (isService ? SERVICE_FACTS : GOODS_FACTS)
    .map(([label, key]) => [label, factSource[key]])
    .filter(([, value]) => value != null && value !== '');

  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const specs = (product.attributes ?? []).filter((a) => a.value !== null && a.value !== undefined && a.value !== '');

  // 2026-08-18 — real destination: M2 screen 4.
  const openSeller = () => navigation.navigate('SupplierProfile', { idOrSlug: seller.slug ?? seller.id });

  // Never on your own product: the server's self-enquiry guard would refuse
  // it anyway, and an exporter session isn't a buyer to begin with.
  const isBuyer = role === 'buyer' && !ownerMode;

  // M4 (2026-08-20): the note-only compose sheet grew into the full-screen
  // note-first enquiry form (screen 2) — Send Enquiry now pushes it. Success
  // lands directly IN THE THREAD (M4-5), because the thread exists now.
  const openEnquiryForm = () =>
    navigation.navigate('EnquiryForm', {
      productId: product.id,
      productName: product.name,
      productImage: images[0] ?? null,
      sellerName: seller.name ?? null,
      categoryType: isService ? 'service' : 'goods',
    });

  // Footer clearance: the pinned Send Enquiry bar (buyers only). The guard
  // floor (spacing[6]) keeps the last content clear of Android's translucent
  // gesture-nav strip even when the inset reports 0 — the "bottom safe area
  // not working" fix (owner, 2026-08-18), same treatment on every pushed
  // catalogue screen.
  // Buyers clear the pinned enquiry bar; everyone clears the gesture-nav
  // strip via the floor (the inset reads 0 on 3-button nav, which is what
  // made this look wrong on device).
  const bottomClearance = Math.max(insets.bottom, spacing[6]) + (isBuyer ? spacing[16] + spacing[6] : spacing[10]);

  return (
    <View style={styles.screen}>
      {/* 🆕 2026-08-19 — the gallery is full-bleed under the status bar, so a
          FIXED icon style was wrong at one end or the other: dark icons
          vanished on a dark photo, light ones on a pale one. Now it follows
          the same scroll position the title bar does — light while the photo
          is behind the status bar, dark once the white bar has taken over —
          and a soft scrim behind the status bar guarantees the light icons
          read on a pale photo too. */}
      <StatusBar style={barVisible ? 'dark' : 'light'} />
      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomClearance }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
        }
      >
        {/* Gallery — full-width pager. The counter/dots only render with 2+
            images; a single image is just an image, not a carousel of one. */}
        <View>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))
              }
            >
              {images.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          ) : (
            /* Pad the empty-gallery fallback by the top inset — with no photo
               there is nothing meant to bleed under the status bar, and its
               icon sat behind the clock without it. */
            <View style={[styles.galleryImage, styles.galleryFallback, { paddingTop: insets.top }]}>
              <Ionicons name="image-outline" size={42} color={colors.ink[300]} accessible={false} />
              <Text style={styles.galleryFallbackText}>No photos yet</Text>
            </View>
          )}
          {images.length > 1 ? (
            <>
              {/* 🔴 Offset by the top inset: the gallery is full-bleed from
                  y=0, so a fixed `top` put this counter INSIDE the status
                  bar, overlapping the clock and battery icons (owner-
                  reported). Anything absolutely positioned against a
                  full-bleed surface has to clear the inset itself — the
                  screen has no SafeAreaView to do it for them. */}
              <View style={[styles.galleryCounter, { top: insets.top + spacing[3] }]}>
                <Text style={styles.galleryCounterText}>
                  {galleryIndex + 1}/{images.length}
                </Text>
              </View>
              <View style={styles.galleryDots}>
                {images.map((uri, i) => (
                  <View key={uri} style={[styles.dot, i === galleryIndex && styles.dotActive]} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          {listed ? <Text style={styles.listed}>Listed {listed}</Text> : null}
          <Text style={styles.price}>{price}</Text>

          {/* Owner mode replaces the seller card (pointless on your own
              product) with what a seller actually needs here: the lifecycle
              status, the takedown reason if any, and a way into the editor. */}
          {ownerMode ? (
            <View style={styles.ownerCard}>
              {product.takedown ? (
                <View style={styles.ownerBlocked}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger.DEFAULT} accessible={false} />
                  <Text style={styles.ownerBlockedText}>
                    Removed by the MPX team
                    {product.takedown.at ? ` on ${formatListedSince(product.takedown.at)}` : ''}
                    {product.takedown.reason ? ` — “${product.takedown.reason}”` : ''}.
                  </Text>
                </View>
              ) : null}
              <View style={styles.ownerRow}>
                <View style={[styles.ownerChip, { backgroundColor: OWNER_STATUS[product.status]?.bg }]}>
                  <Text style={[styles.ownerChipText, { color: OWNER_STATUS[product.status]?.fg }]}>
                    {OWNER_STATUS[product.status]?.label ?? product.status}
                  </Text>
                </View>
                <Text style={styles.ownerHint}>This is your listing</Text>
                {product.status === 'archived' ? null : (
                  <Pressable
                    onPress={() => navigation.navigate('ProductForm', { productId: product.id })}
                    accessibilityRole="button"
                    accessibilityLabel="Edit product"
                    style={({ pressed }) => [styles.ownerEdit, pressed && styles.pressed]}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primary[700]} accessible={false} />
                    <Text style={styles.ownerEditText}>Edit</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
          /* Seller card — name + tick + country + entity type. Never contact
             details (brief). */
          <Pressable
            onPress={openSeller}
            accessibilityRole="button"
            accessibilityLabel={`Seller: ${seller.name}`}
            style={({ pressed }) => [styles.sellerCard, pressed && styles.pressed]}
          >
            <View style={styles.sellerLogoWrap}>
              {seller.logo ? (
                <Image source={{ uri: seller.logo }} style={styles.sellerLogo} />
              ) : (
                <Text style={styles.sellerMonogram}>{initials(seller.name)}</Text>
              )}
            </View>
            <View style={styles.sellerText}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {seller.name}
                </Text>
                {seller.verified ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} accessible={false} />
                ) : null}
              </View>
              <Text style={styles.sellerMeta} numberOfLines={1}>
                {[sellerCountry, humanise(seller.entityType)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
          </Pressable>
          )}

          {facts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>{isService ? 'Service details' : 'Trade details'}</Text>
              <View style={styles.factsCard}>
                {facts.map(([label, value], i) => (
                  <View key={label} style={[styles.factRow, i > 0 && styles.factRowBorder]}>
                    <Text style={styles.factLabel}>{label}</Text>
                    <Text style={styles.factValue} numberOfLines={2}>
                      {String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Description</Text>
              <Text style={styles.description} numberOfLines={descExpanded ? undefined : 6}>
                {product.description}
              </Text>
              {product.description.length > 240 ? (
                <Pressable onPress={() => setDescExpanded((v) => !v)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.readMore}>{descExpanded ? 'Read less' : 'Read more'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {specs.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Specifications</Text>
              <View style={styles.factsCard}>
                {specs.map((attr, i) => {
                  const def = defByKey.get(attr.key);
                  return (
                    <View key={attr.key} style={[styles.factRow, i > 0 && styles.factRowBorder]}>
                      <Text style={styles.factLabel}>{def?.name ?? humanise(attr.key)}</Text>
                      <Text style={styles.factValue} numberOfLines={2}>
                        {presentSpec(attr.value, def)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
      {/* Scrim behind the status bar only — keeps the light icons legible
          over a pale photo. Fades out as the solid title bar fades in, so
          the two never stack. `pointerEvents none`: it must not eat taps. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.statusScrim, { height: insets.top, opacity: circleOpacity }]}
      />
      {header}
      {/* Save heart — buyers only, never on your own product (§A13). Fades
          with the back circle; the title bar carries no duplicate. */}
      {canSave ? (
        <Animated.View
          pointerEvents={barVisible ? 'none' : 'auto'}
          style={[styles.heartOverlay, { top: insets.top + spacing[2], opacity: circleOpacity }]}
        >
          <Pressable
            onPress={() => toggleSave(product, savedIndex[product.id])}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={savedIndex[product.id] != null ? 'Remove from saved' : 'Save product'}
            accessibilityState={{ selected: savedIndex[product.id] != null }}
            style={styles.backCircle}
          >
            <Ionicons
              name={savedIndex[product.id] != null ? 'heart' : 'heart-outline'}
              size={20}
              color={savedIndex[product.id] != null ? colors.primary[600] : colors.ink[700]}
              accessible={false}
            />
          </Pressable>
        </Animated.View>
      ) : null}
      {/* Revealed title bar — solid, above everything once scrolled. */}
      <Animated.View
        pointerEvents={barVisible ? 'auto' : 'none'}
        style={[styles.titleBar, { paddingTop: insets.top + spacing[2], opacity: barOpacity }]}
      >
        <Pressable
          onPress={goBackSafely}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.titleBarBack}
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink[900]} />
        </Pressable>
        <Text style={styles.titleBarText} numberOfLines={1}>
          {product.name}
        </Text>
      </Animated.View>

      {/* Pinned enquiry bar — buyers only (server re-checks regardless).
          Opens the full-screen enquiry form (M4 screen 2). */}
      {isBuyer ? (
        <View style={[styles.enquiryBar, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <Button label="Send Enquiry" onPress={openEnquiryForm} />
        </View>
      ) : null}
    </View>
  );
}

function DetailSkeleton({ topInset }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading product">
      <Skeleton width="100%" height={WINDOW_WIDTH} radius={0} />
      <View style={[styles.body, { paddingTop: spacing[4] }]}>
        <Skeleton width="80%" height={22} />
        <Skeleton width="35%" height={14} style={{ marginTop: spacing[2] }} />
        <Skeleton width="50%" height={24} style={{ marginTop: spacing[3] }} />
        <Skeleton width="100%" height={72} radius={radii.lg} style={{ marginTop: spacing[4] }} />
      </View>
      {/* keeps the skeleton below the translucent back button */}
      <View style={{ height: topInset }} />
    </View>
  );
}

/** Booleans read Yes/No, numbers carry the definition's unit ("120 gsm") —
 *  web SpecTable's rules, unchanged. */
function presentSpec(value, def) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && def?.unit) return `${value.toLocaleString('en-IN')} ${def.unit}`;
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  return String(value);
}

function formatPrice(price, unit) {
  const { mode, min, max, currency } = price ?? {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);
  const suffix = unit ? ` / ${unit}` : '';
  if (mode === 'on_request' || (min == null && max == null)) return 'Price on request';
  if (mode === 'range') return `${currency} ${fmt(min)}–${fmt(max)}${suffix}`;
  return `${currency} ${fmt(min)}${suffix}`;
}

function formatListedSince(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/** "private_limited" → "Private limited" — display fallback only. */
function humanise(value) {
  if (!value) return null;
  const s = String(value).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },

  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9,
    backgroundColor: 'rgba(0, 5, 23, 0.28)',
  },
  headerOverlay: { position: 'absolute', left: spacing[5], zIndex: 10 },
  heartOverlay: { position: 'absolute', right: spacing[5], zIndex: 10 },
  titleBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  titleBarBack: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  titleBarText: { ...typography.h3, color: colors.ink[900], flex: 1 },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
  },

  galleryImage: { width: WINDOW_WIDTH, height: WINDOW_WIDTH, backgroundColor: colors.ink[50] },
  galleryFallback: { alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  galleryFallbackText: { ...typography.caption, color: colors.muted },
  galleryCounter: {
    position: 'absolute',
    // `top` is supplied inline from the safe-area inset — see the note at
    // the call site. Never hard-code it here again.
    right: spacing[3],
    zIndex: 11, // above the status scrim, or the scrim greys it out
    backgroundColor: colors.scrim,
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  galleryCounterText: { ...typography.tiny, color: colors.white, fontWeight: '600' },
  galleryDots: {
    position: 'absolute',
    bottom: spacing[3],
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { backgroundColor: colors.white, width: 16 },

  body: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  name: { ...typography.h2, color: colors.ink[900] },
  listed: { ...typography.caption, color: colors.muted, marginTop: 2 },
  price: { ...typography.h1, color: colors.ink[900], marginTop: spacing[2] },

  ownerCard: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
    gap: spacing[2],
  },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ownerChip: { borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  ownerChipText: { ...typography.tiny, fontWeight: '700' },
  ownerHint: { ...typography.caption, color: colors.muted, flex: 1 },
  ownerEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[300],
    backgroundColor: colors.surface.DEFAULT,
  },
  ownerEditText: { ...typography.label, color: colors.primary[700] },
  ownerBlocked: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: colors.danger[50],
    borderRadius: radii.md,
    padding: spacing[2],
  },
  ownerBlockedText: { ...typography.tiny, color: '#912018', flex: 1 },

  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  pressed: { backgroundColor: colors.ink[50] },
  sellerLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sellerLogo: { width: 44, height: 44 },
  sellerMonogram: { ...typography.label, color: colors.primary[700] },
  sellerText: { flex: 1 },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerName: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },
  sellerMeta: { ...typography.caption, color: colors.muted, marginTop: 1 },

  section: { marginTop: spacing[6] },
  sectionHeading: { ...typography.h3, color: colors.ink[900], marginBottom: spacing[3] },
  factsCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing[4],
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[4],
    paddingVertical: spacing[3],
  },
  factRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surface.border },
  factLabel: { ...typography.caption, color: colors.muted, flexShrink: 0 },
  factValue: { ...typography.caption, fontWeight: '600', color: colors.ink[900], flex: 1, textAlign: 'right' },

  description: { ...typography.body, color: colors.ink[700] },
  readMore: { ...typography.label, color: colors.primary[700], marginTop: spacing[2] },

  enquiryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
  },

});
