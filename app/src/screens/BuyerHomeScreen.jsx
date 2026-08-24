import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
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
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { SearchPill } from '../components/SearchPill.jsx';
import { VerificationSummaryCard } from '../components/VerificationSummaryCard.jsx';
import { useSavedProducts } from '../hooks/useSavedProducts.js';
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
 *
 * 🆕 2026-08-21 — REBUILT to the marketplace idiom (owner: "like amazon
 * myntra alibaba"), against an approved mockup. Much of the description above
 * this line now refers to the previous layout; what actually ships:
 *
 * - **Brand-blue app bar** carrying the search pill, which scrolls away while
 *   the sticky bar (same pill, same `searchPill` definition) takes over. The
 *   pill holds a ✨ AI chip: AI search is the one thing a buyer cannot do on a
 *   rival marketplace, so it lives inside the control they already reach for.
 * - **Grey page, white blocks.** Sections are separated by the ground colour
 *   rather than by a border on each one.
 * - **Categories lead**, as a 4-across circular grid above the fold — the
 *   fastest route into a catalogue for someone who knows their trade.
 *   Labels are ONE line with an ellipsis (owner's call after seeing a
 *   three-line version on device) — even row heights, at the cost of
 *   truncating the longer seeded names. The photo does most of the
 *   identifying.
 * - **One coloured band only** — the AI band. Solid navy, not a gradient: a
 *   gradient needs `expo-linear-gradient` and no dependency was added for a
 *   visual. Spending the effect twice would make neither read as special.
 * - **Goods and Services get equal weight**, because the live catalogue is
 *   currently mostly services (website development, DevOps retainers,
 *   marketing) alongside the fabric. Assuming goods would misrepresent the
 *   platform to its first buyers.
 * - **Recently listed is a 2-up grid**, not a rail — a rail hides most of the
 *   listings behind a swipe, and this is the surface a buyer browses.
 *
 * 🔴 KEPT DELIBERATELY, though the mockup had neither:
 * - `VerificationSummaryCard` — the buyer's ONLY in-app route to the KYC hub.
 *   Placed below the discovery surface, not above it: a buyer is fully active
 *   from signup and verification gates nothing for them (D3).
 * - The sticky-header reveal, the first-load fade/rise, the promo autoplay and
 *   its inter-slide gap, and the shared `ProductCard` — all previously asked
 *   for by the owner and all untouched by this pass.
 *
 * 🚫 REMOVED: the in-page search row and the three QuickTiles. Search moved
 * into the app bar; Browse / Goods / Services are covered by the category grid
 * and the split below it. Keeping them would have put the same destination on
 * the screen twice.
 */
const CAROUSEL_PAGE_SIZE = 8;
// Page size for the endless product feed. Kept separate from the rails above:
// this one is a real pagination window that repeats, not a one-shot fetch, and
// 10 (5 rows of 2) keeps each page cheap enough that the fetch lands before a
// fast scroller reaches the bottom of the previous one.
const PRODUCT_PAGE_SIZE = 10;

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

  // Endless product feed at the foot of the page (owner, 2026-08-21: "show
  // more product with the scroll, it will never end, only end if the products
  // are over"). `total` is what ENDS it — the server returns it on every page,
  // so "are there more?" is a fact rather than a guess about whether the last
  // page came back short.
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Guards against `onEndReached` firing repeatedly during one fetch — FlatList
  // will call it again on every scroll event near the end otherwise, and each
  // call would request the same page.
  const loadingMoreRef = useRef(false);
  // First load has happened. After that, returning to the tab must NOT reset
  // the feed to page 1: a buyer who scrolled to product 40, opened one and came
  // back would be thrown to the top with 8 items. Pull-to-refresh still resets.
  const hasLoadedRef = useRef(false);

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
        catalogueApi.search({ type: 'product', sort: 'newest', pageSize: PRODUCT_PAGE_SIZE }),
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
      setProductPage(1);
      setProductTotal(productsRes?.total ?? 0);
      hasLoadedRef.current = true;
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, [loadIndex]);

  /**
   * Next page of the product feed. Appends; never replaces.
   *
   * Stops on the SERVER's `total`, which is why the feed can end honestly
   * rather than spinning forever at the bottom of a short catalogue.
   * De-duplicates by id before appending: a product created between two page
   * requests shifts the newest-first window, and the same row can otherwise
   * arrive twice and crash the list on duplicate keys.
   */
  const loadMoreProducts = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const loaded = state.products.length;
    if (loaded === 0 || (productTotal && loaded >= productTotal)) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const next = productPage + 1;
    try {
      const res = await catalogueApi.search({
        type: 'product',
        sort: 'newest',
        page: next,
        pageSize: PRODUCT_PAGE_SIZE,
      });
      const incoming = res?.products ?? [];
      setState((s) => {
        const seen = new Set(s.products.map((p) => p.id));
        const fresh = incoming.filter((p) => !seen.has(p.id));
        return fresh.length ? { ...s, products: [...s.products, ...fresh] } : s;
      });
      setProductPage(next);
      if (res?.total != null) setProductTotal(res.total);
    } catch {
      // A failed page must never take the home screen down — the feed simply
      // stops where it is and the next scroll can try again.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [productPage, productTotal, state.products.length]);

  useFocusEffect(
    useCallback(() => {
      // 🔴 Only the FIRST focus does a full load. Later focuses would otherwise
      // reset the feed to page 1 under a buyer who had scrolled deep into it.
      if (!hasLoadedRef.current) load();
      else loadIndex();
    }, [load, loadIndex]),
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
  const status = verification?.kycStatus ?? 'pending';

  const notComingSoon = (feature) => () => Alert.alert('Coming soon', `${feature} isn't built yet — hang tight.`);
  // 2026-08-18 — real destination at last: M2 screen 3.
  const openProduct = (product) => navigation.navigate('ProductDetail', { idOrSlug: product.slug ?? product.id });

  const openSearch = () => navigation.navigate('BuyerSearch');

  // The feed has reached the end of the catalogue. Derived from the SERVER's
  // total rather than from "the last page came back short" — a short page can
  // also mean a filtered-out row, and guessing there is how a list either stops
  // early or spins forever.
  const allProductsLoaded = productTotal > 0 && state.products.length >= productTotal;

  // Button mode: Home has nothing to search on-screen, so tapping goes to the
  // Search tab rather than opening a keyboard here. Same component, same look
  // as the Search tab's real input — see `SearchPill`.
  const searchPill = <SearchPill onPress={openSearch} onAiPress={() => navigation.navigate('BuyerAi')} />

  // Shared row content for both header variants below — kept in one place
  // so the loading/error bar and the scroll-reveal overlay can never drift
  // apart. Real destination: taps through to the Profile tab, not decoration.
  const headerContent = searchPill;

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
        <StatusBar style="light" />
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
        <StatusBar style="light" />
        {stickyHeader}
        <View style={styles.centered}>
          <ErrorState error={error} onRetry={load} />
        </View>
      </View>
    );
  }

  // Everything above the product feed. Rides along as the FlatList's header so
  // it scrolls with the feed while the feed itself stays virtualised.
  const listHeader = (
    <>
        {/* Brand-blue app bar — the marketplace idiom (owner, 2026-08-21:
            "like amazon myntra alibaba"). It scrolls AWAY with the page; the
            condensed sticky bar below takes over, carrying the same search
            pill. Deliberately outside `contentFade` so the bar is solid from
            the first frame rather than fading in under the status bar. */}
        <View style={[styles.appBar, { paddingTop: insets.top + spacing[2] }]}>
          {/* ONE row — the search pill with its actions beside it, matching the
              Search tab (owner, 2026-08-21: "i like the search field of search
              tab make same in home tab also"). The wordmark row it replaced
              cost a whole band of blue to say something the app icon, the
              splash and the Profile tab already say; search is what a buyer
              opens this screen for, so it gets the bar to itself. */}
          <View style={styles.appBarRow}>
            {searchPill}
            <Pressable
              onPress={() => navigation.navigate('SavedItems')}
              accessibilityRole="button"
              accessibilityLabel="Saved items"
              hitSlop={8}
            >
              <Ionicons name="heart-outline" size={21} color={colors.white} accessible={false} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('BuyerProfile')}
              accessibilityRole="button"
              accessibilityLabel="Open Profile"
              hitSlop={8}
            >
              <Ionicons name="person-circle-outline" size={23} color={colors.white} accessible={false} />
            </Pressable>
          </View>
        </View>

        {/* Fades + rises in once on first load — see the file's own note.
            `gap` lives here now (not on `scrollContent`) since this is the
            single flex child the ScrollView actually lays out. */}
        <Animated.View
          style={[styles.contentFade, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}
        >
        {/* Categories lead — every one of these apps puts the icon grid above
            the fold, because it is the fastest route into a catalogue for
            someone who already knows their trade. The promo sits BELOW it. */}
        {categories.length > 0 ? (
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <Text style={styles.blockTitle}>Categories</Text>
              <Pressable onPress={() => navigation.navigate('CategoryBrowse')} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.blockLink}>All {categories.length}+ ›</Text>
              </Pressable>
            </View>
            <View style={styles.catGrid}>
              {categories.slice(0, 7).map((cat) => (
                <CategoryTile
                  key={cat.id}
                  cat={cat}
                  onPress={() => navigation.navigate('CategoryProducts', { categoryId: cat.id, categoryName: cat.name })}
                />
              ))}
              <Pressable
                onPress={() => navigation.navigate('CategoryBrowse')}
                accessibilityRole="button"
                accessibilityLabel="All categories"
                // Not wrapped in PressScaleButton, so it carries BOTH the
                // tile layout and the 25% column width.
                // 🔴 ORDER MATTERS: `catItem` sets width 100% (it is normally
                // the inner view filling a 25% touchable), so the 25% must come
                // AFTER it to win. Reversed, this tile took the full row and
                // "All" dropped to a line of its own.
                style={({ pressed }) => [styles.catItem, styles.catItemTouchable, pressed && styles.pressedOpacity]}
              >
                <View style={[styles.catCircle, styles.catAll]}>
                  <Ionicons name="ellipsis-horizontal" size={23} color={colors.primary[700]} accessible={false} />
                </View>
                <Text style={styles.catLabel} numberOfLines={1}>
                  All
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ✨ The ONE coloured band on the screen. AI search is the thing a
            buyer cannot do on a rival marketplace, so it gets the emphasis —
            and spending that effect twice would make neither read as special.
            Solid navy, not a gradient: a gradient needs `expo-linear-gradient`
            and no dependency was added for a visual. */}
        <Pressable
          onPress={() => navigation.navigate('BuyerAi')}
          accessibilityRole="button"
          accessibilityLabel="AI search"
          style={({ pressed }) => [styles.aiBand, pressed && styles.aiBandPressed]}
        >
          <View style={styles.aiBandIcon}>
            <Ionicons name="sparkles" size={19} color={colors.white} accessible={false} />
          </View>
          <View style={styles.aiBandText}>
            <Text style={styles.aiBandTitle}>Describe what you need</Text>
            <Text style={styles.aiBandExample} numberOfLines={1}>
              “selvedge denim, 100 m, under $4”
            </Text>
          </View>
          <View style={styles.aiBandCta}>
            <Text style={styles.aiBandCtaText}>Try AI</Text>
          </View>
        </Pressable>

        {/* 🔴 The old in-page search row and the three QuickTiles are GONE:
            search now lives in the blue app bar (and its sticky twin), and
            Browse / Goods / Services are covered by the category grid above
            plus the Goods-vs-Services split below. Keeping either would have
            put the same destination on the screen twice. */}

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
        {/* 🔴 This wrapper restores the `spacing[5]` side padding that
            `scrollContent` used to provide. `PROMO_PAGE_WIDTH` is computed as
            `screenWidth - spacing[5] * 2`, so the moment the page lost its
            padding the paging math no longer matched the container and the
            previous slide's edge showed through on the left — the exact drift
            the constant's own note was written to prevent. Padding the
            carousel's own container keeps that math correct rather than
            re-deriving it. */}
        <View style={styles.promoWrap}>
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
        </View>

        {/* 🔴 KEEP. Not in the marketplace mockup, but this is the buyer's ONLY
            in-app route to the Verification hub — dropping it for a visual
            refresh would remove real functionality, which is exactly what the
            previous version of this screen warned against.
            It sits here rather than at the top on purpose: a buyer is fully
            active from signup and verification gates nothing for them (D3), so
            it belongs below the discovery surface, not above it. The component
            renders every status (pending / submitted / verified / rejected)
            and shows nothing shout-y once verified. */}
        <View style={styles.block}>
          <VerificationSummaryCard
            status={status}
            verification={state.verification}
            onPress={() => navigation.navigate('KycHub')}
          />
        </View>

        {/* Goods vs Services — equal weight, because the live catalogue is
            currently MOSTLY services (website development, DevOps retainers,
            marketing) alongside the fabric. A layout that assumed goods would
            misrepresent the platform to its first buyers. Both are real
            filters (`CategoryBrowseScreen`'s typeFilter). */}
        <View style={styles.block}>
          <View style={styles.splitRow}>
            <Pressable
              onPress={() => navigation.navigate('CategoryBrowse', { typeFilter: 'goods' })}
              accessibilityRole="button"
              accessibilityLabel="Physical goods"
              style={({ pressed }) => [styles.split, styles.splitGoods, pressed && styles.pressedOpacity]}
            >
              <Ionicons name="cube-outline" size={19} color={colors.primary[800]} accessible={false} />
              <View style={styles.splitText}>
                <Text style={styles.splitGoodsTitle}>Goods</Text>
                <Text style={styles.splitGoodsSub} numberOfLines={1}>
                  Denim, leather, chemicals
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('CategoryBrowse', { typeFilter: 'service' })}
              accessibilityRole="button"
              accessibilityLabel="Business services"
              style={({ pressed }) => [styles.split, styles.splitServices, pressed && styles.pressedOpacity]}
            >
              <Ionicons name="briefcase-outline" size={19} color="#05603A" accessible={false} />
              <View style={styles.splitText}>
                <Text style={styles.splitServicesTitle}>Services</Text>
                <Text style={styles.splitServicesSub} numberOfLines={1}>
                  Dev, marketing, QC
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {suppliers.length > 0 ? (
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <Text style={styles.blockTitle}>Verified suppliers</Text>
              <Pressable onPress={() => navigation.navigate('BuyerSearch')} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.blockLink}>See all ›</Text>
              </Pressable>
            </View>
            {/* Not "Top-rated" — no rating/review system exists on this
                product to back that claim. */}
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

        {/* The feed's heading. The products themselves are the FlatList's own
            data below — NOT rendered here — so they virtualise. */}
        {products.length > 0 ? (
          <View style={[styles.block, styles.feedHead]}>
            <View style={styles.blockHead}>
              <Text style={styles.blockTitle}>Recently listed</Text>
              <Pressable onPress={() => navigation.navigate('BuyerSearch')} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.blockLink}>See all ›</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </>
  );

  /* Foot of the feed — a spinner while a page is in flight, then the honest
     end-of-catalogue line, then the sell card. */
  const listFooter = (
    <View style={styles.footer}>
      {loadingMore ? (
        <View style={styles.footerSpinner}>
          <ActivityIndicator color={colors.primary[600]} />
        </View>
      ) : allProductsLoaded && products.length > PRODUCT_PAGE_SIZE ? (
        <Text style={styles.footerEnd}>You&apos;ve seen everything listed so far</Text>
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
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* 🔴 A FlatList, not a ScrollView. The feed below is unbounded, and a
          ScrollView keeps every row mounted — which is exactly the lag that
          hit the Browse Categories screen on 2026-08-18. Everything above the
          feed rides along as `ListHeaderComponent`. */}
      <Animated.FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.feedRow}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={openProduct}
            savedId={savedIndex[item.id]}
            onToggleSave={toggleSave}
            style={styles.feedSlot}
          />
        )}
        onEndReached={loadMoreProducts}
        // Half a screen of runway: enough that the next page usually lands
        // before the buyer reaches the bottom, without pre-fetching pages
        // nobody scrolls to.
        onEndReachedThreshold={0.5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
        }
      />
      {scrollHeader}
    </View>
  );
}

