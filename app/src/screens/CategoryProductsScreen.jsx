import { useCallback, useEffect, useRef, useState } from 'react';
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
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import {
  DEFAULT_FILTERS,
  SearchFiltersModal,
  countActiveFilters,
  filterParams,
} from '../components/SearchFiltersModal.jsx';
import { findCountry } from '../constants/countries.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSavedProducts } from '../hooks/useSavedProducts.js';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 2 + M3 app screen 2 — ONE results surface for category
 * arrivals, keyword search, and (M3, 2026-08-19) supplier search.
 *
 * M3 upgrade, matching the web flow (§0.2 decisions copied, not re-decided):
 * - The quick sort/on-request sheet grew into the FULL-SCREEN filters modal
 *   (screen 3, `SearchFiltersModal`) — server facets, live count, apply-on-
 *   "Show results".
 * - **Products | Suppliers toggle** in search mode (hidden on a category
 *   arrival — the category IS the context). Switching to suppliers DROPS
 *   product filters visibly — the chip row clears; supplier mode's filter
 *   set is only Country + Verified (§A27.3, the server 400s anything else).
 * - **Active-filter chips** above the list, each removable; a control that
 *   already shows its own state (the search pill, the category title) is
 *   never repeated as a chip.
 * - **A new search clears previous filters** — otherwise a fresh query
 *   silently returns nothing.
 * - **Price sort note**: sorting by price never drops rows — the note under
 *   the toolbar says the tier order out loud.
 * - **`didYouMean`** renders on zero results as a tappable suggestion.
 * - 🔴 Hearts are BUYER-ONLY and absent otherwise (§A13/§7) — an exporter
 *   session gets no heart at all, never a disabled one. This also fixed a
 *   real bug: the heart used to render for exporters and the server would
 *   have 403'd the tap.
 */
const PAGE_SIZE = 20;

