import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COUNTRIES } from '../constants/countries.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';

/**
 * Searchable country selector.
 *
 * A full-screen modal rather than a dropdown: a 36-item list behind a phone
 * keyboard is unusable in a popover, and the brief calls for a searchable
 * picker. Selecting a country returns the whole record so the caller can use
 * either the ISO code (what the API wants) or the dial code.
 *
 * @param {'country'|'dial'} mode  what the trigger displays
 */
export function CountryPicker({
  value,
  onChange,
  label,
  placeholder = 'Select country',
  error,
  disabled = false,
  mode = 'country',
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dial.includes(q),
    );
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const select = (country) => {
    onChange(country);
    close();
  };

  const triggerLabel = value
    ? mode === 'dial'
      ? value.dial
      : value.name
    : placeholder;

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select country'}
        accessibilityValue={{ text: value?.name ?? 'none selected' }}
        accessibilityState={{ disabled, expanded: open }}
        style={[
          styles.trigger,
          mode === 'dial' && styles.triggerCompact,
          Boolean(error) && styles.triggerError,
          disabled && styles.triggerDisabled,
        ]}
      >
        <Text
          style={[styles.triggerText, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {triggerLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.ink[500]} />
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={close}
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top + spacing[3] }]}>
          <View style={styles.modalBar}>
            <Text style={styles.modalTitle}>Select country</Text>
            <Pressable
              onPress={close}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={26} color={colors.ink[900]} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.ink[400]} accessible={false} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or code"
              placeholderTextColor={colors.ink[400]}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search country"
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
            ListEmptyComponent={<Text style={styles.empty}>No country matches “{query}”.</Text>}
            renderItem={({ item }) => {
              const selected = value?.code === item.code;
              return (
                <Pressable
                  onPress={() => select(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.row,
                    selected && styles.rowSelected,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowDial}>{item.dial}</Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary[600]} />
                  ) : null}
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
  required: { color: colors.danger.DEFAULT },

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
  triggerCompact: { minWidth: 96 },
  triggerError: { borderColor: colors.danger.DEFAULT, backgroundColor: colors.danger[50] },
  triggerDisabled: { backgroundColor: colors.ink[100], opacity: 0.7 },
  triggerText: { ...typography.body, color: colors.ink[900], flexShrink: 1 },
  placeholder: { color: colors.ink[400] },
  errorText: { ...typography.caption, color: colors.danger.DEFAULT },

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
  rowPressed: { backgroundColor: colors.ink[100] },
  rowName: { ...typography.body, color: colors.ink[900], flex: 1 },
  rowDial: { ...typography.caption, color: colors.muted },
  empty: { ...typography.body, color: colors.muted, textAlign: 'center', padding: spacing[6] },
});
