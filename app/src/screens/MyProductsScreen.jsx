import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import { Button } from '../components/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { useToast } from '../components/Toast.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';
import { draftCapBlock } from '../utils/productCaps.js';

/**
 * M2 app screen 5 — "My products", the exporter's Catalogue tab (built
 * 2026-08-18; the tab was a scaffold placeholder until now). The seller's
 * control room on the go, in the app's regular design language: white page,
 * own header, `radii.lg`, one blue accent.
 *
 * Everything renders from ONE `GET /products/mine` call per segment —
 * products + `counts` (the segment chips) + `caps` (the allowance strip,
 * unverified only). Segment vocabulary is the §1.2 seller-facing set:
 * All · Live · Drafts · Hidden · Archived, where "All" EXCLUDES archived
 * (server rule, owner 2026-08-11 — dead history must not drown the list).
 *
 * Row actions live in a bottom action sheet, contents by state (brief §5):
 *   Draft → Publish · Edit · Delete       Live → Hide · Edit · Delete
 *   Hidden → Publish · Edit · Delete      Archived → none (terminal notice)
 *   Blocked (takedown) → Edit · Delete only, with the reason + date shown —
 *   never who acted (§A9), and no appeal action (D6 deferred).
 * Publish/Hide/Delete call the real endpoints; every refusal (cap, missing
 * required specs, goods moq+unit) is the SERVER's message shown verbatim —
 * the app never pre-judges what the server owns.
 *
 * Delete copy says what actually happens: archive, terminal, re-list as new
 * — never "gone forever", never "restore later".
 */
const PAGE_SIZE = 20;

// Segment chip → server status param. `null` = All (server excludes archived).
const SEGMENTS = [
  { key: 'all', label: 'All', param: null },
  { key: 'active', label: 'Live', param: 'active' },
  { key: 'draft', label: 'Drafts', param: 'draft' },
  { key: 'inactive', label: 'Hidden', param: 'inactive' },
  { key: 'archived', label: 'Archived', param: 'archived' },
];

const STATUS_CHIP = {
  active: { label: 'Live', fg: '#05603A', bg: '#E7F7EF' },
  draft: { label: 'Draft', fg: colors.ink[600], bg: colors.ink[100] },
  inactive: { label: 'Hidden', fg: '#93370D', bg: '#FEF0DC' },
  archived: { label: 'Archived', fg: colors.ink[500], bg: colors.ink[100] },
};

