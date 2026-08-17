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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { findCountry } from '../constants/countries.js';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { useSavedProducts } from '../hooks/useSavedProducts.js';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 4 — supplier public profile + catalogue (design brief §4,
 * built 2026-08-18). Renders through the same B7 public projection as web's
 * `/supplier/:slug` — name, tick, country, entity type, member-since,
 * description, cover/logo, `productCount` — and NOTHING more: never contact
 * details, never a website, never verification status or history. Absence of
 * the tick means nothing ("no 'unverified' badge anywhere").
 *
 * The catalogue grid is the shared `ProductCard` (hearts real, same
 * `useSavedProducts` hook as the listing and Home) fed by the same
 * `GET /public/search` with `seller=` — so the profile's product count and
 * the grid can never disagree: both are server-derived from live listings
 * only, taken-down items excluded server-side.
 *
 * States per the brief: loading skeleton · loaded · ZERO live products —
 * the profile still renders fully (sellers are public from signup) with a
 * calm "No products listed yet" in the catalogue area · offline/error ·
 * not-found (404, indistinguishable reasons).
 */
const PAGE_SIZE = 20;

export function SupplierProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { idOrSlug } = route.params ?? {};
  const [state, setState] = useState({ loading: true, error: null, supplier: null, products: [], total: 0, page: 1 });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const { savedIndex, loadIndex, toggleSave } = useSavedProducts();
  const loadingMoreRef = useRef(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      setMoreError(false);
      try {
        const [supplier, res] = await Promise.all([
          catalogueApi.exporter(idOrSlug),
          catalogueApi.search({ type: 'product', seller: idOrSlug, sort: 'newest', pageSize: PAGE_SIZE, page: 1 }),
          loadIndex(),
        ]);
        setState({
          loading: false,
          error: null,
          supplier,
          products: res.products ?? [],
          total: res.total ?? 0,
          page: 1,
        });
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [idOrSlug, loadIndex],
  );

  useEffect(() => {
    load();
  }, [load]);

  const { loading, error, supplier, products, total, page } = state;
  const hasMore = products.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = page + 1;
      const res = await catalogueApi.search({
        type: 'product',
        seller: idOrSlug,
        sort: 'newest',
        pageSize: PAGE_SIZE,
        page: next,
      });
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
  }, [hasMore, loading, page, idOrSlug]);

  const openProduct = useCallback(
    (product) => {
      navigation.navigate('ProductDetail', { idOrSlug: product.slug ?? product.id });
    },
    [navigation],
  );

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

  const backButton = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={styles.backCircle}
    >
      <Ionicons name="arrow-back" size={22} color={colors.ink[900]} />
    </Pressable>
  );

  if (loading && !supplier) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing[2] }]}>
        <StatusBar style="dark" />
        <View style={styles.headerRow}>{backButton}</View>
        <View style={styles.skeletonBody} accessibilityRole="progressbar" accessibilityLabel="Loading supplier">
          <Skeleton width={72} height={72} radius={radii.full} />
          <Skeleton width="60%" height={22} style={{ marginTop: spacing[3] }} />
          <Skeleton width="40%" height={14} style={{ marginTop: spacing[2] }} />
          <Skeleton width="100%" height={140} radius={radii.lg} style={{ marginTop: spacing[5] }} />
        </View>
      </View>
    );
  }

  if (error && !supplier) {
    const notFound = error.status === 404;
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing[2] }]}>
        <StatusBar style="dark" />
        <View style={styles.headerRow}>{backButton}</View>
        {notFound ? (
          <EmptyState
            icon="business-outline"
            title="Supplier not available"
            message="This profile may have been removed or the link is out of date."
            actionLabel="Go back"
            onAction={() => navigation.goBack()}
          />
        ) : (
          <ErrorState error={error} onRetry={load} />
        )}
      </View>
    );
  }

  const country = supplier.country ? findCountry(supplier.country)?.name ?? supplier.country : null;
  const metaLine = [country, humanise(supplier.entityType), supplier.memberSince ? `Member since ${supplier.memberSince}` : null]
    .filter(Boolean)
    .join(' · ');

  // Header content scrolls WITH the list (ListHeaderComponent) — profile
  // first, then the catalogue.
  const profileHeader = (
    <View>
      {supplier.coverImage ? <Image source={{ uri: supplier.coverImage }} style={styles.cover} /> : null}
      <View style={styles.identity}>
        <View style={styles.logoWrap}>
          {supplier.logo ? (
            <Image source={{ uri: supplier.logo }} style={styles.logo} />
          ) : (
            <Text style={styles.monogram}>{initials(supplier.name)}</Text>
          )}
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{supplier.name}</Text>
          {supplier.verified ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.success} accessible={false} />
          ) : null}
        </View>
        {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
        {supplier.description ? <Text style={styles.description}>{supplier.description}</Text> : null}
      </View>

      <View style={styles.catalogueHeadRow}>
        <Text style={styles.catalogueHeading}>Products</Text>
        <Text style={styles.catalogueCount}>
          {total} {total === 1 ? 'product' : 'products'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.headerRow, { paddingTop: insets.top + spacing[2] }]}>{backButton}</View>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrap}
        // Floor of spacing[6]: keeps the last row clear of Android's
        // translucent gesture-nav strip even when the inset reports 0
        // (the "bottom safe area" fix, 2026-08-18).
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
        ]}
        ListHeaderComponent={profileHeader}
        ListEmptyComponent={
          <Text style={styles.emptyCatalogue}>No products listed yet.</Text>
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
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
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

  headerRow: { paddingHorizontal: spacing[5], paddingBottom: spacing[2] },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
    alignItems: 'center',
    justifyContent: 'center',
  },

  skeletonBody: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },

  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: colors.ink[50] },
  identity: { paddingTop: spacing[4] },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 72, height: 72 },
  monogram: { ...typography.h2, color: colors.primary[700] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  name: { ...typography.h1, color: colors.ink[900], flexShrink: 1 },
  meta: { ...typography.caption, color: colors.muted, marginTop: spacing[1] },
  description: { ...typography.body, color: colors.ink[700], marginTop: spacing[3] },

  catalogueHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  catalogueHeading: { ...typography.h3, color: colors.ink[900] },
  catalogueCount: { ...typography.label, color: colors.primary[600] },
  emptyCatalogue: { ...typography.body, color: colors.muted, paddingVertical: spacing[4] },

  listContent: { paddingHorizontal: spacing[5], flexGrow: 1 },
  columnWrap: { gap: spacing[4] },
  gridSlot: { flex: 1, maxWidth: '48%', marginBottom: spacing[5] },

  footerLoading: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetry: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetryText: { ...typography.caption, color: colors.primary[700], fontWeight: '600' },
});
