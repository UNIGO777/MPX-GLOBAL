import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { EmptyState, ErrorState, Spinner } from '../components/Feedback.jsx';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 1 — Category browse. Buyer-only, reached from Buyer Home.
 *
 * 🆕 2026-08-17 (round 3) — rebuilt FULL-PAGE + de-lagged (owner: "not make
 * this page in two portion make it in full page and also this page is two
 * much lagging… redesign it again… more professional"):
 *
 * - **No more NavyCanopy** — the navy-canopy + white-sheet split was the "two
 *   portions" the owner flagged. This screen now draws its own single white
 *   page (same deliberate departure Profile and Buyer Home already made),
 *   with its own back button since the stack renders no native header.
 *
 * - **The lag was real and structural**: the previous version rendered all
 *   40 sections — ~260 sub-category chips, each carrying its own Cloudinary
 *   `Image` — inside ONE plain ScrollView (NavyCanopy's sheet), so ~300
 *   remote images mounted at once and every search keystroke re-rendered the
 *   entire tree. Fixed two ways:
 *   1. `FlatList` (virtualized: only the visible sections mount; typing
 *      re-renders ~3 rows, not 40) with a `memo`ized row component.
 *   2. Sub-category chips are now TEXT-ONLY — that alone drops ~260 remote
 *      images to the 40 section thumbnails. A deliberate deviation from the
 *      web page's phone view (its chips carry 20px thumbs): on this list the
 *      images were the lag, and the owner's "professional" ask outranks
 *      literal parity. Layout parity (sections + wrapping chip pills +
 *      local search) is kept.
 *
 * - Search input stays PINNED outside the FlatList (not a ListHeader) so it
 *   can't unmount and drop focus while the list virtualizes.
 *
 * Tapping a section header or a chip opens the REAL product listing
 * (`CategoryProductsScreen`, M2 screen 2 — 2026-08-17; it replaced the
 * interim `CategoryComingSoon` landing, deleted the same day).
 *
 * (carried over) `route.params.typeFilter` (`'goods' | 'service'`): §A16
 * stores `type` only on SUB-categories, so a top matches when at least one
 * of its subs does, and its section then shows only the matching subs.
 *
 * 🆕 2026-08-17 (round 4) — CHUNKED loading (owner: "dont load all the
 * categories at the time… ask categories in chunks and while the scroll load
 * those; web keeps asking in 1 time"). `GET /categories` grew an optional
 * `?limit/offset` mode server-side (no params = the original one-shot the web
 * app still uses, untouched); this screen now fetches `CHUNK_SIZE` tops at a
 * time and appends the next page from `onEndReached`. Two deliberate
 * exceptions where it still loads everything in one call:
 * - **typeFilter mode** — the goods/services filter drops whole tops
 *   client-side, so a chunk can contribute zero visible sections and
 *   `onEndReached` would stall (the list never grows, so it never re-fires).
 *   40 rows in one call is cheap; the original lag was RENDERING, which the
 *   FlatList already fixed.
 * - **search** — typing upgrades to a one-time full load first (tracked so it
 *   runs once), because filtering only the loaded chunks would silently lie
 *   about what matches. If that upgrade fails, an honest inline line says
 *   results may be incomplete instead of pretending.
 */
const CHUNK_SIZE = 10;

export function CategoryBrowseScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState({ loading: true, error: null, categories: [], hasMore: true, total: null });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [searchLoadError, setSearchLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const typeFilter = route?.params?.typeFilter ?? null;

  // Refs, not state, for the in-flight guards — `onEndReached` can fire again
  // before a state update lands, and a double-append duplicates a chunk.
  const loadingMoreRef = useRef(false);
  const fullLoadRef = useRef(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      setMoreError(false);
      setSearchLoadError(false);
      try {
        if (typeFilter) {
          // Full load — see the file note on why chunking + a top-dropping
          // client filter don't mix.
          const categories = await catalogueApi.tree();
          setState({ loading: false, error: null, categories, hasMore: false, total: categories.length });
        } else {
          const res = await catalogueApi.treeChunk({ limit: CHUNK_SIZE, offset: 0 });
          setState({
            loading: false,
            error: null,
            categories: res.categories,
            hasMore: res.hasMore,
            total: res.total,
          });
        }
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [typeFilter],
  );

  useEffect(() => {
    load();
  }, [load]);

  const { loading, error, categories, hasMore, total } = state;

  // Next chunk, appended — plain scroll only (search upgrades to a full load
  // below instead, and typeFilter mode never has `hasMore`).
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const res = await catalogueApi.treeChunk({ limit: CHUNK_SIZE, offset: categories.length });
      setState((s) => ({
        ...s,
        categories: [...s.categories, ...res.categories],
        hasMore: res.hasMore,
        total: res.total,
      }));
    } catch {
      // Not silent: the footer renders a visible retry row for this.
      setMoreError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, categories.length]);

  // A top has no `type` of its own (§A16 — leaf-only) — it matches a filter
  // when at least one of its real subs does.
  const tops = typeFilter ? categories.filter((top) => top.subs?.some((s) => s.type === typeFilter)) : categories;

  // Local filter over the loaded tree — NOT Module 3 search. Matches a
  // category or any of its sub-category names.
  const norm = query.trim().toLowerCase();
  const shown = norm
    ? tops.filter((c) => `${c.name} ${(c.subs ?? []).map((s) => s.name).join(' ')}`.toLowerCase().includes(norm))
    : tops;

  // Search over a partial list would silently lie about what matches — the
  // first keystroke upgrades to ONE full load (same call the web app makes),
  // after which `hasMore` is false and this never runs again.
  useEffect(() => {
    if (!norm || !hasMore || fullLoadRef.current) return;
    fullLoadRef.current = true;
    catalogueApi
      .tree()
      .then((all) => {
        setState((s) => ({ ...s, categories: all, hasMore: false, total: all.length }));
        setSearchLoadError(false);
      })
      .catch(() => {
        // Not silent: an inline line below the search bar owns this state.
        setSearchLoadError(true);
      })
      .finally(() => {
        fullLoadRef.current = false;
      });
  }, [norm, hasMore]);

  // Top header and sub chip both land on the REAL product listing (M2 screen
  // 2, 2026-08-17 — replaced the CategoryComingSoon stopgap). The server
  // resolves a top to all its leaf subs, so both work with just the id.
  const openCategory = useCallback(
    (cat) => {
      navigation.navigate('CategoryProducts', { categoryId: cat.id, categoryName: cat.name });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }) => <CategorySection category={item} typeFilter={typeFilter} onOpen={openCategory} />,
    [typeFilter, openCategory],
  );

  const filterLabel = typeFilter === 'goods' ? 'Physical goods' : typeFilter === 'service' ? 'Business services' : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Own header — full white page, no native header on this stack. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.ink[900]} />
          </Pressable>
          <View style={styles.headerText}>
            {filterLabel ? <Text style={styles.eyebrow}>{filterLabel}</Text> : null}
            <Text style={styles.title} numberOfLines={1}>
              Browse categories
            </Text>
          </View>
        </View>

        {/* Pinned outside the FlatList so virtualization can never unmount a
            focused input mid-typing. Same bar styling as Home's search. */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.ink[400]} accessible={false} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories or sub-categories…"
            placeholderTextColor={colors.ink[400]}
            style={styles.searchInput}
            accessibilityLabel="Find a category"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.ink[400]} accessible={false} />
            </Pressable>
          ) : null}
        </View>
        {searchLoadError && norm ? (
          <Text style={styles.searchWarning}>
            Couldn't load the full list — results may be incomplete. Pull down to retry.
          </Text>
        ) : null}
      </View>

      {loading && categories.length === 0 ? (
        <Spinner label="Loading categories…" />
      ) : error && categories.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          // Floor of spacing[6]: keeps the last row clear of Android's
          // translucent gesture-nav strip even when the inset reports 0
          // (the "bottom safe area" fix, 2026-08-18).
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          ListHeaderComponent={
            norm && shown.length > 0 ? (
              <Text style={styles.matchCount}>
                {shown.length} of {tops.length} categories match
              </Text>
            ) : null
          }
          ListEmptyComponent={
            categories.length === 0 ? (
              <EmptyState
                icon="cube-outline"
                title="No categories yet"
                message="The catalogue is being set up. Check back shortly."
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title={`Nothing matches "${query.trim()}"`}
                message="Try another word — the filter checks category and sub-category names."
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
          }
          onEndReached={norm ? undefined : loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
              </View>
            ) : moreError ? (
              <Pressable onPress={loadMore} accessibilityRole="button" style={styles.footerRetry}>
                <Text style={styles.footerRetryText}>Couldn't load more — tap to retry</Text>
              </Pressable>
            ) : null
          }
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

/** One category's header + its subs as wrapping text pills. Memoized so a
 *  search keystroke re-renders only the FlatList's visible rows whose data
 *  actually changed — this component was the lag when 40 of it mounted in a
 *  plain ScrollView. */
const CategorySection = memo(function CategorySection({ category, typeFilter, onOpen }) {
  const subs = typeFilter ? (category.subs ?? []).filter((s) => s.type === typeFilter) : (category.subs ?? []);

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => onOpen(category)}
        accessibilityRole="button"
        accessibilityLabel={category.name}
        style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressedOpacity]}
      >
        <Thumb category={category} />
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {category.name}
          </Text>
          <Text style={styles.sectionMeta}>
            {subs.length} {subs.length === 1 ? 'sub-category' : 'sub-categories'}
          </Text>
        </View>
      </Pressable>

      {subs.length > 0 ? (
        <View style={styles.chipRow}>
          {subs.map((sub) => (
            <Pressable
              key={sub.id}
              onPress={() => onOpen(sub)}
              accessibilityRole="button"
              accessibilityLabel={sub.name}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipLabel} numberOfLines={1}>
                {sub.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.noSubs}>No sub-categories yet.</Text>
      )}
    </View>
  );
});

