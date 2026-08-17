import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button.jsx';
import { ScreenContainer } from '../components/ScreenContainer.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Scaffold placeholder. Every one of these is meant to be deleted once its
 * real screen ships — if one survives into a client demo, that is a gap to
 * report, not a screen.
 *
 * 🆕 2026-08-17 — redesigned (owner: the app "reads AI-generated"). The old
 * version literally rendered internal project-management text at a real
 * buyer/exporter — "Module 3 · Search & discovery" / "Builds in M3" is a
 * build-prompt section number and a milestone code, meaningless to anyone
 * outside this repo. Replaced with: an icon (this screen had NO visual
 * identity at all before — four stacked grey `Text` lines), a plain human
 * sentence (`blurb`) instead of the raw module/milestone strings, and an
 * optional real action (`actionLabel`/`actionRoute`) for the one case where
 * this screen isn't actually a dead end — Search already has a working
 * substitute in Browse Categories, so it says so and links there instead of
 * just apologising. `module`/`milestone` are kept as props (still useful
 * internally — grep for a screen's build milestone) but are no longer
 * rendered; only `title`, `icon`, `blurb` and `note` reach the user.
 */
export function PlaceholderScreen({ title, icon = 'time-outline', blurb, note, actionLabel, actionRoute, navigation }) {
  return (
    <ScreenContainer>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={30} color={colors.primary[600]} accessible={false} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {actionLabel && actionRoute && navigation ? (
          <Button
            label={actionLabel}
            onPress={() => navigation.navigate(actionRoute)}
            variant="secondary"
            fullWidth={false}
            style={styles.action}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

/** Curried form, for passing straight to a navigator's `component` prop.
 *  Forwards `navigation` through (the un-curried version used to drop it
 *  silently, which is fine while nothing needs it — but it's the reason a
 *  real `actionRoute` couldn't have worked before this redesign). */
export function makePlaceholder(props) {
  return function Placeholder({ navigation }) {
    return <PlaceholderScreen {...props} navigation={navigation} />;
  };
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingHorizontal: spacing[6] },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  title: { ...typography.h2, color: colors.ink[900], textAlign: 'center' },
  blurb: { ...typography.body, color: colors.muted, textAlign: 'center' },
  note: {
    ...typography.caption,
    color: colors.ink[400],
    textAlign: 'center',
    marginTop: spacing[3],
  },
  action: { marginTop: spacing[3] },
});
