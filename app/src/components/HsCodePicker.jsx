import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sellerProductsApi } from '../api/sellerProducts.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';

/**
 * HS code picker (owner, 2026-09-24) — the web's `HsCodePicker`, in the app's
 * `CountryPicker` shape: a field that opens a full-screen, searchable list.
 * Searches the HS 2022 list on the SERVER as the seller types (~5,600 codes).
 *
 * The seller normally picks a listed code; when theirs isn't listed, a 6–8
 * digit entry can be used as typed ("Use code …"). The server normalises and
 * re-checks either way.
 */
export const formatHsCode = (code = '') =>
  /^\d{6,8}$/.test(code) ? code.replace(/^(\d{4})(\d{2})(\d{2})?$/, (_, a, b, c) => [a, b, c].filter(Boolean).join('.')) : code;

export function HsCodePicker({ label = 'HS code', value, onChange, error }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, error: null, results: [] });

  // Debounced server search while the sheet is open.
  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setState({ loading: false, error: null, results: [] });
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const results = await sellerProductsApi.hsCodes(q);
        if (!cancelled) setState({ loading: false, error: null, results });
      } catch {
        // Shown in the sheet — the seller can still type their code.
        if (!cancelled) setState({ loading: false, error: 'Search is unavailable right now.', results: [] });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query]);

  const typed = query.replace(/[\s.-]/g, '');
  const canUseTyped = /^\d{6,8}$/.test(typed) && !state.results.some((r) => r.code === typed);
  const rows = [...state.results, ...(canUseTyped ? [{ code: typed, description: null, typed: true }] : [])];

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (code) => {
    onChange(code);
    close();
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ? formatHsCode(value) : 'none selected' }}
        style={[styles.trigger, Boolean(error) && styles.triggerError]}
      >
        <Ionicons name="search" size={17} color={colors.ink[400]} accessible={false} />
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatHsCode(value) : 'Search by product or code'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.ink[500]} accessible={false} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : (
        <Text style={styles.helper}>Pick from the HS 2022 list, or type your 6–8 digit code.</Text>
      )}

      <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
        <View style={[styles.modalRoot, { paddingTop: insets.top + spacing[3] }]}>
          <View style={styles.modalBar}>
            <Text style={styles.modalTitle}>HS code</Text>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={colors.ink[900]} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.ink[400]} accessible={false} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="e.g. cotton or 5208"
              placeholderTextColor={colors.ink[400]}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search HS codes"
              style={styles.searchInput}
            />
            {state.loading ? <ActivityIndicator size="small" color={colors.primary[600]} /> : null}
          </View>

          <FlatList
            data={rows}
            keyExtractor={(item) => `${item.code}-${item.typed ? 't' : 'l'}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {state.error ??
                  (query.trim().length < 2
                    ? 'Type a product word or a code, e.g. “cotton” or “5208”.'
                    : state.loading
                      ? 'Searching…'
                      : 'No matching HS code. Type the 6–8 digit code to use it.')}
              </Text>
            }
            renderItem={({ item }) => {
              const selected = value === item.code;
              return (
                <Pressable
                  onPress={() => pick(item.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                >
                  <Text style={styles.rowCode}>{formatHsCode(item.code)}</Text>
                  <Text style={[styles.rowText, item.typed && styles.rowTyped]} numberOfLines={3}>
                    {item.typed ? 'Use this code — it isn’t in the HS 2022 list' : item.description}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  label: { ...typography.label, color: colors.ink[700] },
  helper: { ...typography.caption, color: colors.muted },
  errorText: { ...typography.caption, color: colors.danger.DEFAULT },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface.DEFAULT,
  },
  triggerError: { borderColor: colors.danger.DEFAULT, backgroundColor: colors.danger[50] },
  triggerText: { ...typography.body, color: colors.ink[900], flex: 1 },
  placeholder: { color: colors.ink[400] },

  modalRoot: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  modalTitle: { ...typography.h2, color: colors.ink[900] },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
  },
  searchInput: { ...typography.body, flex: 1, color: colors.ink[900], paddingVertical: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  rowSelected: { backgroundColor: colors.primary[50] },
  rowPressed: { backgroundColor: colors.ink[100] },
  rowCode: { ...typography.bodyStrong, color: colors.ink[900], width: 78, fontVariant: ['tabular-nums'] },
  rowText: { ...typography.caption, color: colors.ink[700], flex: 1 },
  rowTyped: { color: colors.primary[700], fontWeight: '600' },
  empty: { ...typography.body, color: colors.muted, textAlign: 'center', padding: spacing[6] },
});
