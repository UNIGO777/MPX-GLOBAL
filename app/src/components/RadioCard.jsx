import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Full-width selectable card.
 *
 * 🔴 Required shape for entity type (brief rule 6): it decides which KYC
 * documents get requested later and is publicly visible, so it gets cards with
 * an explanation — never a dropdown that hides the consequence behind a tap.
 *
 * Also used for the buyer/exporter portal choice, where the two options are
 * deliberately equal — neither is styled as primary.
 */
export function RadioCard({
  title,
  description,
  selected = false,
  onPress,
  icon,
  disabled = false,
  // The Welcome screen uses this card shape for navigation, not selection.
  // Announcing "radio button, not selected" for something that navigates away
  // is actively misleading, so the role is overridable.
  accessibilityRole = 'radio',
}) {
  const isRadio = accessibilityRole === 'radio';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={isRadio ? { selected, disabled } : { disabled }}
      accessibilityLabel={title}
      accessibilityHint={description}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && !disabled && styles.cardPressed,
        disabled && styles.cardDisabled,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons
            name={icon}
            size={22}
            color={selected ? colors.white : colors.primary[700]}
            accessible={false}
          />
        </View>
      ) : null}

      <View style={styles.text}>
        <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      {/* A radio shows its selection state; a navigating card shows where it
          goes. An empty radio dot on a card that navigates reads as "nothing
          is selected yet", which is not what is being asked. */}
      {isRadio ? (
        <View style={[styles.dot, selected && styles.dotSelected]}>
          {selected ? <View style={styles.dotInner} /> : null}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.ink[400]} accessible={false} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface.DEFAULT,
  },
  cardSelected: { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  cardPressed: { backgroundColor: colors.ink[100] },
  cardDisabled: { opacity: 0.5 },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  iconWrapSelected: { backgroundColor: colors.primary[600] },

  text: { flex: 1, gap: spacing[1] },
  title: { ...typography.bodyStrong, color: colors.ink[900] },
  titleSelected: { color: colors.primary[800] },
  description: { ...typography.caption, color: colors.muted },

  dot: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSelected: { borderColor: colors.primary[600] },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
  },
});
