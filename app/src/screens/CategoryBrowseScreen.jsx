import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { NavyCanopy } from '../components/NavyCanopy.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 1 — Category browse (`design-plans/m2/app-screens-design.md`
 * §4, screen 1). Buyer-only, reached from Buyer Home (owner decided
 * 2026-08-07 not to add a tab-bar entry for it).
 *
 * ONE screen, two steps, held in local state rather than two stack routes —
 * "tapping a top only drills in; there is no 'select this top' action. Native
 * back returns to step 1" (brief §2, the shared category-picker component
 * spec). Android's hardware back button is intercepted the same way the
 * header's back arrow is: it pops the internal step first, and only leaves
 * the screen once already at step 1.
 *
 * All 40 real top categories, fetched once — this is the FULL tree, not a
 * sample. Photo thumbnail is the category's own Cloudinary image (every one
 * of the 40 already has a real photo); no per-industry icon set exists, so a
 * generic icon is never invented as a stand-in for a specific category.
 *
 * Tapping a SUB-category doesn't have anywhere real to land yet — M2 app
 * screen 2 (category product listing) isn't built. Rather than do nothing or
 * look broken, it opens a small, honest "coming soon" screen naming that
 * exact sub-category (`CategoryComingSoon`) — logged in `docs/UiWebNotes.md`.
 *
 * 🆕 2026-08-17 — optional `route.params.typeFilter` (`'goods' | 'service'`),
 * from Home's "Physical Goods" / "Business Services" quick-action tiles. Real
 * filter, not decoration: §A16 stores `type` only on SUB-categories (leaves) —
 * a top's own `type` field is genuinely null — so a top only counts as
 * matching if at least one of its real subs does, and step 2 then narrows to
 * just the matching subs (a "mixed" top shows only its goods subs when
 * arrived at via the Goods tile, for example).
 */
export function CategoryBrowseScreen({ navigation, route }) {
  const [state, setState] = useState({ loading: true, error: null, categories: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTop, setSelectedTop] = useState(null);
  const typeFilter = route?.params?.typeFilter ?? null;

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

  const goBack = useCallback(() => {
    if (selectedTop) {
      setSelectedTop(null);
      return true; // handled — stay on this screen, just pop the internal step
    }
    navigation.goBack();
    return true;
  }, [selectedTop, navigation]);

  // Android hardware back. iOS has no hardware back button — the header's
  // onBack (below) covers it, and covers Android too since it calls the same
  // goBack().
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (selectedTop) {
          setSelectedTop(null);
          return true; // handled
        }
        return false; // let the screen actually close
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [selectedTop]),
  );

  const { loading, error, categories } = state;
  // A top has no `type` of its own (§A16 — leaf-only) — it matches a filter
  // when at least one of its real subs does. Step 2 then narrows to just
  // those matching subs, so a "mixed" top never shows the other type.
  const tops = typeFilter ? categories.filter((top) => top.subs?.some((s) => s.type === typeFilter)) : categories;
  const subs = selectedTop
    ? typeFilter
      ? (selectedTop.subs ?? []).filter((s) => s.type === typeFilter)
      : (selectedTop.subs ?? [])
    : [];

  const openSub = (sub) => {
    navigation.navigate('CategoryComingSoon', { name: sub.name, image: sub.image ?? null });
  };

  const filterLabel = typeFilter === 'goods' ? 'PHYSICAL GOODS' : typeFilter === 'service' ? 'BUSINESS SERVICES' : 'CATALOGUE';

  return (
    <NavyCanopy
      eyebrow={selectedTop ? 'SUB-CATEGORIES' : filterLabel}
      title={selectedTop ? selectedTop.name : 'Browse categories'}
      subtitle={
        selectedTop
          ? "This decides which details we'll ask for."
          : "Pick the closest match — 'Other' is at the end if nothing fits."
      }
      onBack={goBack}
      refreshing={refreshing}
      onRefresh={selectedTop ? undefined : () => load(true)}
    >
      {loading && categories.length === 0 ? (
        <Spinner label="Loading categories…" />
      ) : error && categories.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : selectedTop ? (
        <View style={styles.list}>
          {subs.length === 0 ? (
            <Text style={styles.empty}>No sub-categories yet.</Text>
          ) : (
            subs.map((sub) => (
              <Pressable
                key={sub.id}
                onPress={() => openSub(sub)}
                accessibilityRole="button"
                accessibilityLabel={sub.name}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Thumb category={sub} size={40} />
                <Text style={styles.rowLabel} numberOfLines={2}>
                  {sub.name}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
              </Pressable>
            ))
          )}
        </View>
      ) : tops.length === 0 ? (
        <Text style={styles.empty}>No categories match this filter yet.</Text>
      ) : (
        <View style={styles.grid}>
          {tops.map((top) => (
            <Pressable
              key={top.id}
              onPress={() => setSelectedTop(top)}
              accessibilityRole="button"
              accessibilityLabel={top.name}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <Thumb category={top} size="tile" />
              <View style={styles.tileBody}>
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {top.name}
                </Text>
                <Text style={styles.tileMeta}>
                  {(top.subs?.length ?? 0)} {(top.subs?.length ?? 0) === 1 ? 'sub-category' : 'sub-categories'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </NavyCanopy>
  );
}

/** Category photo thumbnail, or the standard neutral fallback — never a
 * coloured/monogram box (matches web's `NoImagePanel`, 2026-08-11 decision:
 * a coloured placeholder reads as content, not as an absence). */
function Thumb({ category, size }) {
  const dimension = size === 'tile' ? styles.thumbTile : { width: size, height: size };
  if (category.image) {
    return <Image source={{ uri: category.image }} style={[styles.thumbImage, dimension]} />;
  }
  return (
    <View style={[styles.thumbFallback, dimension]}>
      <Ionicons name="image-outline" size={size === 'tile' ? 22 : 18} color={colors.ink[400]} accessible={false} />
    </View>
  );
}

const GRID_GAP = spacing[3];

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingBottom: spacing[6] },
  tile: {
    width: `${(100 - 4) / 2}%`,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
    overflow: 'hidden',
  },
  tilePressed: { opacity: 0.85 },
  thumbTile: { width: '100%', aspectRatio: 16 / 9 },
  thumbImage: { resizeMode: 'cover', borderRadius: radii.md },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink[100], borderRadius: radii.md },
  tileBody: { padding: spacing[3], gap: 2 },
  tileLabel: { ...typography.label, color: colors.ink[900] },
  tileMeta: { ...typography.tiny, color: colors.muted },

  list: { gap: spacing[2], paddingBottom: spacing[6] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    padding: spacing[3],
    minHeight: 44,
  },
  rowPressed: { backgroundColor: colors.ink[50] },
  rowLabel: { ...typography.body, color: colors.ink[900], flex: 1 },
  empty: { ...typography.body, color: colors.muted, textAlign: 'center', paddingVertical: spacing[8] },
});
