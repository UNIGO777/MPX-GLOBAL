import { useCallback, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { searchApi } from '../api/search.js';
import { Button } from '../components/Button.jsx';
import { EmptyState } from '../components/Feedback.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSavedProducts } from '../hooks/useSavedProducts.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M3 app screen 4 — AI search (built 2026-08-19). A full screen, matching
 * web's own move off a modal: composer → the AI's written reply → the
 * matching results → a docked "search something else" composer.
 *
 * ONE cost-controlled call (`POST /search/ai`) returns everything: the
 * model's `message`, the count-honest `answer` fallback, the extracted
 * filters AND the page-1 results themselves. Contract points (brief §4.4):
 * - `message` is the assistant's reply; `answer` is the fallback when the
 *   model wrote nothing. Counts are NEVER claimed from `message` — the model
 *   hasn't seen the results; the count line comes from `total`.
 * - 🔴 AI failure/timeout = the server returns plain keyword results flagged
 *   `fallback: true`. Rendered as a NORMAL search with one quiet "Showing
 *   keyword results." line — no error state.
 * - Daily per-organisation quota → calm copy, regular search still offered.
 * - "Thinking…" is cancellable (the call takes seconds) — cancel keeps the
 *   previous results on screen; a stale response is sequence-guarded away.
 * - Results are the SAME cards as everywhere (never a different result
 *   type); hearts buyer-only (§A13). No raw extracted JSON, no model names,
 *   no token/cost language — ever.
 *
 * Deliberate v1 bound, stated: this screen renders the response's own
 * results (page 1). "See more" hands off to the regular results screen with
 * the query — same engine, and pagination/filter-editing live there.
 */
const EXAMPLES = ['cheap cotton fabric in bulk', 'verified textile suppliers in India', 'industrial solvent under 100'];

export function AiSearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const isBuyer = role === 'buyer';
  const [query, setQuery] = useState('');
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState(null); // the whole AI response
  const [error, setError] = useState(null);
  const { savedIndex, loadIndex, toggleSave } = useSavedProducts();
  const seq = useRef(0);

  const run = useCallback(
    async (text) => {
      const q = (text ?? query).trim();
      if (q.length < 2 || thinking) return;
      const mySeq = ++seq.current;
      setThinking(true);
      setError(null);
      try {
        const [res] = await Promise.all([searchApi.aiSearch(q), isBuyer ? loadIndex() : Promise.resolve()]);
        if (seq.current !== mySeq) return; // cancelled or superseded
        setResult({ ...res, query: q });
      } catch (e) {
        if (seq.current !== mySeq) return;
        const err = toAppError(e);
        // Per-org daily quota / rate limit → calm, specific copy (brief §4.4).
        if (err.kind === 'rateLimited') {
          setError("You've reached today's AI search limit — regular search still works.");
        } else {
          setError(err.message);
        }
      } finally {
        if (seq.current === mySeq) setThinking(false);
      }
    },
    [query, thinking, isBuyer, loadIndex],
  );

  const cancel = () => {
    // Sequence bump: the in-flight response will be ignored when it lands.
    seq.current += 1;
    setThinking(false);
  };

  const openProduct = useCallback(
    (p) => navigation.navigate('ProductDetail', { idOrSlug: p.slug ?? p.id }),
    [navigation],
  );

  const products = result?.products ?? [];
  const isSupplierResult = result?.type === 'supplier';
  const suppliers = result?.suppliers ?? [];
  const rows = isSupplierResult ? suppliers : products;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
          <Pressable
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.ink[900]} />
          </Pressable>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={20} color={colors.primary[600]} accessible={false} />
            <Text style={styles.title}>AI Search</Text>
          </View>
        </View>

        {result == null && !thinking ? (
          /* Composer state — before any search. */
          <View style={styles.composerScreen}>
            <Text style={styles.lead}>Describe what you're sourcing, in plain words.</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder='e.g. "cheap cotton fabric in bulk"'
              placeholderTextColor={colors.ink[400]}
              multiline
              maxLength={500}
              style={styles.composer}
              accessibilityLabel="Describe what you need"
            />
            <View style={styles.exampleWrap}>
              {EXAMPLES.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => setQuery(ex)}
                  accessibilityRole="button"
                  style={styles.exampleChip}
                >
                  <Text style={styles.exampleText}>{ex}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.errorLine}>{error}</Text> : null}
            <Button label="Search with AI" icon="sparkles" onPress={() => run()} disabled={query.trim().length < 2} />
          </View>
        ) : thinking ? (
          <View style={styles.thinking}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.thinkingText}>Thinking…</Text>
            <Text style={styles.thinkingHint}>This can take a few seconds</Text>
            <Button label="Cancel" variant="secondary" fullWidth={false} onPress={cancel} />
          </View>
        ) : (
          /* Results state. */
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            {...(isSupplierResult ? {} : { numColumns: 2, columnWrapperStyle: styles.columnWrap })}
            key={isSupplierResult ? 'supplier' : 'product'}
            ListHeaderComponent={
              <View style={styles.resultHead}>
                {/* The AI's reply — `message`, else the count-honest answer. */}
                <View style={styles.answerCard}>
                  <Ionicons name="sparkles" size={16} color={colors.primary[600]} accessible={false} />
                  <Text style={styles.answerText}>{result.message ?? result.answer}</Text>
                </View>
                {result.fallback ? <Text style={styles.fallbackLine}>Showing keyword results.</Text> : null}
                <View style={styles.countRow}>
                  <Text style={styles.countText}>
                    {result.total ?? rows.length} {(result.total ?? rows.length) === 1 ? 'result' : 'results'} for "
                    {result.query}"
                  </Text>
                  {(result.total ?? 0) > rows.length ? (
                    <Pressable
                      onPress={() =>
                        navigation.navigate('CategoryProducts', {
                          query: result.query,
                          ...(isSupplierResult ? { initialType: 'supplier' } : {}),
                        })
                      }
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <Text style={styles.seeAll}>See all</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            }
            renderItem={({ item }) =>
              isSupplierResult ? (
                <Pressable
                  onPress={() => navigation.navigate('SupplierProfile', { idOrSlug: item.slug ?? item.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.supplierRow, pressed && styles.supplierRowPressed]}
                >
                  <Text style={styles.supplierName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.verified ? (
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} accessible={false} />
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
                </Pressable>
              ) : (
                <ProductCard
                  product={item}
                  onPress={openProduct}
                  savedId={isBuyer ? savedIndex[item.id] : undefined}
                  onToggleSave={isBuyer ? toggleSave : undefined}
                  style={styles.gridSlot}
                />
              )
            }
            ListEmptyComponent={
              <EmptyState
                icon="search-outline"
                title="Nothing matched"
                // `didYouMean` is `{ term, categorySlug }` — interpolating the
                // object printed "[object Object]" (same root cause as the
                // results screen's crash).
                message={
                  result.didYouMean?.term
                    ? `Did you mean "${result.didYouMean.term}"?`
                    : 'Try describing it differently.'
                }
              />
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[16] + spacing[8] },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Docked composer — "search something else" (results state only). */}
        {result != null && !thinking ? (
          <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => run()}
              placeholder="Search something else…"
              placeholderTextColor={colors.ink[400]}
              style={styles.dockInput}
              accessibilityLabel="Search something else"
              returnKeyType="search"
              maxLength={500}
            />
            <Pressable
              onPress={() => run()}
              accessibilityRole="button"
              accessibilityLabel="Search with AI"
              style={styles.dockSend}
            >
              <Ionicons name="sparkles" size={18} color={colors.white} accessible={false} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  backButton: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { ...typography.h2, color: colors.ink[900] },

  composerScreen: { padding: spacing[5], gap: spacing[4] },
  lead: { ...typography.body, color: colors.muted },
  composer: {
    ...typography.body,
    color: colors.ink[900],
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  exampleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  exampleChip: {
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  exampleText: { ...typography.caption, color: colors.primary[700] },
  errorLine: { ...typography.caption, color: colors.muted },

  thinking: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  thinkingText: { ...typography.h3, color: colors.ink[900] },
  thinkingHint: { ...typography.caption, color: colors.muted, marginBottom: spacing[2] },

  resultHead: { gap: spacing[3], marginBottom: spacing[4] },
  answerCard: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  answerText: { ...typography.body, color: colors.primary[800], flex: 1 },
  fallbackLine: { ...typography.tiny, color: colors.muted },
  countRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[3] },
  countText: { ...typography.label, color: colors.ink[900], flexShrink: 1 },
  seeAll: { ...typography.label, color: colors.primary[700] },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[4], flexGrow: 1 },
  columnWrap: { gap: spacing[4] },
  gridSlot: { flex: 1, maxWidth: '48%', marginBottom: spacing[5] },

  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  supplierRowPressed: { backgroundColor: colors.ink[50] },
  supplierName: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },

  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  dockInput: {
    flex: 1,
    ...typography.body,
    color: colors.ink[900],
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: colors.ink[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  dockSend: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
