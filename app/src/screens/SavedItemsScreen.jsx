import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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

import { savedApi } from '../api/saved.js';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { useToast } from '../components/Toast.jsx';
import { findCountry } from '../constants/countries.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M3 app screen 8 — Saved items, BUYER ONLY (built 2026-08-19). Exporter
 * sessions have no entry point here and no hearts anywhere to fill it (§7);
 * the server enforces the role regardless.
 *
 * Products | Suppliers tabs over `GET /saved?targetType`, paginated.
 * Contract points (brief §6):
 * - Unsave = tap the heart. Optimistic, snackbar "Removed from saved", NO
 *   confirmation dialog; a failure puts the row back with a danger toast.
 * - **Unavailable items stay listed** — greyed + "Currently unavailable",
 *   still tappable through to the detail screen. The app never removes
 *   them; permanently-gone items simply never arrive from the server.
 * - 🔴 Never explain WHY something is unavailable, never a "seller deleted"
 *   tombstone — "Currently unavailable" is the whole vocabulary (§1.3).
 * - Empty state is the first-run state for every buyer — inviting, with a
 *   "Start browsing" CTA.
 */
const PAGE_SIZE = 20;

export function SavedItemsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tab, setTab] = useState('product');
  const [state, setState] = useState({ loading: true, error: null, items: [], total: 0, page: 1 });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const load = useCallback(
    async (isRefresh = false, which = tab) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await savedApi.list({ targetType: which, page: 1, pageSize: PAGE_SIZE });
        setState({ loading: false, error: null, items: res.items ?? [], total: res.total ?? 0, page: 1 });
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [tab],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { loading, error, items, total, page } = state;
  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await savedApi.list({ targetType: tab, page: next, pageSize: PAGE_SIZE });
      setState((s) => ({
        ...s,
        items: [...s.items, ...(res.items ?? [])],
        total: res.total ?? s.total,
        page: next,
      }));
    } catch {
      // next scroll retries; the list already shows everything fetched
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, page, tab]);

  const switchTab = (next) => {
    if (next === tab) return;
    setTab(next);
    load(false, next);
  };

  // Optimistic unsave — row leaves immediately, comes back on failure.
  const unsave = async (item) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id), total: Math.max(0, s.total - 1) }));
    try {
      await savedApi.unsave(item.id);
      toast.show('Removed from saved.', { tone: 'neutral' });
    } catch (error) {
      setState((s) => ({ ...s, items: [item, ...s.items], total: s.total + 1 }));
      toast.show(toAppError(error).message, { tone: 'danger' });
    }
  };

  const open = (item) => {
    if (item.targetType === 'product') {
      const p = item.product;
      if (p?.slug ?? p?.id) navigation.navigate('ProductDetail', { idOrSlug: p.slug ?? p.id });
    } else {
      const s = item.supplier;
      if (s?.slug ?? s?.id) navigation.navigate('SupplierProfile', { idOrSlug: s.slug ?? s.id });
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.ink[900]} />
          </Pressable>
          <Text style={styles.title}>Saved</Text>
          {!loading && !error ? <Text style={styles.count}>{total}</Text> : null}
        </View>
        <View style={styles.tabs}>
          {[
            { key: 'product', label: 'Products' },
            { key: 'supplier', label: 'Suppliers' },
          ].map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => switchTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.skeletonWrap} accessibilityRole="progressbar" accessibilityLabel="Loading saved items">
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={64} height={64} radius={radii.md} />
              <View style={styles.skeletonText}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="40%" height={12} style={{ marginTop: spacing[2] }} />
              </View>
            </View>
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <SavedRow item={item} onPress={() => open(item)} onUnsave={() => unsave(item)} />}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="Nothing saved yet"
              message="Tap the ♡ on any product or supplier to keep it here."
              actionLabel="Start browsing"
              onAction={() => navigation.navigate('CategoryBrowse')}
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
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function SavedRow({ item, onPress, onUnsave }) {
  const isProduct = item.targetType === 'product';
  const target = isProduct ? item.product : item.supplier;
  const unavailable = item.available === false;
  const cover = isProduct ? target?.images?.[0] : target?.logo;
  const country = target?.country ? (findCountry(target.country)?.name ?? target.country) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={target?.name ?? 'Saved item'}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, unavailable && styles.rowUnavailable]}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={[styles.thumb, unavailable && styles.thumbGrey]} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons
            name={isProduct ? 'image-outline' : 'business-outline'}
            size={20}
            color={colors.ink[300]}
            accessible={false}
          />
        </View>
      )}
      <View style={styles.rowText}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {target?.name ?? '—'}
          </Text>
          {target?.verified ? (
            <Ionicons name="checkmark-circle" size={14} color={colors.success} accessible={false} />
          ) : null}
        </View>
        {isProduct && target?.price ? (
          <Text style={styles.price} numberOfLines={1}>
            {formatPrice(target.price, target.unit)}
          </Text>
        ) : null}
        {!isProduct && country ? <Text style={styles.meta}>{country}</Text> : null}
        {isProduct && target?.seller?.name ? (
          <Text style={styles.meta} numberOfLines={1}>
            {target.seller.name}
          </Text>
        ) : null}
        {unavailable ? (
          <View style={styles.unavailableBadge}>
            <Text style={styles.unavailableText}>Currently unavailable</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onUnsave}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Remove from saved"
        style={styles.heart}
      >
        <Ionicons name="heart" size={20} color={colors.primary[600]} accessible={false} />
      </Pressable>
    </Pressable>
  );
}

function formatPrice(price, unit) {
  const { mode, min, max, currency } = price ?? {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);
  const suffix = unit ? ` / ${unit}` : '';
  if (mode === 'on_request' || (min == null && max == null)) return 'Price on request';
  if (mode === 'range') return `${currency} ${fmt(min)}–${fmt(max)}${suffix}`;
  return `${currency} ${fmt(min)}${suffix}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },

  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    gap: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  backButton: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  title: { ...typography.h1, color: colors.ink[900], flex: 1 },
  count: { ...typography.label, color: colors.primary[600] },

  tabs: { flexDirection: 'row', gap: spacing[2] },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
  },
  tabActive: { backgroundColor: colors.primary[600] },
  tabText: { ...typography.caption, fontWeight: '600', color: colors.ink[700] },
  tabTextActive: { color: colors.white },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[3], flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  rowPressed: { backgroundColor: colors.ink[50] },
  rowUnavailable: { opacity: 0.75 },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.ink[50] },
  thumbGrey: { opacity: 0.5 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },
  price: { ...typography.label, fontWeight: '700', color: colors.ink[900] },
  meta: { ...typography.caption, color: colors.muted },
  unavailableBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink[100],
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginTop: 2,
  },
  unavailableText: { ...typography.tiny, fontWeight: '600', color: colors.ink[600] },
  heart: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },

  skeletonWrap: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  skeletonText: { flex: 1 },
  footerLoading: { paddingVertical: spacing[4], alignItems: 'center' },
});
