import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { searchApi } from '../api/search.js';
import { Button } from '../components/Button.jsx';
import { Skeleton } from '../components/Feedback.jsx';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';

/**
 * M3 app screen 3 — Filters, the FULL-SCREEN modal the plan names ("filters
 * open as a full-screen modal", m3.md §8 App specifics). Built 2026-08-19.
 *
 * Contract points (brief §4.3 + §0.2, none re-decided here):
 * - Facets lazy-load AFTER the modal opens; counts render VERBATIM from
 *   `GET /public/facets` — the UI never computes its own numbers.
 * - Selections apply on "Show N results", never per tap. The footer count is
 *   live (a debounced `pageSize:1` search on each draft change) and "Show 0
 *   results" is legal — the results screen owns the zero state.
 * - Range inputs commit on blur/submit, never per keystroke (§0.2 — web's
 *   per-keystroke version briefly filtered on "1" while typing "1200").
 * - A filter that cannot narrow anything is NOT shown: price with no bounds,
 *   an attribute whose min equals its max, a single-option list (§0.2).
 * - Price is currency-scoped, stated in the helper — no conversion exists
 *   (§A27.1). "Include price on request" is its own switch: on-request rows
 *   have no number for a range to catch.
 * - Supplier mode collapses to Country + Verified only (§A27.3 — a product
 *   param there would 400, so the groups genuinely disappear).
 * - Goods-only groups (MOQ) disappear for a service category — adapt, never
 *   disable.
 * - "Clear all" resets the draft but does not close.
 *
 * Props:
 *   visible · onClose
 *   mode          'product' | 'supplier'
 *   baseParams    the screen's non-filter params (q, category, sort…) — the
 *                 live count and facets are scoped by them
 *   value         the currently APPLIED filter set (see DEFAULT_FILTERS)
 *   onApply(next) — called with the new set when "Show results" is tapped
 */
export const DEFAULT_FILTERS = {
  // Sort rides with the filter set (one sheet, one Apply) but is NOT counted
  // as an "active filter" — it never narrows anything.
  sort: 'relevance',
  verifiedOnly: false,
  priceMin: '',
  priceMax: '',
  currency: 'INR',
  onRequestOnly: false,
  moqMin: '',
  goodsOrService: null, // 'goods' | 'service' | null (both)
  country: null, // ISO alpha-2
  attr: {}, // key → 'value' (select/boolean) or {min,max} (number)
};

/** Filters → server query params. Shared with the results screen so the two
 *  can never disagree about the wire format.
 *
 *  🔴 Attribute filters are emitted as LITERAL bracket-string KEYS
 *  (`"attr[gsm][min]": "100"`), exactly as web does — never a nested object
 *  left to the HTTP client's serializer. The server requires bracket
 *  notation (dotted keys are a 400 by `rejectMongoOperators`), and literal
 *  keys make the wire format independent of axios' serialization rules. */
export function filterParams(f) {
  const params = {
    ...(f.verifiedOnly ? { verifiedOnly: 'true' } : {}),
    ...(f.onRequestOnly ? { onRequest: 'true' } : {}),
    ...(f.priceMin !== '' ? { priceMin: f.priceMin, currency: f.currency } : {}),
    ...(f.priceMax !== '' ? { priceMax: f.priceMax, currency: f.currency } : {}),
    ...(f.moqMin !== '' ? { moqMin: f.moqMin } : {}),
    ...(f.goodsOrService ? { goodsOrService: f.goodsOrService } : {}),
    ...(f.country ? { country: f.country } : {}),
  };
  for (const [key, v] of Object.entries(f.attr ?? {})) {
    if (v == null || v === '') continue;
    if (typeof v === 'object') {
      if (v.min !== '' && v.min != null) params[`attr[${key}][min]`] = String(v.min);
      if (v.max !== '' && v.max != null) params[`attr[${key}][max]`] = String(v.max);
    } else {
      params[`attr[${key}]`] = String(v);
    }
  }
  return params;
}

export function countActiveFilters(f) {
  let n = 0;
  if (f.verifiedOnly) n += 1;
  if (f.onRequestOnly) n += 1;
  if (f.priceMin !== '' || f.priceMax !== '') n += 1;
  if (f.moqMin !== '') n += 1;
  if (f.goodsOrService) n += 1;
  if (f.country) n += 1;
  n += Object.values(f.attr ?? {}).filter((v) => v != null && v !== '' && (typeof v !== 'object' || v.min || v.max)).length;
  return n;
}

