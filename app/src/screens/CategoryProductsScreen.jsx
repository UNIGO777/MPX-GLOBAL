import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { Button } from '../components/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { useSavedProducts } from '../hooks/useSavedProducts.js';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 2 — product listing / search results, one screen, two modes.
 *
 * 🆕 2026-08-17 (round 3) — rebuilt to an owner-supplied mockup ("make the
 * searching page like that… category wise search + direct search; AI search
 * will be a separate page"):
 * - **Header**: circular back button + a REAL pill search field — submitting
 *   re-runs this page with `q` (server combines `q` + `category`, so inside a
 *   category it genuinely searches within it). This is the app's first live
 *   product-search surface; the AI search page is a separate, later build.
 * - **Results line**: `Results for "{q}"` (search) or the category name,
 *   with the server's real `{total} results` in primary as the right accent.
 * - **Grid**: the shared `ProductCard` (borderless, image-first — see that
 *   component for the mockup-vs-honesty notes; Home's rail uses the SAME
 *   component so the two can never drift).
 * - **Hearts are real** — M3 saved items, same API as web: the saved index
 *   loads with the page, toggles are optimistic with visible rollback + a
 *   toast on failure, never a decorative heart.
 * - **Loading**: skeleton grid (not a blank spinner page).
 *
 * Pagination: 20/page appended from `onEndReached`, ref-guarded (it re-fires
 * before setState lands; a double-append duplicates a page).
 *
 * ⚠️ Card tap = honest "coming soon" alert until product detail (M2 screen 3)
 * ships — ledgered in `docs/UiWebNotes.md`.
 */
const PAGE_SIZE = 20;

// 🆕 2026-08-18 — filters (owner ask). Server-truth options only: `sort` is
// the engine's own enum, and the price sorts NEVER drop results — the server
// tiers them (selected currency first → other currencies → price-on-request
// last), so the sheet's sub-copy states that instead of pretending prices
// across currencies are comparable (§A27.1). "On request only" maps to the
// engine's `onRequest` toggle. No fabricated options (no "popularity", no
// "rating" — nothing exists to back either).
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first', hint: null },
  { value: 'priceAsc', label: 'Price: low to high', hint: 'INR first, other currencies after, on-request last' },
  { value: 'priceDesc', label: 'Price: high to low', hint: 'INR first, other currencies after, on-request last' },
];

