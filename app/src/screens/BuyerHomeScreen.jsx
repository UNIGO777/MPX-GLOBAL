import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
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
import { organisationApi } from '../api/organisation.js';
import { kycApi } from '../api/kyc.js';
import { findCountry } from '../constants/countries.js';
import { BrandWordmark } from '../components/BrandMark.jsx';
import { VerifiedBadge } from '../components/Badge.jsx';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { VerificationSummaryCard } from '../components/VerificationSummaryCard.jsx';
import { useSavedProducts } from '../hooks/useSavedProducts.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PORTAL_LABEL } from './auth/portals.js';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * Buyer home — first tab.
 *
 * 🆕 2026-08-17 — rebuilt against an owner-supplied mockup ("make exact
 * same"), a real, deliberate departure from `NavyCanopy`'s navy-hero pattern
 * used everywhere else in the app: a plain white/light header, left-aligned
 * welcome text, no native tab header (matches `ProfileScreen.jsx`'s own
 * earlier departure — `headerShown: false` on this tab too now).
 *
 * Real, working sections: identity + verification card (unchanged), Browse
 * Categories, **Physical Goods / Business Services** (genuinely filtered —
 * `CategoryBrowseScreen`'s new `typeFilter` param, not decoration), Explore
 * Categories (real category photos), Verified Suppliers and Recently Listed
 * (both `GET /public/search`, the same endpoint the web app uses).
 *
 * Two things kept VISUALLY identical to the mockup but wired honestly rather
 * than left as silent dead controls (`web-ui-notes.md`'s spirit, applied
 * app-side): the search bar and "Register as Exporter" are both real
 * `Pressable`s — tapping either shows a plain "coming soon" message, since
 * neither has anywhere real to go yet (M3 app search isn't built; there's no
 * in-app path for a signed-in buyer to also sign up as an exporter — that
 * flow only exists on the logged-out screens).
 *
 * Two copy changes from the mockup, both because the literal text wasn't
 * true of this product: "Top-rated global partners" → "Verified by our team"
 * (no rating/review system exists — nothing to rate suppliers ON); "Join
 * thousands of verified exporters" → "Join verified exporters" (this
 * platform hasn't shipped long enough to honestly claim "thousands" of
 * anything yet).
 *
 * ⚠️ No avatar photo — checked the backend again, `User`/`Organisation` have
 * no avatar field anywhere. An icon-in-circle stands in for the mockup's
 * stock photo, same reasoning as the Profile screen redesign.
 *
 * 🆕 2026-08-17 (later) — sticky header added (owner: "make a header for the
 * home page in scrolling"): wordmark + a real Profile shortcut, overlaying
 * the scroll content rather than scrolling away with it. The welcome text's
 * avatar moved up into this bar so it isn't shown twice.
 *
 * 🆕 2026-08-17 (later still) — reveal-on-scroll (owner: "only show the
 * header after 2% or 5% scroll"): the header stays hidden at the very top —
 * the in-content "Welcome, {name}" is the only heading there — and fades in
 * (`Animated.Value` driven by the ScrollView's own `onScroll`) once scrolled
 * past `HEADER_REVEAL_THRESHOLD` (3% of screen height — inside the asked
 * 2–5% range, and scaled to device size rather than a flat pixel guess).
 * `pointerEvents` toggles alongside it so an invisible header never eats a
 * tap meant for the content underneath. The loading/error branches have no
 * scroll position to react to, so they keep the simpler, always-visible,
 * in-flow header.
 *
 * 🆕 2026-08-17 (later still) — "make it look alive" (owner). Five real,
 * functional additions, not decoration for its own sake:
 * 1. Content fades + rises in once on the first successful load
 *    (`hasEnteredRef` guards it from replaying on every tab refocus).
 * 2. The promo carousel auto-advances every `PROMO_AUTOPLAY_MS` — see its own
 *    note; still fully swipeable, and pauses when the tab isn't focused.
 * 3. The overlay header now slides down slightly as it fades in, not just a
 *    flat opacity change.
 * 4. `usePressScale` — a small shared tap-bounce used by the quick-action
 *    tiles, the category circles and "Register as Exporter". Genuinely a
 *    press response (`onPressIn`/`onPressOut`), not a decorative loop.
 * 5. Pull-to-refresh is now actually wired to a `RefreshControl` — the
 *    `refreshing` state and `load(true)` already existed (left over from
 *    before this screen dropped `NavyCanopy`, which used to provide its own
 *    pull-to-refresh) but nothing rendered it, so pulling down did nothing.
 */
const CAROUSEL_PAGE_SIZE = 8;

const PROMO_SLIDES = [
  { title: 'Connect with\nVerified Indian\nExporters', subtitle: 'Sourcing made secure.' },
  { title: '40+ Categories\nto Explore', subtitle: 'From textiles to machinery.' },
  { title: 'Discover Trusted\nSuppliers', subtitle: 'Every tick, personally verified.' },
];
// Auto-advance interval — slow enough to read a slide before it moves on,
// still clearly "alive". Manual swipes keep working; the timer just resumes
// counting from wherever the user leaves it (see the carousel's own note).
const PROMO_AUTOPLAY_MS = 4000;

export function BuyerHomeScreen({ navigation }) {
  const { user, role } = useAuth();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState({
    loading: true,
    error: null,
    org: null,
    verification: null,
    categories: [],
    products: [],
    suppliers: [],
  });
  const [refreshing, setRefreshing] = useState(false);
  const [promoIndex, setPromoIndex] = useState(0);
  const { savedIndex, loadIndex, toggleSave } = useSavedProducts();

  // Drives the overlay header's fade-in. `headerVisible` (plain state, not
  // the Animated value itself) toggles `pointerEvents` so the header can't
  // intercept taps while it's still invisible near the top.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerVisible, setHeaderVisible] = useState(false);
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e) => {
      const shouldShow = e.nativeEvent.contentOffset.y > HEADER_REVEAL_THRESHOLD;
      setHeaderVisible((prev) => (prev === shouldShow ? prev : shouldShow));
    },
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_REVEAL_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // Slides down slightly as it fades in rather than a flat opacity swap —
  // small, but this is the "alive" ask applied to a control that already existed.
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_REVEAL_THRESHOLD],
    outputRange: [-8, 0],
    extrapolate: 'clamp',
  });

  // Content entrance — fades + rises in once, the first time data actually
  // loads. `hasEnteredRef` (not state) so it can never trigger a re-render
  // loop, and so it does NOT replay every time `load()` re-runs on tab
  // refocus (`useFocusEffect` below) — that would read as flickering, not alive.
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(14)).current;
  const hasEnteredRef = useRef(false);

  // Promo carousel auto-play — real `ScrollView.scrollTo`, not a fake loop;
  // `promoIndexRef` mirrors `promoIndex` state so the interval always reads
  // the CURRENT slide (a plain closure over state would go stale). Manual
  // swipes update the same ref (see `onMomentumScrollEnd` below), so the
  // timer picks up from wherever the user left it rather than fighting them.
  // Runs only while this tab is focused — `useFocusEffect`, matching `load`'s
  // own pattern — so it isn't silently animating an off-screen carousel.
  const promoScrollRef = useRef(null);
  const promoIndexRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => {
        const next = (promoIndexRef.current + 1) % PROMO_SLIDES.length;
        promoIndexRef.current = next;
        setPromoIndex(next);
        promoScrollRef.current?.scrollTo({ x: next * PROMO_PAGE_WIDTH, animated: true });
      }, PROMO_AUTOPLAY_MS);
      return () => clearInterval(id);
    }, []),
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [org, verification, tree, productsRes, suppliersRes] = await Promise.all([
        organisationApi.mine(),
        kycApi.getVerification(),
        catalogueApi.tree(),
        catalogueApi.search({ type: 'product', sort: 'newest', pageSize: CAROUSEL_PAGE_SIZE }),
        catalogueApi.search({ type: 'supplier', sort: 'newest', verifiedOnly: 'true', pageSize: CAROUSEL_PAGE_SIZE }),
        // Hearts on the product rail — a failed index never blocks Home,
        // hearts just start unfilled (`useSavedProducts` owns that policy).
        loadIndex(),
      ]);
      setState({
        loading: false,
        error: null,
        org,
        verification,
        categories: tree ?? [],
        products: productsRes?.products ?? [],
        suppliers: suppliersRes?.suppliers ?? [],
      });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, [loadIndex]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!state.loading && state.org && !hasEnteredRef.current) {
      hasEnteredRef.current = true;
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(contentTranslateY, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]).start();
    }
  }, [state.loading, state.org, contentOpacity, contentTranslateY]);

  const { loading, error, org, verification, categories, products, suppliers } = state;
  const firstName = user?.name?.split(' ')[0];
  const portalLabel = PORTAL_LABEL[role] ?? 'Buyer';
  const status = verification?.kycStatus ?? 'pending';
  const verified = org?.kycStatus === 'verified';

  const notComingSoon = (feature) => () => Alert.alert('Coming soon', `${feature} isn't built yet — hang tight.`);
  // 2026-08-18 — real destination at last: M2 screen 3.
  const openProduct = (product) => navigation.navigate('ProductDetail', { idOrSlug: product.slug ?? product.id });

  // Shared row content for both header variants below — kept in one place
  // so the loading/error bar and the scroll-reveal overlay can never drift
  // apart. Real destination: taps through to the Profile tab, not decoration.
  const headerContent = (
    <>
      <BrandWordmark tone="onWhite" height={20} />
      <Pressable
        onPress={() => navigation.navigate('BuyerProfile')}
        accessibilityRole="button"
        accessibilityLabel="Open Profile"
        style={({ pressed }) => [styles.stickyAvatar, pressed && styles.pressedOpacity]}
      >
        <Ionicons name="person" size={18} color={colors.primary[600]} accessible={false} />
      </Pressable>
    </>
  );

  // Loading/error only — no scroll position to react to there, so this stays
  // the simpler, always-visible, in-flow bar (docks above the content instead
  // of overlaying it).
  const stickyHeader = (
    <View style={[styles.stickyHeader, { paddingTop: insets.top + spacing[2] }]}>{headerContent}</View>
  );

  // Main content only — hidden at the true top, fades in once scrolled past
  // the reveal threshold (see the file's own note). Overlays the ScrollView
  // rather than sitting in its flow, so hiding it never leaves a gap behind.
  const scrollHeader = (
    <Animated.View
      pointerEvents={headerVisible ? 'auto' : 'none'}
      style={[
        styles.stickyHeader,
        styles.stickyHeaderOverlay,
        { paddingTop: insets.top + spacing[2], opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] },
      ]}
    >
      {headerContent}
    </Animated.View>
  );

  if (loading && !org) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        {stickyHeader}
        <View style={styles.centered}>
          <Spinner label="Loading your home…" />
        </View>
      </View>
    );
  }
  if (error && !org) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        {stickyHeader}
        <View style={styles.centered}>
          <ErrorState error={error} onRetry={load} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing[4] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
        }
      >
        {/* Fades + rises in once on first load — see the file's own note.
            `gap` lives here now (not on `scrollContent`) since this is the
            single flex child the ScrollView actually lays out. */}
        <Animated.View
          style={[styles.contentFade, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}
        >
        {/* Welcome text — the avatar moved to the sticky header above, so it
            isn't shown twice on the same screen. */}
        <View>
          <Text style={styles.welcomeTitle} numberOfLines={1}>
            Welcome, {firstName ?? 'there'}
          </Text>
          <Text style={styles.welcomeSubtitle}>{portalLabel} account on MPX Global</Text>
        </View>

        {/* Not in the mockup, but real functionality that must not silently
            disappear for a visual refresh — this is the account's live
            company identity + its only entry point into the Verification hub. */}
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

        <View style={styles.divider} />

        {/* Search + filter — visually real, honestly not wired yet (M3 app
            search isn't built) */}
        {/* Real since 2026-08-19 (M3): both land on the live Search tab —
            the bar to type, the filter button the same place (filters live
            on the results screen). Ledger rows → Done. */}
        <View style={styles.searchRow}>
          <Pressable
            onPress={() => navigation.navigate('BuyerSearch')}
            accessibilityRole="button"
            accessibilityLabel="Search products or suppliers"
            style={styles.searchBar}
          >
            <Ionicons name="search" size={18} color={colors.ink[400]} accessible={false} />
            <Text style={styles.searchPlaceholder}>Search products or suppliers…</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('BuyerSearch')}
            accessibilityRole="button"
            accessibilityLabel="Search filters"
            style={styles.filterButton}
          >
            <Ionicons name="options-outline" size={20} color={colors.ink[800]} accessible={false} />
          </Pressable>
        </View>

        {/* Quick actions — Physical Goods / Business Services are REAL
            filters (CategoryBrowseScreen's new typeFilter param), not
            decoration. */}
        <View style={styles.quickRow}>
          <QuickTile
            icon="shapes-outline"
            label="Browse Categories"
            onPress={() => navigation.navigate('CategoryBrowse')}
          />
          <QuickTile
            icon="cube-outline"
            label="Physical Goods"
            onPress={() => navigation.navigate('CategoryBrowse', { typeFilter: 'goods' })}
          />
          <QuickTile
            icon="pricetags-outline"
            label="Business Services"
            onPress={() => navigation.navigate('CategoryBrowse', { typeFilter: 'service' })}
          />
        </View>
        <View style={styles.divider} />

        {/* Promo carousel — 3 honest, defensible slides (real category
            count, real verification feature) — never a claim this product
            can't back up. Each slide sits in its own fixed-width "page" so
            `pagingEnabled` still snaps exactly one per swipe; `PROMO_GAP` is
            real padding inside that page (not a hack on the page width
            itself), so a gap shows between slides — including mid-swipe —
            instead of them touching edge to edge (owner: "in between
            banners make some space"). Auto-advances (see `PROMO_AUTOPLAY_MS`)
            but a manual swipe still updates `promoIndexRef` so the two never
            fight each other. */}
        <ScrollView
          ref={promoScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const width = e.nativeEvent.layoutMeasurement.width;
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            promoIndexRef.current = idx;
            setPromoIndex(idx);
          }}
        >
          {PROMO_SLIDES.map((slide, i) => (
            <View key={i} style={styles.promoPage}>
              <View style={styles.promoSlide}>
                <Text style={styles.promoTitle}>{slide.title}</Text>
                <Text style={styles.promoSubtitle}>{slide.subtitle}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.promoDots}>
          {PROMO_SLIDES.map((_, i) => (
            <View key={i} style={[styles.promoDot, i === promoIndex && styles.promoDotActive]} />
          ))}
        </View>

        {categories.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionHeading}>Explore Categories</Text>
              <Pressable onPress={() => navigation.navigate('CategoryBrowse')} accessibilityRole="button">
                <Text style={styles.viewAll}>View All</Text>
              </Pressable>
            </View>
            {/* Bleeds to the screen edges (owner: no space around the circular
                cards, title keeps its normal margin) — the negative margin
                cancels the page's own horizontal padding, then
                `railContent` restores it as real content padding so the
                first/last card still lines up with the title instead of
                touching the screen edge. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.railBleed}
              contentContainerStyle={styles.railContent}
            >
              {categories.slice(0, CAROUSEL_PAGE_SIZE).map((cat) => (
                <CategoryTile key={cat.id} cat={cat} onPress={() => navigation.navigate('CategoryBrowse')} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {suppliers.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Verified Suppliers</Text>
            {/* Not "Top-rated" — no rating/review system exists on this
                product to back that claim. */}
            <Text style={styles.sectionSubheading}>Verified by our team</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.railBleed}
              contentContainerStyle={styles.railContent}
            >
              {suppliers.map((supplier) => (
                <SupplierMiniCard
                  key={supplier.id}
                  supplier={supplier}
                  // 2026-08-18 — real destination at last: M2 screen 4.
                  onPress={() =>
                    navigation.navigate('SupplierProfile', { idOrSlug: supplier.slug ?? supplier.id })
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {products.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Recently Listed</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.railBleed}
              contentContainerStyle={styles.railContent}
            >
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPress={openProduct}
                  savedId={savedIndex[product.id]}
                  onToggleSave={toggleSave}
                  style={styles.productRailSlot}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Real destination doesn't exist yet — no in-app path from a
            signed-in buyer session to exporter signup (that flow lives only
            on the logged-out screens). Visually identical to the mockup;
            tapping is honest about the gap instead of silently doing
            nothing. */}
        <View style={styles.sellCard}>
          <Text style={styles.sellTitle}>Want to sell on MPX Global?</Text>
          <Text style={styles.sellBody}>Join verified exporters expanding their business worldwide.</Text>
          <PressScaleButton
            onPress={notComingSoon('Exporter registration from the buyer app')}
            accessibilityLabel="Register as Exporter"
            touchableStyle={styles.sellButtonTouchable}
            style={styles.sellButton}
          >
            <Text style={styles.sellButtonText}>Register as Exporter</Text>
          </PressScaleButton>
        </View>
        </Animated.View>
      </Animated.ScrollView>
      {scrollHeader}
    </View>
  );
}

// Shared tap-bounce — `Pressable` itself can't animate (only
// `Animated.createAnimatedComponent`-wrapped components react to an
// `Animated.Value`), so this is a plain `Pressable` for touch + layout
// sizing (`touchableStyle`) wrapping an `Animated.View` that carries the
// visual style plus the scale transform. Used by `QuickTile`, `CategoryTile`
// and the "Register as Exporter" button.
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, friction: 6, tension: 300 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 300 }).start();
  return { scale, onPressIn, onPressOut };
}