/** Section thumbnail — the category's own photo, or the standard neutral
 *  fallback (never a coloured/monogram box). Only the 40 tops carry an image
 *  now; chip thumbs were removed for performance (see the file note). */
function Thumb({ category }) {
  if (category.image) {
    return <Image source={{ uri: category.image }} style={styles.thumb} />;
  }
  return (
    <View style={[styles.thumb, styles.thumbFallback]}>
      <Ionicons name="image-outline" size={20} color={colors.ink[400]} accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },

  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  eyebrow: { ...typography.label, color: colors.primary[700], letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { ...typography.h1, color: colors.ink[900] },

  searchBar: {
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
  searchInput: { flex: 1, ...typography.body, color: colors.ink[900], paddingVertical: spacing[2] },
  searchWarning: { ...typography.tiny, color: colors.warning, marginTop: spacing[2] },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[4], flexGrow: 1 },
  matchCount: { ...typography.caption, color: colors.muted, marginBottom: spacing[3] },

  section: { marginBottom: spacing[6] },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingBottom: spacing[3],
  },
  pressedOpacity: { opacity: 0.7 },
  sectionText: { flex: 1 },
  sectionTitle: { ...typography.h3, color: colors.ink[900] },
  sectionMeta: { ...typography.tiny, color: colors.muted, marginTop: 1 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    resizeMode: 'cover',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink[100] },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  chipPressed: { backgroundColor: colors.primary[50], borderColor: colors.primary[300] },
  chipLabel: { ...typography.caption, color: colors.primary[700], fontWeight: '600' },
  noSubs: { ...typography.caption, color: colors.muted },

  footerLoading: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetry: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetryText: { ...typography.caption, color: colors.primary[700], fontWeight: '600' },
});
