import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  BackHandler,
  FlatList,
  Image,
  Pressable,
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
 * M2 app screen 6 — category picker, the add-product flow's step 1 (built
 * 2026-08-18). ONE screen, two steps held in local state (brief §2's shared
 * picker shape): step 1 = the 40 tops with a LOCAL name filter (client-side
 * over the loaded list — explicitly not M3 search, brief §11 gap 6); step 2 =
 * the chosen top's subs. Native/hardware back pops the internal step first.
 *
 * 🔴 The seller never picks goods vs service (§A14/§A16) — the SUB decides it
 * silently, "Other" included (two ordinary subs: Other goods / Other
 * services). No type toggle exists anywhere in this flow.
 *
 * Two callers:
 * - Add flow (`ExporterHome` / `MyProducts` "+ Add") — picking a sub PUSHES
 *   `ProductForm` in create mode.
 * - "Change category" inside the form — `route.params.changeFor` set; picking
 *   a sub POPS BACK to the existing form with the new category in params
 *   (`navigation.popTo`, nav v7) so the form instance and its filled fields
 *   survive. The form itself owns the "clears your specifications" warning.
 */
export function ProductCategoryPickerScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const changeFor = route.params?.changeFor === true;
  const [state, setState] = useState({ loading: true, error: null, categories: [] });
  const [selectedTop, setSelectedTop] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const categories = await catalogueApi.tree();
      setState({ loading: false, error: null, categories });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Hardware back pops the internal step before leaving the screen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (selectedTop) {
          setSelectedTop(null);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [selectedTop]),
  );

  const goBack = () => {
    if (selectedTop) setSelectedTop(null);
    // Guarded: a stale callback surviving a Fast Refresh would otherwise
    // dispatch GO_BACK at the stack root and log a navigator error.
    else if (navigation.canGoBack()) navigation.goBack();
  };

  const pickSub = (sub) => {
    const picked = {
      categoryId: sub.id,
      categoryName: sub.name,
      categoryType: sub.type ?? null,
      parentName: selectedTop?.name ?? null,
    };
    if (changeFor) {
      // Back to the SAME form instance — its state must survive the trip.
      // `popTo` throws if that route isn't on the stack (e.g. after a Fast
      // Refresh reset it), so fall back to a plain push rather than crash.
      try {
        navigation.popTo('ProductForm', { changedCategory: picked }, { merge: true });
      } catch {
        navigation.navigate('ProductForm', { mode: 'create', ...picked });
      }
    } else {
      navigation.navigate('ProductForm', { mode: 'create', ...picked });
    }
  };

  const { loading, error, categories } = state;
  const norm = query.trim().toLowerCase();
  const tops = norm ? categories.filter((c) => c.name.toLowerCase().includes(norm)) : categories;

  const step2 = selectedTop != null;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.ink[900]} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {step2 ? selectedTop.name : 'What are you listing?'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {step2
              ? 'This decides which details we’ll ask for.'
              : 'Pick the closest match — “Other” is at the end if nothing fits.'}
          </Text>
        </View>
      </View>

      {!step2 ? (
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.ink[400]} accessible={false} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search categories…"
              placeholderTextColor={colors.ink[400]}
              style={styles.searchInput}
              accessibilityLabel="Search categories"
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.ink[400]} accessible={false} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {loading && categories.length === 0 ? (
        <Spinner label="Loading categories…" />
      ) : error && categories.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : step2 ? (
        <FlatList
          data={selectedTop.subs ?? []}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <PickerRow category={item} onPress={() => pickSub(item)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          ListEmptyComponent={
            <EmptyState icon="cube-outline" title="No sub-categories yet" message="Try another category." />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={tops}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <PickerRow category={item} onPress={() => setSelectedTop(item)} meta={`${item.subs?.length ?? 0}`} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Nothing matches"
              message="Try another word — “Other” is at the end if nothing fits."
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function PickerRow({ category, onPress, meta }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {category.image ? (
        <Image source={{ uri: category.image }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="image-outline" size={18} color={colors.ink[400]} accessible={false} />
        </View>
      )}
      <Text style={styles.rowLabel} numberOfLines={2}>
        {category.name}
      </Text>
      {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...typography.h1, color: colors.ink[900] },
  subtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },

  searchWrap: { paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: spacing[3],
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink[900], paddingVertical: spacing[2] },

  listContent: { paddingHorizontal: spacing[5], flexGrow: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
    minHeight: MIN_TOUCH_TARGET,
  },
  rowPressed: { backgroundColor: colors.ink[50] },
  thumb: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.ink[50] },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...typography.body, color: colors.ink[900], flex: 1 },
  rowMeta: { ...typography.tiny, color: colors.ink[400] },
});
