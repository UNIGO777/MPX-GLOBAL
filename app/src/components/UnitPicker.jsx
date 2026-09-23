import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TRADE_UNITS } from '../constants/units.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';

/**
 * Unit picker (owner, 2026-09-24) — the web's Unit dropdown in the app's
 * `CountryPicker` shape. Pick a standard trade unit, or use exactly what you
 * typed ("Use “…”") — the list is a strong default, not a rule.
 */
export function UnitPicker({ label = 'Unit', value, onChange, helperText, error }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Prefix matches first, shortest first ("met" → Meter before Metric ton).
    const list = q
      ? TRADE_UNITS.filter((u) => [u.label, u.value, u.hint].some((t) => String(t ?? '').toLowerCase().includes(q)))
          .map((u, i) => ({ u, i, prefix: u.label.toLowerCase().startsWith(q) || u.value.startsWith(q) }))
          .sort((a, b) => (b.prefix - a.prefix) || (a.prefix && b.prefix ? a.u.label.length - b.u.label.length : 0) || a.i - b.i)
          .map(({ u }) => u)
      : TRADE_UNITS;
    const typed = query.trim();
    const exact = TRADE_UNITS.some((u) => u.value === q || u.label.toLowerCase() === q);
    return [...list, ...(typed && !exact ? [{ value: typed, label: `Use “${typed}”`, typed: true }] : [])];
  }, [query]);

  const selected = TRADE_UNITS.find((u) => u.value === value);
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (u) => {
    onChange(u.value);
    close();
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || 'none selected' }}
        style={[styles.trigger, Boolean(error) && styles.triggerError]}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : value || 'meter / kg / piece'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.ink[500]} accessible={false} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
        <View style={[styles.modalRoot, { paddingTop: insets.top + spacing[3] }]}>
          <View style={styles.modalBar}>
            <Text style={styles.modalTitle}>Unit</Text>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={colors.ink[900]} />
            </Pressable>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.ink[400]} accessible={false} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search or type a unit"
              placeholderTextColor={colors.ink[400]}
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={40}
              accessibilityLabel="Search units"
              style={styles.searchInput}
            />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(u) => `${u.value}-${u.typed ? 't' : 'l'}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
            renderItem={({ item }) => {
              const isSel = !item.typed && item.value === value;
              return (
                <Pressable
                  onPress={() => pick(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  style={({ pressed }) => [styles.row, isSel && styles.rowSelected, pressed && styles.rowPressed]}
                >
                  <Text style={[styles.rowName, item.typed && styles.rowTyped, isSel && styles.rowNameSel]}>{item.label}</Text>
                  {item.hint ? <Text style={styles.rowHint}>{item.hint}</Text> : null}
                  {isSel ? <Ionicons name="checkmark-circle" size={20} color={colors.primary[600]} /> : null}
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
    justifyContent: 'space-between',
    gap: spacing[2],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface.DEFAULT,
  },
  triggerError: { borderColor: colors.danger.DEFAULT, backgroundColor: colors.danger[50] },
  triggerText: { ...typography.body, color: colors.ink[900], flexShrink: 1 },
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
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  rowSelected: { backgroundColor: colors.primary[50] },
  rowPressed: { backgroundColor: colors.primary[50] },
  rowName: { ...typography.body, color: colors.ink[900], flex: 1 },
  rowNameSel: { color: colors.primary[700], fontWeight: '600' },
  rowTyped: { color: colors.primary[700], fontWeight: '600' },
  rowHint: { ...typography.caption, color: colors.muted },
});