export function CategoryProductsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { categoryId, categoryName, query: initialQuery, initialType } = route.params ?? {};
  const isBuyer = role === 'buyer';

  const [draft, setDraft] = useState(initialQuery ?? '');
  const [activeQuery, setActiveQuery] = useState(initialQuery ?? '');
  const [type, setType] = useState(initialType === 'supplier' ? 'supplier' : 'product');
  // A category ARRIVAL defaults to newest-first (the M2 listing contract —
  // "products of one sub-category, newest first"); relevance is the default
  // only where there is a query for it to rank by.
  const contextDefaults = useCallback(
    () => (categoryId ? { ...DEFAULT_FILTERS, sort: 'newest' } : DEFAULT_FILTERS),
    [categoryId],
  );
  const [filters, setFilters] = useState(contextDefaults);
  const [filterOpen, setFilterOpen] = useState(false);
  const [state, setState] = useState({ loading: true, error: null, rows: [], total: 0, page: 1, didYouMean: null });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const { savedIndex, loadIndex, toggleSave } = useSavedProducts();
  const loadingMoreRef = useRef(false);

  // The screen's non-filter params — the filters modal scopes its facets and
  // live count by these, so the numbers it shows are for THIS context.
  const baseParams = useCallback(
    () => ({
      type,
      sort: filters.sort ?? (activeQuery ? 'relevance' : 'newest'),
      pageSize: PAGE_SIZE,
      ...(categoryId && type === 'product' ? { category: categoryId } : {}),
      ...(activeQuery ? { q: activeQuery } : {}),
    }),
    [categoryId, activeQuery, type, filters.sort],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      setMoreError(false);
      try {
        const [res] = await Promise.all([
          catalogueApi.search({ ...baseParams(), ...filterParams(filters), page: 1 }),
          isBuyer ? loadIndex() : Promise.resolve(),
        ]);
        setState({
          loading: false,
          error: null,
          rows: (type === 'supplier' ? res.suppliers : res.products) ?? [],
          total: res.total ?? 0,
          page: 1,
          didYouMean: res.didYouMean ?? null,
        });
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [baseParams, filters, type, isBuyer, loadIndex],
  );

  useEffect(() => {
    load();
  }, [load]);

  const { loading, error, rows, total, page, didYouMean } = state;
  const hasMore = rows.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = page + 1;
      const res = await catalogueApi.search({ ...baseParams(), ...filterParams(filters), page: next });
      setState((s) => ({
        ...s,
        rows: [...s.rows, ...((type === 'supplier' ? res.suppliers : res.products) ?? [])],
        total: res.total ?? s.total,
        page: next,
      }));
    } catch {
      setMoreError(true); // visible retry row — never silent
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, page, baseParams, filters, type]);

  const submitSearch = useCallback(() => {
    // A new search clears previous filters (§0.2) — otherwise a fresh query
    // silently inherits narrowing that returns nothing.
    setFilters(contextDefaults());
    setActiveQuery(draft.trim());
  }, [draft, contextDefaults]);

  const switchType = (next) => {
    if (next === type) return;
    // Product filters are meaningless in supplier mode — drop them VISIBLY
    // (the chip row clears) rather than silently sending params the server
    // would 400.
    setFilters(contextDefaults());
    setType(next);
  };

  const openProduct = useCallback(
    (product) => navigation.navigate('ProductDetail', { idOrSlug: product.slug ?? product.id }),
    [navigation],
  );
  const openSupplier = useCallback(
    (s) => navigation.navigate('SupplierProfile', { idOrSlug: s.slug ?? s.id }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }) =>
      type === 'supplier' ? (
        <SupplierRow supplier={item} onPress={() => openSupplier(item)} />
      ) : (
        <ProductCard
          product={item}
          onPress={openProduct}
          savedId={isBuyer ? savedIndex[item.id] : undefined}
          // 🔴 Buyer-only — absent for everyone else, never disabled (§7).
          onToggleSave={isBuyer ? toggleSave : undefined}
          style={styles.gridSlot}
        />
      ),
    [type, openProduct, openSupplier, savedIndex, toggleSave, isBuyer],
  );

  // Removable chips for applied filters (controls with their own visible
  // state — the pill, the title — are never repeated here).
  const chips = buildChips(filters, type);
  const removeChip = (chip) => setFilters((f) => chip.remove(f));

  const heading = activeQuery
    ? `Results for "${activeQuery}"`
    : categoryName ?? (type === 'supplier' ? 'Suppliers' : 'Products');
  const priceSorted = filters.sort === 'priceAsc' || filters.sort === 'priceDesc';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.canGoBack() && navigation.goBack()}
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
              placeholder={categoryName ? `Search in ${categoryName}…` : 'Search products or suppliers…'}
              placeholderTextColor={colors.ink[400]}
              style={styles.searchInput}
              accessibilityLabel="Search"
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
            onPress={() => setFilterOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Filters"
            style={styles.filterCircle}
          >
            <Ionicons name="options-outline" size={20} color={colors.ink[900]} accessible={false} />
            {countActiveFilters(filters) > 0 ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>

        {/* Products | Suppliers — search mode only; a category arrival's
            context IS the category. */}
        {!categoryId ? (
          <View style={styles.typeRow}>
            {[
              { key: 'product', label: 'Products' },
              { key: 'supplier', label: 'Suppliers' },
            ].map((t) => {
              const active = type === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => switchType(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.typeTab, active && styles.typeTabActive]}
                >
                  <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

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

        {chips.length > 0 ? (
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <Pressable
                key={chip.key}
                onPress={() => removeChip(chip)}
                accessibilityRole="button"
                accessibilityLabel={`Remove filter ${chip.label}`}
                style={styles.appliedChip}
              >
                <Text style={styles.appliedChipText}>{chip.label}</Text>
                <Ionicons name="close" size={12} color={colors.primary[700]} accessible={false} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {priceSorted ? (
          <Text style={styles.sortNote}>
            Sorted by price in {filters.currency}; other currencies and price-on-request after.
          </Text>
        ) : null}
      </View>

      {loading && rows.length === 0 ? (
        <SkeletonGrid supplierMode={type === 'supplier'} />
      ) : error && rows.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          {...(type === 'supplier' ? {} : { numColumns: 2, columnWrapperStyle: styles.columnWrap })}
          key={type} // numColumns can't change on the fly — remount per mode
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={activeQuery ? 'search-outline' : 'cube-outline'}
                title={type === 'supplier' ? 'No suppliers match' : activeQuery ? 'No products match' : 'No products in this category yet'}
                /* 🔴 Say WHY, exactly as web does. The engine is native
                   MongoDB `$text`, which matches WHOLE WORDS — "cand" can
                   never match "candles", and there is no prefix/as-you-type
                   search (ruled out with Atlas, §A26). Without this line a
                   partial word reads as "search is broken" — which is what
                   the owner reported on 2026-08-20. */
                message={
                  activeQuery
                    ? `Search matches whole words — try a different word${
                        countActiveFilters(filters) > 0 ? ', or remove a filter' : ''
                      }.`
                    : 'Sellers are still listing — check back shortly.'
                }
                actionLabel={countActiveFilters(filters) > 0 ? 'Clear filters' : undefined}
                onAction={countActiveFilters(filters) > 0 ? () => setFilters(contextDefaults()) : undefined}
              />
              {/* 🔴 `didYouMean` is an OBJECT `{ term, categorySlug }`, not a
                  string — rendering it directly crashed with "Objects are not
                  valid as a React child" (caught on device 2026-08-20).
                  `term` re-runs the search; `categorySlug` is web's second
                  path out of a dead end, so it is offered here too. */}
              {didYouMean?.term ? (
                <Pressable
                  onPress={() => {
                    setDraft(didYouMean.term);
                    setFilters(contextDefaults());
                    setActiveQuery(didYouMean.term);
                  }}
                  accessibilityRole="button"
                  style={styles.didYouMean}
                >
                  <Text style={styles.didYouMeanText}>
                    Did you mean <Text style={styles.didYouMeanWord}>{didYouMean.term}</Text>?
                  </Text>
                </Pressable>
              ) : null}
              {didYouMean?.categorySlug ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate('CategoryProducts', {
                      categoryId: didYouMean.categorySlug,
                      categoryName: didYouMean.term ?? 'Category',
                    })
                  }
                  accessibilityRole="button"
                  style={styles.didYouMean}
                >
                  <Text style={styles.didYouMeanText}>
                    Or browse <Text style={styles.didYouMeanWord}>the matching category</Text>
                  </Text>
                </Pressable>
              ) : null}
            </View>
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

      <SearchFiltersModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        mode={type}
        baseParams={{
          ...(categoryId && type === 'product' ? { category: categoryId } : {}),
          ...(activeQuery ? { q: activeQuery } : {}),
        }}
        value={filters}
        onApply={setFilters}
      />
    </View>
  );
}

/** Supplier result row — the same public projection the web renders:
 *  logo/monogram · name + tick · country · live product count. Nothing more
 *  (no contact details, ever). */
function SupplierRow({ supplier, onPress }) {
  const country = supplier.country ? (findCountry(supplier.country)?.name ?? supplier.country) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={supplier.name}
      style={({ pressed }) => [styles.supplierRow, pressed && styles.supplierRowPressed]}
    >
      <View style={styles.supplierLogoWrap}>
        {supplier.logo ? (
          <Image source={{ uri: supplier.logo }} style={styles.supplierLogo} />
        ) : (
          <Text style={styles.supplierMonogram}>{initials(supplier.name)}</Text>
        )}
      </View>
      <View style={styles.supplierText}>
        <View style={styles.supplierNameRow}>
          <Text style={styles.supplierName} numberOfLines={1}>
            {supplier.name}
          </Text>
          {supplier.verified ? (
            <Ionicons name="checkmark-circle" size={15} color={colors.success} accessible={false} />
          ) : null}
        </View>
        <Text style={styles.supplierMeta} numberOfLines={1}>
          {[country, supplier.productCount != null ? `${supplier.productCount} products` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
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

/** Applied-filter chips: label + how to remove that one filter. */
function buildChips(f, type) {
  const chips = [];
  if (f.verifiedOnly) chips.push({ key: 'verified', label: 'Verified only', remove: (x) => ({ ...x, verifiedOnly: false }) });
  if (f.country) chips.push({ key: 'country', label: `Country: ${f.country}`, remove: (x) => ({ ...x, country: null }) });
  if (type === 'supplier') return chips; // supplier mode carries nothing else
  if (f.priceMin !== '' || f.priceMax !== '')
    chips.push({
      key: 'price',
      label: `Price ${f.priceMin || '0'}–${f.priceMax || '∞'} ${f.currency}`,
      remove: (x) => ({ ...x, priceMin: '', priceMax: '' }),
    });
  if (f.onRequestOnly) chips.push({ key: 'onreq', label: 'On request only', remove: (x) => ({ ...x, onRequestOnly: false }) });
  if (f.moqMin !== '') chips.push({ key: 'moq', label: `MOQ ≥ ${f.moqMin}`, remove: (x) => ({ ...x, moqMin: '' }) });
  if (f.goodsOrService)
    chips.push({
      key: 'gos',
      label: f.goodsOrService === 'goods' ? 'Goods' : 'Services',
      remove: (x) => ({ ...x, goodsOrService: null }),
    });
  for (const [key, v] of Object.entries(f.attr ?? {})) {
    if (v == null || v === '') continue;
    const label = typeof v === 'object' ? `${key} ${v.min || '…'}–${v.max || '…'}` : `${key}: ${v}`;
    chips.push({
      key: `attr-${key}`,
      label,
      remove: (x) => {
        const { [key]: _gone, ...rest } = x.attr;
        return { ...x, attr: rest };
      },
    });
  }
  return chips;
}

function SkeletonGrid({ supplierMode }) {
  if (supplierMode) {
    return (
      <View style={styles.skeletonWrap} accessibilityRole="progressbar" accessibilityLabel="Loading suppliers">
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={44} height={44} radius={radii.full} />
            <View style={styles.skeletonRowText}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="35%" height={12} style={{ marginTop: spacing[2] }} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.skeletonWrap, styles.skeletonGrid]} accessibilityRole="progressbar" accessibilityLabel="Loading products">
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={styles.skeletonCell}>
          <Skeleton width="100%" height={160} radius={radii.lg} />
          <Skeleton width="85%" height={14} style={{ marginTop: spacing[2] }} />
          <Skeleton width="40%" height={18} style={{ marginTop: spacing[2] }} />
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
    gap: spacing[3],
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

  typeRow: { flexDirection: 'row', gap: spacing[2] },
  typeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
  },
  typeTabActive: { backgroundColor: colors.primary[600] },
  typeTabText: { ...typography.caption, fontWeight: '600', color: colors.ink[700] },
  typeTabTextActive: { color: colors.white },

  resultsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  heading: { ...typography.h2, color: colors.ink[900], flexShrink: 1 },
  resultCount: { ...typography.label, color: colors.primary[600] },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  appliedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
  },
  appliedChipText: { ...typography.tiny, fontWeight: '600', color: colors.primary[700] },
  sortNote: { ...typography.tiny, color: colors.muted },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[4], flexGrow: 1 },
  columnWrap: { gap: spacing[4] },
  gridSlot: { flex: 1, maxWidth: '48%', marginBottom: spacing[5] },

  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  supplierRowPressed: { backgroundColor: colors.ink[50] },
  supplierLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  supplierLogo: { width: 44, height: 44 },
  supplierMonogram: { ...typography.label, color: colors.primary[700] },
  supplierText: { flex: 1 },
  supplierNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  supplierName: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },
  supplierMeta: { ...typography.caption, color: colors.muted, marginTop: 1 },

  emptyWrap: { flexGrow: 1 },
  didYouMean: { alignItems: 'center', paddingBottom: spacing[6] },
  didYouMeanText: { ...typography.body, color: colors.muted },
  didYouMeanWord: { color: colors.primary[700], fontWeight: '600' },

  skeletonWrap: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
  skeletonCell: { width: '47%' },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  skeletonRowText: { flex: 1 },

  footerLoading: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetry: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetryText: { ...typography.caption, color: colors.primary[700], fontWeight: '600' },
});
