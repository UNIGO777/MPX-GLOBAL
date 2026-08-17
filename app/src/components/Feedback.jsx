import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * The three states that are NOT the happy path: loading, empty, error.
 *
 * They live together because they are the same design problem — a screen with
 * nothing to show. Every list and every fetch in this app renders one of these
 * rather than a blank view or an endless spinner.
 *
 * 🆕 2026-08-17 — `EmptyState`/`ErrorState` got an icon badge (owner: the app
 * "reads AI-generated" — bare centered text with no visual identity was a real
 * part of that). This isn't a new visual language: `VerificationSummaryCard`
 * already pairs a status with a soft-tinted icon circle everywhere else in the
 * app — these two were the odd ones out for being text-only. The colour pairs
 * below are the SAME ones `VerificationSummaryCard` already uses for
 * "pending"/"submitted", reused rather than invented, so an error screen and a
 * verification-pending card read as the same app. `Spinner` is left alone —
 * a loading state is meant to be brief and gets out of the way; decorating it
 * further doesn't make it feel more human, it just makes it slower to read.
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

/**
 * @param {string} icon  optional Ionicons name — defaults to a neutral "empty
 *                       tray", never invented per call site if the caller
 *                       doesn't have anything more specific to say.
 */
export function EmptyState({ title, message, icon = 'file-tray-outline', actionLabel, onAction, style }) {
  return (
    <View style={[styles.centered, style]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.ink[100] }]}>
        <Ionicons name={icon} size={26} color={colors.ink[500]} accessible={false} />
      </View>
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
  const offline = error?.kind === 'offline';
  return (
    <View style={[styles.centered, style]}>
      <View style={[styles.iconWrap, { backgroundColor: offline ? colors.ink[100] : '#FEF0DC' }]}>
        <Ionicons
          name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={26}
          color={offline ? colors.ink[600] : '#93370D'}
          accessible={false}
        />
      </View>
      <Text style={styles.title}>{offline ? "You're offline" : 'Something went wrong'}</Text>
      <Text style={styles.body}>
        {error?.message ?? (offline ? 'Check your connection and try again.' : 'Give it another try in a moment.')}
      </Text>
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
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  title: { ...typography.h3, color: colors.ink[900], textAlign: 'center' },
  body: { ...typography.body, color: colors.muted, textAlign: 'center' },
  requestId: { ...typography.tiny, color: colors.ink[400] },
  action: { marginTop: spacing[2] },
  skeleton: { backgroundColor: colors.ink[100] },
});