function PressScaleButton({ children, onPress, accessibilityLabel, touchableStyle, style }) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={touchableStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function QuickTile({ icon, label, onPress }) {
  return (
    <PressScaleButton
      onPress={onPress}
      accessibilityLabel={label}
      touchableStyle={styles.quickTileTouchable}
      style={styles.quickTile}
    >
      <View style={styles.quickIconWrap}>
        <Ionicons name={icon} size={22} color={colors.primary[600]} accessible={false} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>
        {label}
      </Text>
    </PressScaleButton>
  );
}

/** Explore Categories tile — pulled out of the `.map()` it used to be inline
 *  in because `usePressScale` is a hook, and hooks can't be called inside a
 *  loop callback (the count of hook calls must stay identical every render,
 *  which a `.map()` over server data can't guarantee). One component
 *  instance per category keeps each tile's bounce independent. */
function CategoryTile({ cat, onPress }) {
  return (
    <PressScaleButton
      onPress={onPress}
      accessibilityLabel={cat.name}
      touchableStyle={styles.categoryTileTouchable}
      style={styles.categoryTile}
    >
      {cat.image ? (
        <Image source={{ uri: cat.image }} style={styles.categoryCircle} />
      ) : (
        <View style={[styles.categoryCircle, styles.imageFallback]}>
          <Ionicons name="image-outline" size={20} color={colors.ink[400]} accessible={false} />
        </View>
      )}
      <Text style={styles.categoryLabel} numberOfLines={1}>
        {cat.name}
      </Text>
    </PressScaleButton>
  );
}

// Product cards moved to the SHARED `components/ProductCard.jsx` (owner,
// 2026-08-17: one product card everywhere) — the old local ProductMiniCard
// and its formatPrice were deleted with the swap.

/** Tappable since 2026-08-18 — opens the supplier's public profile
 *  (M2 screen 4, `SupplierProfileScreen`). */
function SupplierMiniCard({ supplier, onPress }) {
  const country = supplier.country ? findCountry(supplier.country)?.name ?? supplier.country : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={supplier.name}
      style={({ pressed }) => [styles.miniCard, styles.supplierCard, pressed && styles.pressedOpacity]}>
      <View style={styles.supplierLogoWrap}>
        {supplier.logo ? (
          <Image source={{ uri: supplier.logo }} style={styles.supplierLogo} />
        ) : (
          <Text style={styles.supplierMonogram}>{initials(supplier.name)}</Text>
        )}
      </View>
      <Text style={styles.miniCardTitle} numberOfLines={1}>
        {supplier.name}
      </Text>
      {country ? (
        <View style={styles.sellerRow}>
          <Ionicons name="location-outline" size={12} color={colors.muted} accessible={false} />
          <Text style={styles.sellerName}>{country}</Text>
        </View>
      ) : null}
      {supplier.verified ? (
        <View style={styles.verifiedPill}>
          <Ionicons name="checkmark-circle" size={12} color={colors.success} accessible={false} />
          <Text style={styles.verifiedPillText}>Verified</Text>
        </View>
      ) : null}
    </Pressable>
  );
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

// Every card/box below uses `radii.lg` — the same radius this app's other
// cards already use (Profile, category rows, etc.) — no new radius value
// introduced for this redesign.
const MINI_CARD_WIDTH = 148;
// 🐛 2026-08-17 fix: the promo carousel's `pagingEnabled` pages by the
// SCROLLVIEW'S OWN width, which is the full screen minus `scrollContent`'s
// horizontal padding — a slide narrower or wider than that (the old value
// was a guessed flat `328`) drifts out of sync with the page boundary, so
// the next/previous slide's rounded corner peeks through at the edge
// (owner screenshot: looked like a stray border). Computed to match exactly
// — this is the PAGE width `pagingEnabled` snaps to, not the visible card's
// own width (see `PROMO_GAP` below).
const PROMO_PAGE_WIDTH = Dimensions.get('window').width - spacing[5] * 2;
// 🆕 2026-08-17 (later) — real space between slides (owner: "in between
// banners make some space"), added as padding INSIDE the fixed-width page
// rather than shrinking/growing the page itself, so the paging math above
// stays exact and this can't reintroduce the drift it was just fixed for.
const PROMO_GAP = spacing[3];
// Overlay header's reveal point — see the file's own top-of-file note.
const HEADER_REVEAL_THRESHOLD = Dimensions.get('window').height * 0.03;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },
  // `gap` moved here (off `scrollContent`) — the entrance animation wraps
  // all sections in one `Animated.View`, so THAT is the flex container that
  // actually needs spacing between its children now.
  contentFade: { gap: spacing[4] },

  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    backgroundColor: colors.surface.DEFAULT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  // Only applied to the scroll-reveal variant (loading/error's bar stays in
  // normal flow) — overlays the ScrollView instead of pushing it down, so a
  // hidden header (opacity 0) never leaves a blank gap at the top.
  stickyHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 4,
  },
  stickyAvatar: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },

  welcomeTitle: { ...typography.h1, color: colors.ink[900] },
  welcomeSubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surface.border },

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

  searchRow: { flexDirection: 'row', gap: spacing[2] },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: spacing[3],
  },
  searchPlaceholder: { ...typography.body, color: colors.ink[400], flex: 1 },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickRow: { flexDirection: 'row', gap: spacing[3] },
  // `flex: 1` lives on the touchable (Pressable) now, not the animated inner
  // view — see `usePressScale`'s own note on why the two are split.
  quickTileTouchable: { flex: 1 },
  quickTile: {
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[1],
  },
  pressedOpacity: { opacity: 0.75 },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...typography.caption, fontWeight: '800', color: colors.ink[900], textAlign: 'center' },

  // Fixed-width page `pagingEnabled` snaps to — see `PROMO_PAGE_WIDTH`'s own
  // note. `paddingHorizontal` is the real gap between slides.
  promoPage: {
    width: PROMO_PAGE_WIDTH,
    paddingHorizontal: PROMO_GAP / 2,
  },
  promoSlide: {
    borderRadius: radii.lg,
    backgroundColor: colors.primary[700],
    padding: spacing[5],
    justifyContent: 'flex-end',
    minHeight: 150,
  },
  promoTitle: { ...typography.h2, color: colors.white, marginBottom: spacing[1] },
  promoSubtitle: { ...typography.body, color: colors.primary[100] },
  promoDots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginTop: -spacing[2] },
  promoDot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.ink[200] },
  promoDotActive: { backgroundColor: colors.primary[600], width: 18 },

  section: { gap: spacing[2] },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { ...typography.h3, color: colors.ink[900] },
  sectionSubheading: { ...typography.caption, color: colors.muted, marginTop: -spacing[1] },
  viewAll: { ...typography.label, color: colors.primary[700] },
  // Full-bleed rails — ALL three horizontal rows (Explore Categories,
  // Verified Suppliers, Recently Listed — owner extended it to the other two
  // 2026-08-18): cancels `scrollContent`'s paddingHorizontal (spacing[5]) so
  // each rail's viewport reaches the screen edges, then restores it as
  // content padding so the first/last card still lines up with the headings.
  railBleed: { marginHorizontal: -spacing[5] },
  railContent: { gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[1] },

  // Explicit width on both — the touchable needs it since a `Pressable`
  // inside a horizontal ScrollView's row otherwise has nothing to size
  // itself by (its Animated.View child's width alone isn't guaranteed to
  // propagate back up).
  categoryTileTouchable: { width: 84 },
  categoryTile: { width: 84, alignItems: 'center', gap: spacing[1] },
  categoryCircle: { width: 72, height: 72, borderRadius: radii.full },
  categoryLabel: { ...typography.caption, color: colors.ink[800], textAlign: 'center' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink[100] },

  miniCard: {
    width: MINI_CARD_WIDTH,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    overflow: 'hidden',
  },
  // Fixed slot for the shared ProductCard on the horizontal rail — grids
  // size it with flex instead.
  productRailSlot: { width: 170 },
  miniCardTitle: { ...typography.caption, fontWeight: '600', color: colors.ink[900] },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerName: { ...typography.tiny, color: colors.muted, flexShrink: 1 },

  supplierCard: { padding: spacing[3], gap: spacing[1], alignItems: 'flex-start' },
  supplierLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing[1],
  },
  supplierLogo: { width: 40, height: 40 },
  supplierMonogram: { ...typography.label, color: colors.primary[700] },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '1A',
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    marginTop: spacing[1],
  },
  verifiedPillText: { ...typography.tiny, fontWeight: '600', color: colors.success },

  sellCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[2],
  },
  sellTitle: { ...typography.h3, color: colors.ink[900], textAlign: 'center' },
  sellBody: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  // Layout-only (alignSelf/marginTop) on the touchable, visuals + the scale
  // transform on the animated inner view — same split as `quickTile`.
  sellButtonTouchable: { alignSelf: 'stretch', marginTop: spacing[2] },
  sellButton: {
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellButtonText: { ...typography.bodyStrong, color: colors.white },
});