export function CategoryProductsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { categoryId, categoryName, query: initialQuery } = route.params ?? {};

  const [draft, setDraft] = useState(initialQuery ?? '');
  const [activeQuery, setActiveQuery] = useState(initialQuery ?? '');
  const [sort, setSort] = useState('newest');
  const [onRequestOnly, setOnRequestOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // Sheet edits a draft; nothing re-queries until Apply.
  const [draftSort, setDraftSort] = useState('newest');
  const [draftOnRequest, setDraftOnRequest] = useState(false);
  const [state, setState] = useState({ loading: true, error: null, products: [], total: 0, page: 1 });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const { savedIndex, loadIndex, toggleSave } = useSavedProducts();
  const loadingMoreRef = useRef(false);

  const baseParams = useCallback(
    () => ({
      type: 'product',
      sort,
      pageSize: PAGE_SIZE,
      ...(categoryId ? { category: categoryId } : {}),
      ...(activeQuery ? { q: activeQuery } : {}),
      ...(onRequestOnly ? { onRequest: 'true' } : {}),
    }),
    [categoryId, activeQuery, sort, onRequestOnly],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      setMoreError(false);
      try {
        const [res] = await Promise.all([catalogueApi.search({ ...baseParams(), page: 1 }), loadIndex()]);
        setState({ loading: false, error: null, products: res.products ?? [], total: res.total ?? 0, page: 1 });
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [baseParams, loadIndex],
  );

  useEffect(() => {
    load();
  }, [load]);

  const { loading, error, products, total, page } = state;
  const hasMore = products.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = page + 1;
      const res = await catalogueApi.search({ ...baseParams(), page: next });
      setState((s) => ({
        ...s,
        products: [...s.products, ...(res.products ?? [])],
        total: res.total ?? s.total,
        page: next,
      }));
    } catch {
      // Not silent: the footer renders a visible retry row for this.
      setMoreError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, page, baseParams]);

  // 2026-08-18 — real destination at last: M2 screen 3.
  const openProduct = useCallback(
    (product) => {
      navigation.navigate('ProductDetail', { idOrSlug: product.slug ?? product.id });
    },
    [navigation],
  );

  const submitSearch = useCallback(() => {
    setActiveQuery(draft.trim());
  }, [draft]);

  const renderItem = useCallback(
    ({ item }) => (
      <ProductCard
        product={item}
        onPress={openProduct}
        savedId={savedIndex[item.id]}
        onToggleSave={toggleSave}
        style={styles.gridSlot}
      />
    ),
    [openProduct, savedIndex, toggleSave],
  );

  const heading = activeQuery ? `Results for "${activeQuery}"` : categoryName ?? 'Products';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backCircle}
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink[900]} />
          </Pressable>
          <View style={styles.searchPill}>
            <Ionicons name="search" size={18} color={colors.ink[500]} accessible={false} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submitSearch}
              placeholder={categoryName ? `Search in ${categoryName}…` : 'Search products…'}
              placeholderTextColor={colors.ink[400]}
              style={styles.searchInput}
              accessibilityLabel="Search products"
              returnKeyType="search"
            />
            {draft ? (
              <Pressable
                onPress={() => {
                  setDraft('');
                  setActiveQuery('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.ink[400]} accessible={false} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              setDraftSort(sort);
              setDraftOnRequest(onRequestOnly);
              setFilterOpen(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Filters"
            style={styles.filterCircle}
          >
            <Ionicons name="options-outline" size={20} color={colors.ink[900]} accessible={false} />
            {sort !== 'newest' || onRequestOnly ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>

        <View style={styles.resultsRow}>
          <Text style={styles.heading} numberOfLines={1}>
            {heading}
          </Text>
          {!loading && !error ? (
            <Text style={styles.resultCount}>
              {total} {total === 1 ? 'result' : 'results'}
            </Text>
          ) : null}
        </View>
      </View>

      {loading && products.length === 0 ? (
        <SkeletonGrid />
      ) : error && products.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          // Floor of spacing[6] keeps the last row clear of Android's
          // translucent gesture-nav strip even when the inset reports 0 —
          // the "bottom safe area" fix (owner, 2026-08-18), applied to every
          // pushed catalogue screen.
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          ListEmptyComponent={
            <EmptyState
              icon={activeQuery ? 'search-outline' : 'cube-outline'}
              title={activeQuery ? 'No products match' : 'No products in this category yet'}
              message={
                activeQuery
                  ? 'Try a different word or browse the categories instead.'
                  : 'Sellers are still listing — check back shortly.'
              }
              actionLabel="Browse categories"
              onAction={() => navigation.goBack()}
            />
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
          }
          onEndReached={loadMore}
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
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter sheet — drafts apply only on the Apply button. */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.sheetScrim}>
          <Pressable style={styles.sheetScrimTouch} onPress={() => setFilterOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
            <Text style={styles.sheetTitle}>Filters</Text>

            <Text style={styles.sheetSection}>Sort by</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setDraftSort(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: draftSort === opt.value }}
                style={styles.sortRow}
              >
                <View style={[styles.radio, draftSort === opt.value && styles.radioActive]}>
                  {draftSort === opt.value ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.sortText}>
                  <Text style={styles.sortLabel}>{opt.label}</Text>
                  {opt.hint ? <Text style={styles.sortHint}>{opt.hint}</Text> : null}
                </View>
              </Pressable>
            ))}

            <View style={styles.switchRow}>
              <View style={styles.sortText}>
                <Text style={styles.sortLabel}>"Price on request" only</Text>
                <Text style={styles.sortHint}>Show only listings without a published price</Text>
              </View>
              <Switch
                value={draftOnRequest}
                onValueChange={setDraftOnRequest}
                trackColor={{ false: colors.ink[200], true: colors.primary[300] }}
                thumbColor={draftOnRequest ? colors.primary[600] : colors.white}
              />
            </View>

            <View style={styles.sheetActions}>
              <View style={styles.sheetActionButton}>
                <Button
                  label="Reset"
                  variant="secondary"
                  onPress={() => {
                    setDraftSort('newest');
                    setDraftOnRequest(false);
                  }}
                />
              </View>
              <View style={styles.sheetActionButton}>
                <Button
                  label="Apply"
                  onPress={() => {
                    setSort(draftSort);
                    setOnRequestOnly(draftOnRequest);
                    setFilterOpen(false);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Loading state — grey card shapes in the same grid, not a blank spinner. */
function SkeletonGrid() {
  return (
    <View style={styles.skeletonWrap} accessibilityRole="progressbar" accessibilityLabel="Loading products">
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={styles.skeletonCell}>
          <Skeleton width="100%" height={160} radius={radii.lg} />
          <Skeleton width="85%" height={14} style={styles.skeletonLine} />
          <Skeleton width="55%" height={12} style={styles.skeletonLine} />
          <Skeleton width="40%" height={18} style={styles.skeletonLine} />
        </View>
      ))}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
    paddingHorizontal: spacing[4],
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink[900], paddingVertical: spacing[2] },
  filterCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
  },

  sheetScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheetScrimTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  sheetTitle: { ...typography.h3, color: colors.ink[900], marginBottom: spacing[3] },
  sheetSection: { ...typography.label, color: colors.muted, marginBottom: spacing[2] },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary[600] },
  radioInner: { width: 10, height: 10, borderRadius: radii.full, backgroundColor: colors.primary[600] },
  sortText: { flex: 1 },
  sortLabel: { ...typography.body, color: colors.ink[900] },
  sortHint: { ...typography.tiny, color: colors.muted, marginTop: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
  },
  sheetActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  sheetActionButton: { flex: 1 },

  resultsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  heading: { ...typography.h2, color: colors.ink[900], flexShrink: 1 },
  resultCount: { ...typography.label, color: colors.primary[600] },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[4], flexGrow: 1 },
  columnWrap: { gap: spacing[4] },
  gridSlot: { flex: 1, maxWidth: '48%', marginBottom: spacing[5] },

  skeletonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  skeletonCell: { width: '47%' },
  skeletonLine: { marginTop: spacing[2] },

  footerLoading: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetry: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetryText: { ...typography.caption, color: colors.primary[700], fontWeight: '600' },
});
