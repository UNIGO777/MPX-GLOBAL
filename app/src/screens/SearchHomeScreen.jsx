import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { ErrorState, Skeleton } from '../components/Feedback.jsx';
import { SearchPill } from '../components/SearchPill.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M3 app screen 1 — Search home, the Search tab's resting state.
 *
 * 🆕 2026-08-21 — rebuilt to match the Buyer Home marketplace design (owner:
 * "build same in search tab how we design, but card and search field will look
 * same"). Blue app bar, grey ground, white blocks, and the SAME `SearchPill`
 * component Home uses — here in its INPUT mode, because this is where typing
 * actually happens.
 *
 * What the screen offers, in the order a buyer needs it:
 * 1. The search field itself, focused-ready in the app bar.
 * 2. ✨ AI search — a full band, not a link. It is the one route that works
 *    when the buyer does not know the right keyword, which on a whole-word
 *    search engine is often.
 * 3. Categories — MORE of them than Home shows (11 + All against Home's 7).
 *    Home teases the catalogue; this is the screen you come to in order to
 *    browse it, so it earns the extra row.
 * 4. Goods / Services — real `typeFilter` routes, not decoration.
 *
 * 🚫 NO type-ahead suggestions, deliberately. The engine is MongoDB's native
 * `$text` (§A26), which matches WHOLE WORDS only — there is no prefix index to
 * power a suggestions dropdown, and building one client-side would only search
 * the handful of rows already downloaded. Search is submit-then-results, and
 * the results screen owns the "nothing matched" explanation.
 *
 * 🚫 No recent-searches list: web's device-local Recent row was an owner
 * carve-out for WEB specifically, and the brief (§0.3) says the app version
 * needs its OWN explicit go-ahead. Not assumed, not built.
 *
 * 🔴 Copy: nothing implies login is needed to search — search is open; only
 * saving is buyer-gated. The Saved shortcut renders for buyers only (§7 —
 * absent, never disabled).
 */
const CATEGORY_TILES = 11;

export function SearchHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const isBuyer = role === 'buyer';
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: null, categories: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const categories = await catalogueApi.tree();
      setState({ loading: false, error: null, categories });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    navigation.navigate('CategoryProducts', { query: q });
    setQuery('');
  };

  const { loading, error, categories } = state;

  const appBar = (
    <View style={[styles.appBar, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.appBarRow}>
        <SearchPill
          value={query}
          onChangeText={setQuery}
          onSubmit={submit}
          onClear={() => setQuery('')}
          onAiPress={() => navigation.navigate('BuyerAi')}
        />
        {isBuyer ? (
          <Pressable
            onPress={() => navigation.navigate('SavedItems')}
            accessibilityRole="button"
            accessibilityLabel="Saved items"
            hitSlop={8}
          >
            <Ionicons name="heart-outline" size={21} color={colors.white} accessible={false} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {appBar}

      {loading && categories.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <Skeleton width="100%" height={64} radius={0} />
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} width={56} height={56} radius={radii.full} />
            ))}
          </View>
        </View>
      ) : error && categories.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[6] },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
          }
        >
          {/* ✨ The one coloured band. Solid navy — a gradient would need
              `expo-linear-gradient`, and no dependency gets added for a
              visual. Same treatment as Home's, deliberately. */}
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
              <Text style={styles.aiBandTitle}>Not sure what to type?</Text>
              <Text style={styles.aiBandExample} numberOfLines={1}>
                “cotton fabric, 500 m, under ₹250”
              </Text>
            </View>
            <View style={styles.aiBandCta}>
              <Text style={styles.aiBandCtaText}>Try AI</Text>
            </View>
          </Pressable>

          <View style={styles.block}>
            <View style={styles.blockHead}>
              <Text style={styles.blockTitle}>Browse by category</Text>
              <Pressable onPress={() => navigation.navigate('CategoryBrowse')} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.blockLink}>All {categories.length}+ ›</Text>
              </Pressable>
            </View>
            <View style={styles.catGrid}>
              {categories.slice(0, CATEGORY_TILES).map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() =>
                    navigation.navigate('CategoryProducts', { categoryId: cat.id, categoryName: cat.name })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={cat.name}
                  style={({ pressed }) => [styles.catItem, pressed && styles.pressed]}
                >
                  {cat.image ? (
                    <Image source={{ uri: cat.image }} style={styles.catCircle} />
                  ) : (
                    <View style={[styles.catCircle, styles.catFallback]}>
                      <Ionicons name="image-outline" size={18} color={colors.ink[300]} accessible={false} />
                    </View>
                  )}
                  {/* One line + ellipsis, matching Home — the seeded names run
                      long and uneven, and even row heights read better than
                      complete labels here. */}
                  <Text style={styles.catLabel} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => navigation.navigate('CategoryBrowse')}
                accessibilityRole="button"
                accessibilityLabel="All categories"
                style={({ pressed }) => [styles.catItem, pressed && styles.pressed]}
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

          {/* Goods / Services — equal weight, because the live catalogue is
              currently mostly services. Both are real `typeFilter` routes. */}
          <View style={styles.block}>
            <Text style={[styles.blockTitle, styles.blockTitleSolo]}>Browse by type</Text>
            <View style={styles.splitRow}>
              <Pressable
                onPress={() => navigation.navigate('CategoryBrowse', { typeFilter: 'goods' })}
                accessibilityRole="button"
                accessibilityLabel="Physical goods"
                style={({ pressed }) => [styles.split, styles.splitGoods, pressed && styles.pressed]}
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
                style={({ pressed }) => [styles.split, styles.splitServices, pressed && styles.pressed]}
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink[50] },
  pressed: { opacity: 0.8 },

  appBar: { backgroundColor: colors.primary[700], paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  appBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },

  // No horizontal padding — blocks bleed to the edges and own their own, the
  // same structure Home uses.
  scroll: { paddingBottom: spacing[8] },
  block: {
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    marginTop: spacing[2],
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  blockTitle: { ...typography.label, fontWeight: '800', color: colors.ink[900] },
  // 🔴 A title used WITHOUT `blockHead` carries no bottom margin of its own —
  // `blockHead` is what normally provides it. "Browse by type" has no "See
  // all" link, so it sits bare and was landing flush on the cards below.
  blockTitleSolo: { marginBottom: spacing[3] },
  blockLink: { ...typography.tiny, fontWeight: '700', color: colors.primary[600] },

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
  aiBandCta: {
    backgroundColor: colors.white,
    borderRadius: radii.full,
    paddingVertical: 6,
    paddingHorizontal: spacing[3],
  },
  aiBandCtaText: { ...typography.tiny, fontWeight: '800', color: colors.primary[800] },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  catItem: { width: '25%', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[4] },
  catCircle: { width: 56, height: 56, borderRadius: radii.full, backgroundColor: colors.ink[100] },
  catFallback: { alignItems: 'center', justifyContent: 'center' },
  catAll: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[50] },
  catLabel: { ...typography.caption, fontWeight: '600', color: colors.ink[800], textAlign: 'center' },

  splitRow: { flexDirection: 'row', gap: spacing[2] },
  split: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radii.md,
    padding: spacing[3],
  },
  splitGoods: { backgroundColor: colors.primary[50] },
  splitServices: { backgroundColor: '#E6F7EF' },
  splitText: { flex: 1, minWidth: 0 },
  splitGoodsTitle: { ...typography.caption, fontWeight: '800', color: colors.primary[800] },
  splitGoodsSub: { ...typography.tiny, color: '#43539F', marginTop: 1 },
  splitServicesTitle: { ...typography.caption, fontWeight: '800', color: '#05603A' },
  splitServicesSub: { ...typography.tiny, color: '#357056', marginTop: 1 },

  skeletonWrap: { paddingTop: spacing[2], gap: spacing[4] },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
    paddingHorizontal: spacing[4],
    justifyContent: 'space-between',
  },
});
