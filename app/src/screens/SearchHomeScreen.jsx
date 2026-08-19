import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
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
import { ErrorState, Skeleton } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M3 app screen 1 — Search home, the Search tab's resting state (built
 * 2026-08-19; the tab was a "coming soon" placeholder since M1).
 *
 * Contains exactly what the brief names (§4.1): the search input (submitting
 * pushes the results screen), the ✨ AI entry — visible WITHOUT scrolling, it
 * is a headline feature — and the top-category grid (a category card opens
 * the results screen pre-filtered; the web's SEO category pages have no app
 * equivalent, deliberately).
 *
 * 🚫 No recent-searches list: web's device-local Recent row was an owner
 * carve-out for WEB specifically, and the brief (§0.3) says the app version
 * needs its OWN explicit go-ahead. Not assumed, not built.
 *
 * 🔴 Copy: nothing implies login is needed to search — search is open; only
 * saving is buyer-gated. The Saved shortcut renders for buyers only (§7 —
 * absent, never disabled).
 */
export function SearchHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
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

  const header = (
    <View style={styles.top}>
      {/* ✨ AI — headline feature, above the fold by design. */}
      <Pressable
        onPress={() => navigation.navigate('AiSearch')}
        accessibilityRole="button"
        accessibilityLabel="AI search"
        style={({ pressed }) => [styles.aiCard, pressed && styles.aiCardPressed]}
      >
        <View style={styles.aiIcon}>
          <Ionicons name="sparkles" size={20} color={colors.white} accessible={false} />
        </View>
        <View style={styles.aiText}>
          <Text style={styles.aiTitle}>AI Search</Text>
          <Text style={styles.aiSubtitle}>Describe what you need in plain words</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary[200]} accessible={false} />
      </Pressable>

      <Text style={styles.sectionTitle}>Browse categories</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Search</Text>
          {role === 'buyer' ? (
            <Pressable
              onPress={() => navigation.navigate('SavedItems')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Saved items"
              style={styles.savedButton}
            >
              <Ionicons name="heart-outline" size={20} color={colors.primary[600]} accessible={false} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.searchPill}>
          <Ionicons name="search" size={18} color={colors.ink[500]} accessible={false} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            placeholder="Search products or suppliers…"
            placeholderTextColor={colors.ink[400]}
            style={styles.searchInput}
            accessibilityLabel="Search"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.ink[400]} accessible={false} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading && categories.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <Skeleton width="100%" height={68} radius={radii.lg} />
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} width="47%" height={90} radius={radii.lg} />
            ))}
          </View>
        </View>
      ) : error && categories.length === 0 ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('CategoryProducts', { categoryId: item.id, categoryName: item.name })
              }
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={({ pressed }) => [styles.catCard, pressed && styles.catCardPressed]}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.catImage} />
              ) : (
                <View style={[styles.catImage, styles.catFallback]}>
                  <Ionicons name="image-outline" size={20} color={colors.ink[300]} accessible={false} />
                </View>
              )}
              <Text style={styles.catName} numberOfLines={2}>
                {item.name}
              </Text>
            </Pressable>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[8] },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.ink[900] },
  savedButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
    paddingHorizontal: spacing[4],
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink[900], paddingVertical: spacing[2] },

  top: { gap: spacing[3], marginBottom: spacing[3] },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.primary[700],
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  aiCardPressed: { backgroundColor: colors.primary[800] },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: { flex: 1 },
  aiTitle: { ...typography.bodyStrong, color: colors.white },
  aiSubtitle: { ...typography.caption, color: colors.primary[100], marginTop: 1 },
  sectionTitle: { ...typography.h3, color: colors.ink[900] },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  columnWrap: { gap: spacing[3] },
  catCard: {
    flex: 1,
    maxWidth: '48.5%',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    overflow: 'hidden',
    marginBottom: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
  },
  catCardPressed: { opacity: 0.85 },
  catImage: { width: '100%', height: 72, backgroundColor: colors.ink[50] },
  catFallback: { alignItems: 'center', justifyContent: 'center' },
  catName: { ...typography.caption, fontWeight: '600', color: colors.ink[900], padding: spacing[3] },

  skeletonWrap: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[4] },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
});