export function MyProductsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [segment, setSegment] = useState('all');
  const [state, setState] = useState({
    loading: true,
    error: null,
    products: [],
    total: 0,
    page: 1,
    counts: null,
    caps: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  // The action sheet's subject; `confirmingDelete` switches the sheet to the
  // archive confirmation instead of stacking a second modal.
  const [sheetProduct, setSheetProduct] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [acting, setActing] = useState(false);
  // categoryId → name. The owner payload carries only `categoryId`, but the
  // row spec (brief §5) shows the category, so the tree supplies the labels.
  // Loaded once, never blocking: no map just means no category line.
  const [categoryNames, setCategoryNames] = useState({});
  const loadingMoreRef = useRef(false);

  const paramFor = (seg) => SEGMENTS.find((s) => s.key === seg)?.param;

  const load = useCallback(
    async (isRefresh = false, seg = segment) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      setMoreError(false);
      try {
        const res = await sellerProductsApi.mine({
          pageSize: PAGE_SIZE,
          page: 1,
          ...(paramFor(seg) ? { status: paramFor(seg) } : {}),
        });
        setState({
          loading: false,
          error: null,
          products: res.products ?? [],
          total: res.total ?? 0,
          page: 1,
          counts: res.counts ?? null,
          caps: res.caps ?? null,
        });
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [segment],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Category labels, once per mount. `.catch` swallows deliberately: a failed
  // tree read must never break the product list — the rows simply omit the
  // category line.
  useEffect(() => {
    let alive = true;
    catalogueApi
      .tree()
      .then((tops) => {
        if (!alive) return;
        const map = {};
        for (const top of tops ?? []) {
          map[top.id] = top.name;
          for (const sub of top.subs ?? []) map[sub.id] = sub.name;
        }
        setCategoryNames(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const { loading, error, products, total, page, counts, caps } = state;
  const hasMore = products.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = page + 1;
      const res = await sellerProductsApi.mine({
        pageSize: PAGE_SIZE,
        page: next,
        ...(paramFor(segment) ? { status: paramFor(segment) } : {}),
      });
      setState((s) => ({
        ...s,
        products: [...s.products, ...(res.products ?? [])],
        total: res.total ?? s.total,
        page: next,
      }));
    } catch {
      setMoreError(true); // visible retry row in the footer — never silent
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, page, segment]);

  const switchSegment = (key) => {
    if (key === segment) return;
    setSegment(key);
    load(false, key);
  };

  const closeSheet = () => {
    if (acting) return;
    setSheetProduct(null);
    setConfirmingDelete(false);
  };

  // Row tap → the product's DETAILS in owner mode (owner, 2026-08-19), which
  // renders any status — a draft/hidden listing has no public page. Editing
  // is one tap from there, and still directly available via the ⋮ sheet.
  // Archived opens read-only detail too; the form stays closed to it (§7).
  const openRow = (product) => {
    navigation.navigate('ProductDetail', { ownerProductId: product.id });
  };

  // Explain the draft cap BEFORE the form (M2 brief) — the server enforces
  // it either way, this just saves a wasted form-fill.
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

  const openEditor = (product) => {
    if (product.status === 'archived') {
      // Terminal — the form never opens for archived (brief §7).
      Alert.alert(
        'Archived product',
        'This listing is archived and can’t be edited or restored. To sell it again, create a new listing.',
      );
      return;
    }
    navigation.navigate('ProductForm', { productId: product.id });
  };

  const runStatus = async (product, status) => {
    setActing(true);
    try {
      await sellerProductsApi.setStatus(product.id, status);
      toast.show(status === 'active' ? 'Published — the listing is live.' : 'Hidden from the catalogue.', {
        tone: 'success',
      });
      closeSheet();
      load(true);
    } catch (error) {
      // The server names the exact blocker (cap / missing specs / moq+unit) —
      // its message, verbatim.
      Alert.alert(status === 'active' ? 'Couldn’t publish' : 'Couldn’t hide', toAppError(error).message);
    } finally {
      setActing(false);
    }
  };

  const runArchive = async (product) => {
    setActing(true);
    try {
      await sellerProductsApi.archive(product.id);
      toast.show('Archived — it left the catalogue.', { tone: 'neutral' });
      closeSheet();
      load(true);
    } catch (error) {
      Alert.alert('Couldn’t archive', toAppError(error).message);
    } finally {
      setActing(false);
    }
  };

  const renderItem = useCallback(
    ({ item }) => (
      <ProductRow
        product={item}
        categoryName={categoryNames[item.categoryId]}
        onPress={() => openRow(item)}
        onMore={() => {
          setConfirmingDelete(false);
          setSheetProduct(item);
        }}
      />
    ),
    // `categoryNames` must be a dep — the map arrives after the first render,
    // and without it the rows would keep their (blank) first-pass labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, categoryNames],
  );

  const emptyBySegment = {
    all: ['cube-outline', 'List your first product', 'Buyers can’t find you until you publish something.'],
    active: ['checkmark-circle-outline', 'Nothing live yet', 'Publish a draft to appear in the catalogue.'],
    draft: ['document-text-outline', 'No drafts', 'Half-finished listings are saved here.'],
    inactive: ['eye-off-outline', 'Nothing hidden', 'Listings you hide from buyers land here.'],
    archived: ['archive-outline', 'Nothing archived', 'Deleted listings are kept here, read-only.'],
  };
  const [emptyIcon, emptyTitle, emptyBody] = emptyBySegment[segment];

  const sheetActions = sheetProduct ? actionsFor(sheetProduct) : [];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={styles.title}>My products</Text>
        <Pressable
          onPress={startAdd}
          accessibilityRole="button"
          accessibilityLabel="Add product"
          style={({ pressed }) => [styles.addPill, pressed && styles.addPillPressed]}
        >
          <Ionicons name="add" size={16} color={colors.white} accessible={false} />
          <Text style={styles.addPillText}>Add</Text>
        </Pressable>
      </View>

      {/* Allowance — unverified only; verified accounts see no cap UI (D1). */}
      {caps && caps.verified === false ? (
        <Pressable
          onPress={() => navigation.navigate('KycHub')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.capStrip, pressed && styles.capStripPressed]}
        >
          <Ionicons name="shield-outline" size={16} color={colors.primary[700]} accessible={false} />
          <Text style={styles.capText} numberOfLines={1}>
            {caps.active.used} of {caps.active.limit} live · {caps.drafts.used} of {caps.drafts.limit} drafts —
            get verified to lift limits
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary[700]} accessible={false} />
        </Pressable>
      ) : null}

      {/* Segments — counts on each, straight from the server. */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segmentBleed}
          contentContainerStyle={styles.segmentRow}
        >
          {SEGMENTS.map((s) => {
            const active = segment === s.key;
            const count = counts?.[s.key === 'all' ? 'all' : s.param] ?? 0;
            return (
              <Pressable
                key={s.key}
                onPress={() => switchSegment(s.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {s.label} {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading && products.length === 0 ? (
        <RowsSkeleton />
      ) : error && products.length === 0 ? (
        <ErrorState error={error} onRetry={() => load()} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          ListEmptyComponent={
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle}
              message={emptyBody}
              actionLabel={segment === 'all' ? '+ Add product' : undefined}
              onAction={segment === 'all' ? startAdd : undefined}
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
              <Pressable onPress={loadMore} accessibilityRole="button" style={styles.footerLoading}>
                <Text style={styles.footerRetryText}>Couldn't load more — tap to retry</Text>
              </Pressable>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Action sheet — one modal, two faces (actions / archive confirm). */}
      <Modal visible={sheetProduct != null} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.sheetScrim}>
          <Pressable style={styles.sheetScrimTouch} onPress={closeSheet} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
            {sheetProduct ? (
              confirmingDelete ? (
                <>
                  <Text style={styles.sheetTitle}>Archive this product?</Text>
                  <Text style={styles.sheetBody}>
                    "{sheetProduct.name}" leaves the catalogue and can&apos;t be edited or restored — to sell
                    it again, create a new listing.
                  </Text>
                  <Button
                    label="Archive product"
                    variant="danger"
                    loading={acting}
                    onPress={() => runArchive(sheetProduct)}
                  />
                  <Button label="Cancel" variant="ghost" disabled={acting} onPress={() => setConfirmingDelete(false)} />
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {sheetProduct.name}
                  </Text>
                  {sheetProduct.takedown ? (
                    <View style={styles.blockedNote}>
                      <Ionicons name="alert-circle" size={16} color={colors.danger.DEFAULT} accessible={false} />
                      <Text style={styles.blockedText}>
                        Removed by the MPX team{formatDate(sheetProduct.takedown.at)}
                        {sheetProduct.takedown.reason ? ` — "${sheetProduct.takedown.reason}"` : ''}. It can&apos;t
                        be published or hidden until it&apos;s restored.
                      </Text>
                    </View>
                  ) : null}
                  {sheetActions.map((a) => (
                    <Pressable
                      key={a.key}
                      disabled={acting}
                      onPress={() =>
                        a.run({ product: sheetProduct, runStatus, openEditor, closeSheet, setConfirmingDelete })
                      }
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
                    >
                      <Ionicons
                        name={a.icon}
                        size={20}
                        color={a.destructive ? colors.danger.DEFAULT : colors.ink[800]}
                        accessible={false}
                      />
                      <Text style={[styles.sheetRowText, a.destructive && styles.sheetRowDestructive]}>
                        {a.label}
                      </Text>
                      {acting && a.busy ? <ActivityIndicator size="small" color={colors.primary[600]} /> : null}
                    </Pressable>
                  ))}
                </>
              )
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Sheet contents by state (brief §5). Blocked (takedown) removes the
 *  lifecycle actions entirely — Edit and Delete only. */
function actionsFor(product) {
  const edit = {
    key: 'edit',
    label: 'Edit',
    icon: 'create-outline',
    run: ({ product: p, openEditor, closeSheet }) => {
      closeSheet();
      openEditor(p);
    },
  };
  const del = {
    key: 'delete',
    label: 'Delete (archives)',
    icon: 'archive-outline',
    destructive: true,
    run: ({ setConfirmingDelete }) => setConfirmingDelete(true),
  };
  if (product.takedown) return [edit, del];
  const publish = {
    key: 'publish',
    label: 'Publish',
    icon: 'arrow-up-circle-outline',
    busy: true,
    run: ({ product: p, runStatus }) => runStatus(p, 'active'),
  };
  const hide = {
    key: 'hide',
    label: 'Hide',
    icon: 'eye-off-outline',
    busy: true,
    run: ({ product: p, runStatus }) => runStatus(p, 'inactive'),
  };
  switch (product.status) {
    case 'draft':
    case 'inactive':
      return [publish, edit, del];
    case 'active':
      return [hide, edit, del];
    default:
      return []; // archived rows never open the sheet
  }
}

function ProductRow({ product, categoryName, onPress, onMore }) {
  const cover = product.images?.[0]?.url;
  const chip = STATUS_CHIP[product.status] ?? STATUS_CHIP.draft;
  const archived = product.status === 'archived';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, archived && styles.rowArchived]}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="image-outline" size={20} color={colors.ink[400]} accessible={false} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.rowPrice} numberOfLines={1}>
          {formatPrice(product.price, product.unit)}
        </Text>
        {/* Category (brief §5's row spec). Omitted rather than faked when the
            label map hasn't loaded — never a placeholder id. */}
        {categoryName ? (
          <Text style={styles.rowCategory} numberOfLines={1}>
            {categoryName}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          <View style={[styles.chip, { backgroundColor: chip.bg }]}>
            <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
          </View>
          {product.takedown ? (
            <View style={[styles.chip, styles.blockedChip]}>
              <Text style={[styles.chipText, { color: colors.danger.DEFAULT }]}>Taken down</Text>
            </View>
          ) : null}
          <Text style={styles.rowDate}>{formatDate(product.createdAt)}</Text>
        </View>
      </View>
      {archived ? null : (
        <Pressable
          onPress={onMore}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${product.name}`}
          style={styles.moreButton}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.ink[500]} accessible={false} />
        </Pressable>
      )}
    </Pressable>
  );
}

function RowsSkeleton() {
  return (
    <View style={styles.listContent} accessibilityRole="progressbar" accessibilityLabel="Loading products">
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={styles.skelRow}>
          <Skeleton width={64} height={64} radius={radii.md} />
          <View style={styles.skelBody}>
            <Skeleton width="70%" height={15} />
            <Skeleton width="40%" height={13} style={{ marginTop: spacing[2] }} />
            <Skeleton width="30%" height={12} style={{ marginTop: spacing[2] }} />
          </View>
        </View>
      ))}
    </View>
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

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  title: { ...typography.h1, color: colors.primary[900] },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[600],
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    minHeight: 38,
  },
  addPillPressed: { backgroundColor: colors.primary[700] },
  addPillText: { ...typography.label, color: colors.white },

  capStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  capStripPressed: { backgroundColor: colors.primary[100] },
  capText: { ...typography.tiny, color: colors.primary[800], flex: 1 },

  segmentBleed: { flexGrow: 0 },
  segmentRow: { gap: spacing[2], paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  segment: {
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  segmentActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  segmentText: { ...typography.caption, fontWeight: '600', color: colors.ink[700] },
  segmentTextActive: { color: colors.white },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[1], flexGrow: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  rowPressed: { backgroundColor: colors.ink[50] },
  rowArchived: { opacity: 0.55 },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.ink[50] },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowName: { ...typography.bodyStrong, color: colors.ink[900] },
  rowPrice: { ...typography.caption, fontWeight: '700', color: colors.ink[900], marginTop: 1 },
  rowCategory: { ...typography.tiny, color: colors.muted, marginTop: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  chip: { borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  chipText: { ...typography.tiny, fontWeight: '600' },
  blockedChip: { backgroundColor: colors.danger[50] },
  rowDate: { ...typography.tiny, color: colors.ink[400] },
  moreButton: { width: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },

  footerLoading: { paddingVertical: spacing[4], alignItems: 'center' },
  footerRetryText: { ...typography.caption, color: colors.primary[700], fontWeight: '600' },

  skelRow: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[3] },
  skelBody: { flex: 1, justifyContent: 'center' },

  sheetScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheetScrimTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[2],
  },
  sheetTitle: { ...typography.h3, color: colors.ink[900] },
  sheetBody: { ...typography.body, color: colors.muted, marginBottom: spacing[2] },
  blockedNote: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: colors.danger[50],
    borderRadius: radii.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  blockedText: { ...typography.caption, color: '#912018', flex: 1 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  sheetRowPressed: { backgroundColor: colors.ink[50] },
  sheetRowText: { ...typography.body, color: colors.ink[900], flex: 1 },
  sheetRowDestructive: { color: colors.danger.DEFAULT },
});
