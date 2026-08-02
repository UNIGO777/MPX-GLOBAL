import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Form-level error banner.
 *
 * 🔴 Sits ABOVE the form, never on a field. That is a product constraint, not a
 * layout preference: "Invalid credentials" must not be attributable to the
 * email field or the password field, because which one was wrong is precisely
 * what we refuse to disclose. A field-level error would leak it by placement
 * alone.
 *
 * Renders the server's message verbatim. Never substitute a more "helpful"
 * one — the backend is deliberate about what it discloses.
 */
export function FormError({ error, style }) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  if (!message) return null;

  return (
    <View style={[styles.banner, style]} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <Ionicons name="alert-circle" size={20} color={colors.danger.DEFAULT} accessible={false} />
      <View style={styles.text}>
        <Text style={styles.message}>{message}</Text>
        {typeof error === 'object' && error.requestId ? (
          <Text style={styles.requestId}>Reference: {error.requestId}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.danger[50],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger.DEFAULT,
    padding: spacing[3],
  },
  text: { flex: 1, gap: spacing[1] },
  message: { ...typography.body, color: '#912018' },
  requestId: { ...typography.tiny, color: colors.muted },
});
