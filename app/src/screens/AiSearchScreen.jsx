import { useCallback, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
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
import { colors, radii, shadows, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
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
// Each example carries an icon: three identical text rows read as a list of
// strings, whereas an icon makes each one a distinct *kind* of question —
// a product, a supplier, a budget — which is what they are demonstrating.
const EXAMPLES = [
  { text: 'cheap cotton fabric in bulk', icon: 'layers-outline' },
  { text: 'verified textile suppliers in India', icon: 'shield-checkmark-outline' },
  { text: 'industrial solvent under 100', icon: 'flask-outline' },
];

const MAX_QUERY = 500;

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
        // Clear the box on SUCCESS only (owner, 2026-08-20). The query it ran
        // is still on screen in the count line, so nothing is lost — and the
        // docked composer is "search something else", which reads wrong
        // pre-filled with what you just searched.
        //
        // Deliberately NOT cleared on failure: after an error the text is the
        // only copy of what they typed, and they will most likely retry it.
        setQuery('');
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
        {/* 2026-08-20 — this screen is the buyer bar's CENTRE TAB, so it is
            always a tab root. The old back arrow was rendered behind a
            `canGoBack()` check, but from inside a tab navigator that is TRUE
            whenever another tab was visited first — so it appeared on a root
            screen and "went back" to whichever tab you happened to come from.
            Removed: the tab bar is the way out. */}
        <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
          <View style={styles.headerMark}>
            <Ionicons name="sparkles" size={15} color={colors.white} accessible={false} />
          </View>
          <Text style={styles.title}>AI Search</Text>
        </View>

        {result == null && !thinking ? (
          /* Composer state — before any search. Scrollable so the content
             still reaches the button on a short screen with the keyboard up. */
          <ScrollView
            // Plain bottom padding: the tab bar is a flow sibling below this
            // ScrollView, not an overlay, so its height needs no reserving
            // here — and neither does the safe-area inset, which the bar
            // already pads for.
            contentContainerStyle={styles.composerScreen}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero — this screen's whole proposition in two lines. Without it
                the page opened on a bare label above an empty box, which is
                what made it feel unfinished. */}
            <View style={styles.hero}>
              <View style={styles.heroMark}>
                <Ionicons name="sparkles" size={26} color={colors.white} accessible={false} />
              </View>
              <Text style={styles.heroTitle}>Tell us what you need</Text>
              <Text style={styles.heroLead}>
                Plain words work best — the product, the quantity, the budget.
              </Text>
            </View>

            {/* Composer card — the input and its action live in ONE raised
                card, so the box reads as a thing you write in rather than a
                stray outline with a detached button below it. */}
            <View style={styles.composerCard}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder='e.g. "cheap cotton fabric in bulk, 500 metres"'
                placeholderTextColor={colors.ink[400]}
                multiline
                maxLength={MAX_QUERY}
                style={styles.composerInput}
                accessibilityLabel="Describe what you need"
                // Android draws a hard black rule under a multiline input by
                // default — it was showing through the card as a stray line.
                underlineColorAndroid="transparent"
              />
              <View style={styles.composerFoot}>
                <Text style={styles.counter}>
                  {query.length}/{MAX_QUERY}
                </Text>
                <Pressable
                  onPress={() => run()}
                  disabled={query.trim().length < 2}
                  accessibilityRole="button"
                  accessibilityLabel="Search with AI"
                  accessibilityState={{ disabled: query.trim().length < 2 }}
                  style={({ pressed }) => [
                    styles.sendButton,
                    query.trim().length < 2 && styles.sendButtonDisabled,
                    pressed && styles.sendButtonPressed,
                  ]}
                >
                  <Ionicons name="sparkles" size={16} color={colors.white} accessible={false} />
                  <Text style={styles.sendLabel}>Search</Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="information-circle-outline" size={16} color={colors.muted} accessible={false} />
                <Text style={styles.errorLine}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.examples}>
              <Text style={styles.examplesTitle}>Try an example</Text>
              {EXAMPLES.map((ex, i) => (
                <Pressable
                  key={ex.text}
                  onPress={() => run(ex.text)}
                  accessibilityRole="button"
                  accessibilityLabel={`Search: ${ex.text}`}
                  style={({ pressed }) => [
                    styles.exampleRow,
                    i === 0 && styles.exampleRowFirst,
                    i === EXAMPLES.length - 1 && styles.exampleRowLast,
                    pressed && styles.exampleRowPressed,
                  ]}
                >
                  <View style={styles.exampleIcon}>
                    <Ionicons name={ex.icon} size={16} color={colors.primary[600]} accessible={false} />
                  </View>
                  <Text style={styles.exampleText} numberOfLines={1}>
                    {ex.text}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.ink[400]} accessible={false} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : thinking ? (
          <View style={styles.thinking}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.thinkingText}>Reading your request…</Text>
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
            // Same reasoning as the composer: the dock is a flow sibling
            // directly below, so the list's viewport already ends above it.
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Docked composer — "search something else" (results state only).
            🔴 No safe-area inset on it. The tab bar sits BELOW this dock in
            normal flow (`buildTabBarStyle` sets no `position: absolute`) and
            already pads for the inset itself — adding it again stacked a
            second gesture-bar's worth of dead space under the field. */}
        {result != null && !thinking ? (
          <View style={styles.dock}>
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
  headerMark: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h2, color: colors.ink[900] },

  composerScreen: { padding: spacing[5], paddingBottom: spacing[8], gap: spacing[5] },

  // Hero — solid brand navy. The one place in the app where a full-bleed
  // colour block is warranted: it marks AI as a distinct capability rather
  // than another white form.
  hero: {
    backgroundColor: colors.primary[700],
    borderRadius: radii.lg,
    padding: spacing[5],
    gap: spacing[2],
  },
  heroMark: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  heroTitle: { ...typography.h2, color: colors.white },
  heroLead: { ...typography.body, color: colors.primary[100] },

  composerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface.DEFAULT,
    overflow: 'hidden',
    ...shadows.card,
  },
  composerInput: {
    ...typography.body,
    color: colors.ink[900],
    minHeight: 88,
    textAlignVertical: 'top',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  composerFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    paddingTop: spacing[1],
  },
  counter: { ...typography.tiny, color: colors.ink[400] },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 40,
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
  },
  sendButtonPressed: { backgroundColor: colors.primary[700] },
  sendButtonDisabled: { backgroundColor: colors.ink[300] },
  sendLabel: { ...typography.label, color: colors.white },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.ink[50],
    borderRadius: radii.lg,
    padding: spacing[3],
  },
  errorLine: { ...typography.caption, color: colors.muted, flex: 1 },

  // Examples as a grouped list, not loose pills — a list says "pick one",
  // which is the actual instruction.
  examples: { gap: 0 },
  examplesTitle: { ...typography.label, color: colors.ink[900], marginBottom: spacing[3] },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: MIN_TOUCH_TARGET + spacing[2],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    // Rows share a border, so only the outer corners round.
    marginTop: -StyleSheet.hairlineWidth,
  },
  exampleRowFirst: {
    marginTop: 0,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  exampleRowLast: {
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  exampleRowPressed: { backgroundColor: colors.primary[50] },
  exampleIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleText: { ...typography.body, color: colors.ink[900], flex: 1 },

  thinking: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  thinkingText: { ...typography.h3, color: colors.ink[900] },
  thinkingHint: { ...typography.caption, color: colors.muted, marginBottom: spacing[2], textAlign: 'center' },

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

  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    flexGrow: 1,
  },
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
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
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
