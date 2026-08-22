import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * The white search field that sits inside the brand-blue app bar.
 *
 * 🔴 ONE definition, used by the Buyer Home bar, its sticky twin, and the
 * Search tab (owner, 2026-08-21: "i like the search field of search tab make
 * same in home tab also"). It lives here rather than in either screen because
 * two hand-maintained copies of the same control drift — and this one is the
 * most-looked-at control in the app.
 *
 * TWO MODES, because the two places genuinely differ:
 * - **Button** (`onPress`) — Home. Tapping goes to the Search tab; there is no
 *   keyboard on Home, so a real input there would open one over a screen with
 *   nothing to search.
 * - **Input** (`value` + `onChangeText`) — the Search tab, where typing
 *   actually happens.
 * The two look identical on purpose; only the behaviour differs.
 *
 * The ✨ AI chip is INSIDE the pill in both modes. AI search is the one thing a
 * buyer cannot do on a rival marketplace, so it sits in the control they were
 * already reaching for — and its own `Pressable` means tapping the chip never
 * triggers the field behind it.
 */
export function SearchPill({
  onPress,
  onAiPress,
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search products or suppliers',
  autoFocus = false,
  onClear,
}) {
  const isInput = typeof onChangeText === 'function';

  const aiChip = (
    <Pressable
      onPress={onAiPress}
      accessibilityRole="button"
      accessibilityLabel="AI search"
      hitSlop={8}
      style={styles.aiChip}
    >
      <Ionicons name="sparkles" size={11} color={colors.primary[700]} accessible={false} />
      <Text style={styles.aiChipText}>AI</Text>
    </Pressable>
  );

  const magnifier = <Ionicons name="search" size={17} color={colors.ink[400]} accessible={false} />;

  if (isInput) {
    return (
      <View style={styles.pill}>
        {magnifier}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor={colors.ink[400]}
          style={styles.input}
          accessibilityLabel="Search"
          returnKeyType="search"
          autoFocus={autoFocus}
          // Android draws a hard rule under an input by default; it shows
          // through the white pill as a stray line.
          underlineColorAndroid="transparent"
        />
        {value ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.ink[400]} accessible={false} />
          </Pressable>
        ) : (
          aiChip
        )}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      {magnifier}
      <Text style={styles.placeholder} numberOfLines={1}>
        {placeholder}
      </Text>
      {aiChip}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    paddingLeft: spacing[3],
    paddingRight: spacing[2],
  },
  pillPressed: { opacity: 0.9 },
  placeholder: { ...typography.caption, color: colors.ink[400], flex: 1 },
  input: {
    flex: 1,
    ...typography.caption,
    color: colors.ink[900],
    paddingVertical: 0,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[50],
    borderRadius: radii.full,
    paddingVertical: 4,
    paddingHorizontal: spacing[2],
  },
  aiChipText: { ...typography.tiny, fontWeight: '800', color: colors.primary[700] },
});