// Shared tap-bounce — `Pressable` itself can't animate (only
// `Animated.createAnimatedComponent`-wrapped components react to an
// `Animated.Value`), so this is a plain `Pressable` for touch + layout
// sizing (`touchableStyle`) wrapping an `Animated.View` that carries the
// visual style plus the scale transform. Used by `CategoryTile`
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
      touchableStyle={styles.catItemTouchable}
      style={styles.catItem}
    >
      {cat.image ? (
        <Image source={{ uri: cat.image }} style={styles.catCircle} />
      ) : (
        <View style={[styles.catCircle, styles.imageFallback]}>
          <Ionicons name="image-outline" size={18} color={colors.ink[400]} accessible={false} />
        </View>
      )}
      {/* ONE line with an ellipsis (owner, 2026-08-21, having seen the
          three-line version on device). It keeps the grid rows an even
          height, which is what these apps do; the trade is that the longer
          seeded names truncate ("Textiles, Fabrics & Yarn" → "Textiles,…").
          The image is doing most of the identifying anyway. */}
      <Text style={styles.catLabel} numberOfLines={1}>
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
  // 🔴 The page ground is now GREY, with white blocks floating on it — the
  // standard marketplace-app treatment (owner, 2026-08-21). It separates
  // sections without putting a border on every one of them.
  screen: { flex: 1, backgroundColor: colors.ink[50] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // No horizontal padding: the app bar and every white block bleed to the
  // screen edges and own their own inner padding.
  scrollContent: { paddingBottom: spacing[8] },
  contentFade: { gap: spacing[2] },

  // --- blue app bar ----------------------------------------------------
  appBar: { backgroundColor: colors.primary[700], paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  // Search pill + its actions on one line. The pill flexes; the icons keep
  // their intrinsic width, so a narrow phone shortens the field rather than
  // pushing an action off the edge.
  appBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },


  // --- white content blocks -------------------------------------------
  block: { backgroundColor: colors.surface.DEFAULT, paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  blockTitle: { ...typography.label, fontWeight: '800', color: colors.ink[900] },
  blockLink: { ...typography.tiny, fontWeight: '700', color: colors.primary[600] },

  // --- category grid ---------------------------------------------------
  catGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 🔴 The 25% lives on the TOUCHABLE only. `catItem` is the inner animated
  // view inside it (see `PressScaleButton`), so giving that 25% too made each
  // tile a quarter of a quarter — the labels were left ~22px wide and broke
  // mid-word ("Agri / cult / ure"). Caught on device, 2026-08-21.
  catItemTouchable: { width: '25%' },
  catItem: { width: '100%', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[3] },
  promoWrap: {
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  // 56, up from 46 (owner, 2026-08-21). The column is ~82dp wide at 4-across
  // on a 360dp screen, so this is about as large as the circle can go before
  // it starts crowding the label beneath it.
  catCircle: { width: 56, height: 56, borderRadius: radii.full, backgroundColor: colors.ink[100] },
  catAll: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[50] },
  // Semibold, and one line only — with a single line there is room to sit a
  // step up from `tiny`, which stops the label reading as a caption under the
  // now-larger circle.
  catLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.ink[800],
    textAlign: 'center',
  },

  // --- AI band (the one coloured block) --------------------------------
  aiBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.primary[800],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  aiBandPressed: { backgroundColor: colors.primary[900] },
  aiBandIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBandText: { flex: 1, minWidth: 0 },
  aiBandTitle: { ...typography.label, fontWeight: '800', color: colors.white },
  aiBandExample: { ...typography.tiny, color: colors.primary[200], fontStyle: 'italic', marginTop: 1 },
  aiBandCta: { backgroundColor: colors.white, borderRadius: radii.full, paddingVertical: 6, paddingHorizontal: spacing[3] },
  aiBandCtaText: { ...typography.tiny, fontWeight: '800', color: colors.primary[800] },

  // --- goods / services -------------------------------------------------
  splitRow: { flexDirection: 'row', gap: spacing[2] },
  split: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: radii.md, padding: spacing[3] },
  splitGoods: { backgroundColor: colors.primary[50] },
  splitServices: { backgroundColor: '#E6F7EF' },
  splitText: { flex: 1, minWidth: 0 },
  splitGoodsTitle: { ...typography.caption, fontWeight: '800', color: colors.primary[800] },
  splitGoodsSub: { ...typography.tiny, color: '#43539F', marginTop: 1 },
  splitServicesTitle: { ...typography.caption, fontWeight: '800', color: '#05603A' },
  splitServicesSub: { ...typography.tiny, color: '#357056', marginTop: 1 },

  // --- product grid -----------------------------------------------------
  // --- endless product feed -------------------------------------------
  // The feed is the FlatList's own data, so it sits on the white block colour
  // rather than inside one — the heading block above it closes the white run.
  feedHead: { paddingBottom: spacing[2] },
  feedRow: {
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
  },
  feedSlot: { flex: 1 },
  footer: { backgroundColor: colors.surface.DEFAULT, paddingTop: spacing[2] },
  footerSpinner: { paddingVertical: spacing[5], alignItems: 'center' },
  footerEnd: {
    ...typography.caption,
    color: colors.ink[400],
    textAlign: 'center',
    paddingVertical: spacing[5],
  },

  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    // Matches the app bar it replaces on scroll, so the transition reads as
    // the same bar condensing rather than a different one appearing.
    backgroundColor: colors.primary[700],
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




  // `flex: 1` lives on the touchable (Pressable) now, not the animated inner
  // view — see `usePressScale`'s own note on why the two are split.
  quickTileTouchable: { flex: 1 },
  // Actions, not information — so these keep a visible target, but they now
  // read as BUTTONS (soft fill, tighter radius) rather than as three more
  // cards competing with the product cards further down.
  quickTile: {
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radii.md,
    backgroundColor: colors.ink[50],
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
    // 🔴 FIXED height, not `minHeight`. The three slides' titles run 3, 2 and 2
    // lines, so a min-height let each one size itself — and the carousel
    // visibly JUMPED as it auto-advanced between them. A fixed height makes
    // every cover identical, which is the whole point of a paged banner.
    // 200, up from 158 (owner, 2026-08-21). The slide is ~320dp wide, so this
    // sits near 8:5 — big enough to carry the banner, short enough that the
    // categories above it still share the first screen.
    height: 200,
  },
  // Type steps up with the slide — a taller banner carrying the same small
  // headline just reads as a card with a lot of empty blue in it.
  promoTitle: { ...typography.h1, color: colors.white, marginBottom: spacing[2] },
  promoSubtitle: { ...typography.body, color: colors.primary[100] },
  // 🔴 Positive margin. This was `-spacing[2]`, which worked when the page's
  // own `gap` sat between the carousel and the dots — the negative pulled them
  // back up into that space. Once the carousel moved into `promoWrap` there was
  // no gap to cancel, so the -8 dragged the dots ON TOP of the slide.
  promoDots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginTop: spacing[3] },
  promoDot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.ink[200] },
  promoDotActive: { backgroundColor: colors.primary[600], width: 18 },

  // Full-bleed rails — ALL three horizontal rows (Explore Categories,
  // Verified Suppliers, Recently Listed — owner extended it to the other two
  // 2026-08-18): cancels `scrollContent`'s paddingHorizontal (spacing[5]) so
  // each rail's viewport reaches the screen edges, then restores it as
  // content padding so the first/last card still lines up with the headings.
  railBleed: { marginHorizontal: -spacing[5] },
  railContent: { gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[1] },

  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink[100] },

  miniCard: {
    width: MINI_CARD_WIDTH,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    overflow: 'hidden',
  },
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
