import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * The three states that are NOT the happy path: loading, empty, error.
 *
 * They live together because they are the same design problem — a screen with
 * nothing to show. Every list and every fetch in this app renders one of these
 * rather than a blank view or an endless spinner.
 */

export function Spinner({ label, size = 'large', style }) {
  return (
    <View style={[styles.centered, style]} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator size={size} color={colors.primary[600]} />
      {label ? <Text style={styles.body}>{label}</Text> : null}
    </View>
  );
}

/** Grey block placeholder — use while a known layout's data loads. */
export function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }) {
  return <View style={[styles.skeleton, { width, height, borderRadius: radius }, style]} />;
}

export function EmptyState({ title, message, actionLabel, onAction, style }) {
  return (
    <View style={[styles.centered, style]}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.body}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

/**
 * @param {object} error   an object from `toAppError()` — { message, requestId, retryable }
 * @param {func}   onRetry omit for a non-retryable failure; a dead retry button is worse than none
 */
export function ErrorState({ error, onRetry, style }) {
  return (
    <View style={[styles.centered, style]}>
      <Text style={styles.title}>{error?.kind === 'offline' ? "You're offline" : 'Something went wrong'}</Text>
      <Text style={styles.body}>{error?.message ?? 'Please try again.'}</Text>
      {/* The request id identifies a server-side log entry and carries no data
          of its own — safe to show, and it makes support tickets answerable. */}
      {error?.requestId ? <Text style={styles.requestId}>Reference: {error.requestId}</Text> : null}
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[2],
  },
  title: { ...typography.h3, color: colors.ink[900], textAlign: 'center' },
  body: { ...typography.body, color: colors.muted, textAlign: 'center' },
  requestId: { ...typography.tiny, color: colors.ink[400] },
  action: { marginTop: spacing[2] },
  skeleton: { backgroundColor: colors.ink[100] },
});