export function SearchFiltersModal({ visible, onClose, mode, baseParams, value, onApply }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);
  const [facets, setFacets] = useState(null);
  const [facetsError, setFacetsError] = useState(false);
  const [count, setCount] = useState(null);
  const [counting, setCounting] = useState(false);
  const countSeq = useRef(0);

  // Reset the draft to the APPLIED set each time the modal opens — closing
  // without applying must discard edits (state survives via `value`).
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  // Facets — lazy, after open. Never blocks the modal: a failure shows a
  // quiet line and the always-available groups still work.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setFacetsError(false);
    searchApi
      .facets({ ...baseParams, type: mode })
      .then((d) => alive && setFacets(d.facets ?? null))
      .catch(() => alive && setFacetsError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

  // Live count — debounced, sequence-guarded (a slow older response must not
  // overwrite a newer one).
  useEffect(() => {
    if (!visible) return;
    const seq = ++countSeq.current;
    setCounting(true);
    const t = setTimeout(async () => {
      try {
        const res = await catalogueApi.search({ ...baseParams, type: mode, ...filterParams(draft), pageSize: 1, page: 1 });
        if (countSeq.current === seq) setCount(res.total ?? 0);
      } catch {
        if (countSeq.current === seq) setCount(null); // button falls back to "Show results"
      } finally {
        if (countSeq.current === seq) setCounting(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, draft, mode]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setAttr = (key, v) => setDraft((d) => ({ ...d, attr: { ...d.attr, [key]: v } }));

  const isSupplier = mode === 'supplier';
  // Goods-only groups hide for services (adapt, never disable).
  const showMoq = !isSupplier && draft.goodsOrService !== 'service';
  const priceBounds = facets?.price ?? null;
  const countries = facets?.country ?? [];
  const attributes = facets?.attributes ?? [];
  const goodsOrServiceFacet = facets?.goodsOrService ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close filters" style={styles.close}>
            <Ionicons name="close" size={24} color={colors.ink[900]} />
          </Pressable>
          <Text style={styles.title}>Filters</Text>
          <Pressable
            onPress={() => setDraft({ ...DEFAULT_FILTERS, currency: draft.currency, sort: draft.sort })}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Sort — price sorts are product-only ("suppliers cannot be
              sorted by price", the server 400s it). Tier note lives on the
              results screen when a price sort is active. */}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Sort by</Text>
            <View style={styles.chipWrap}>
              {(isSupplier
                ? ['relevance', 'newest']
                : ['relevance', 'newest', 'priceAsc', 'priceDesc']
              ).map((s) => {
                const active = (draft.sort ?? 'relevance') === s;
                const label = { relevance: 'Relevance', newest: 'Newest', priceAsc: 'Price ↑', priceDesc: 'Price ↓' }[s];
                return (
                  <Pressable
                    key={s}
                    onPress={() => set({ sort: s })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Verified — always visible, opt-in, off by default (B7). */}
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.groupTitle}>Verified sellers only</Text>
              <Text style={styles.hint}>Off by default — unverified sellers are never hidden</Text>
            </View>
            <Switch
              value={draft.verifiedOnly}
              onValueChange={(v) => set({ verifiedOnly: v })}
              trackColor={{ false: colors.ink[200], true: colors.primary[300] }}
              thumbColor={draft.verifiedOnly ? colors.primary[600] : colors.white}
            />
          </View>

          {/* Country — both modes (base param). Single-select chip list. */}
          {countries.length > 1 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Seller country</Text>
              <View style={styles.chipWrap}>
                {countries.map((c) => {
                  const active = draft.country === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => set({ country: active ? null : c.value })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {c.value} · {c.count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {!isSupplier ? (
            <>
              {/* Price — only when the server says a range exists to narrow. */}
              {priceBounds && priceBounds.min !== priceBounds.max ? (
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>Price ({draft.currency})</Text>
                  <Text style={styles.hint}>Shows products priced in {draft.currency} only — no conversion</Text>
                  <View style={styles.rangeRow}>
                    <BoundInput
                      placeholder={String(priceBounds.min)}
                      value={draft.priceMin}
                      onCommit={(v) => set({ priceMin: v })}
                      label="Minimum price"
                    />
                    <Text style={styles.rangeDash}>–</Text>
                    <BoundInput
                      placeholder={String(priceBounds.max)}
                      value={draft.priceMax}
                      onCommit={(v) => set({ priceMax: v })}
                      label="Maximum price"
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.groupTitle}>"Price on request" only</Text>
                  <Text style={styles.hint}>These listings carry no number for a range to match</Text>
                </View>
                <Switch
                  value={draft.onRequestOnly}
                  onValueChange={(v) => set({ onRequestOnly: v })}
                  trackColor={{ false: colors.ink[200], true: colors.primary[300] }}
                  thumbColor={draft.onRequestOnly ? colors.primary[600] : colors.white}
                />
              </View>

              {/* Goods / Services — only when both actually exist here. */}
              {goodsOrServiceFacet.length > 1 ? (
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>Type</Text>
                  <View style={styles.chipWrap}>
                    {[
                      { key: null, label: 'Both' },
                      { key: 'goods', label: 'Goods' },
                      { key: 'service', label: 'Services' },
                    ].map((opt) => {
                      const active = draft.goodsOrService === opt.key;
                      return (
                        <Pressable
                          key={String(opt.key)}
                          onPress={() => set({ goodsOrService: opt.key })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {showMoq ? (
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>Minimum order (MOQ)</Text>
                  <Text style={styles.hint}>Goods listings with MOQ at least this</Text>
                  <BoundInput
                    placeholder={facets?.moq ? `${facets.moq.min}–${facets.moq.max}` : 'e.g. 100'}
                    value={draft.moqMin}
                    onCommit={(v) => set({ moqMin: v })}
                    label="Minimum MOQ"
                    wide
                  />
                </View>
              ) : null}

              {/* Dynamic attribute groups — category-scoped, server-defined. */}
              {attributes.map((a) => (
                <AttributeGroup key={a.key} def={a} value={draft.attr?.[a.key]} onChange={(v) => setAttr(a.key, v)} />
              ))}
            </>
          ) : null}

          {facets == null && !facetsError ? (
            <View style={styles.group}>
              <Skeleton width="45%" height={16} />
              <Skeleton width="100%" height={40} radius={radii.lg} style={{ marginTop: spacing[2] }} />
              <Skeleton width="70%" height={40} radius={radii.lg} style={{ marginTop: spacing[2] }} />
            </View>
          ) : null}
          {facetsError ? (
            <Text style={styles.facetsError}>Some filter options couldn't load — the ones above still work.</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <Button
            label={count == null ? 'Show results' : `Show ${count} ${count === 1 ? 'result' : 'results'}`}
            icon={counting ? undefined : 'checkmark'}
            loading={false}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
          {counting ? <ActivityIndicator size="small" color={colors.primary[600]} style={styles.countSpin} /> : null}
        </View>
      </View>
    </Modal>
  );
}

/** Commit-on-blur numeric input (§0.2 — never per keystroke). */
function BoundInput({ value, onCommit, placeholder, label, wide }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => onCommit(text.trim())}
      onSubmitEditing={() => onCommit(text.trim())}
      placeholder={placeholder}
      placeholderTextColor={colors.ink[400]}
      keyboardType="numeric"
      accessibilityLabel={label}
      style={[styles.boundInput, wide && styles.boundInputWide]}
    />
  );
}

/** One dynamic attribute group: number → min/max with server bounds;
 *  select → option chips with counts; boolean → Yes/No chips. Groups that
 *  cannot narrow (min===max, <2 options) are dropped by the caller's data —
 *  and re-checked here so a stray one renders nothing. */
function AttributeGroup({ def, value, onChange }) {
  if (def.inputType === 'number') {
    const b = def.bounds ?? {};
    if (b.min == null || b.min === b.max) return null;
    const range = typeof value === 'object' && value != null ? value : { min: '', max: '' };
    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>
          {def.name}
          {def.unit ? ` (${def.unit})` : ''}
        </Text>
        <View style={styles.rangeRow}>
          <BoundInput
            placeholder={String(b.min)}
            value={range.min}
            onCommit={(v) => onChange({ ...range, min: v })}
            label={`Minimum ${def.name}`}
          />
          <Text style={styles.rangeDash}>–</Text>
          <BoundInput
            placeholder={String(b.max)}
            value={range.max}
            onCommit={(v) => onChange({ ...range, max: v })}
            label={`Maximum ${def.name}`}
          />
        </View>
      </View>
    );
  }

  const options =
    def.inputType === 'boolean'
      ? [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ]
      : (def.options ?? []).map((o) => ({
          value: String(o.value ?? o),
          label: o.count != null ? `${o.value} · ${o.count}` : String(o.value ?? o),
        }));
  if (options.length < 2) return null;

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{def.name}</Text>
      <View style={styles.chipWrap}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(active ? null : opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  close: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  title: { ...typography.h2, color: colors.ink[900], flex: 1 },
  clearAll: { ...typography.label, color: colors.primary[700] },

  body: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[8], gap: spacing[5] },
  group: { gap: spacing[2] },
  groupTitle: { ...typography.bodyStrong, color: colors.ink[900] },
  hint: { ...typography.tiny, color: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  switchText: { flex: 1, gap: 2 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  chipActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  chipText: { ...typography.caption, fontWeight: '600', color: colors.ink[700] },
  chipTextActive: { color: colors.white },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rangeDash: { ...typography.body, color: colors.muted },
  boundInput: {
    flex: 1,
    ...typography.body,
    color: colors.ink[900],
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing[3],
  },
  boundInputWide: { flex: 0, alignSelf: 'stretch' },
  facetsError: { ...typography.caption, color: colors.muted },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
  },
  countSpin: { position: 'absolute', right: spacing[8], top: spacing[6] },
});
