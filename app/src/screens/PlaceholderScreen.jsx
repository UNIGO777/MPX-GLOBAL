import { StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer.jsx';
import { colors, spacing, typography } from '../theme/index.js';

/**
 * Scaffold placeholder. Names the module it stands in for and the milestone
 * that builds it, so an empty tab reads as "not built yet" rather than "broken".
 *
 * Every one of these is meant to be deleted. If a placeholder survives into a
 * client demo, that is a gap to report, not a screen.
 */
export function PlaceholderScreen({ title, module, milestone, note }) {
  return (
    <ScreenContainer>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {module ? <Text style={styles.module}>{module}</Text> : null}
        {milestone ? <Text style={styles.meta}>Builds in {milestone}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </ScreenContainer>
  );
}

/** Curried form, for passing straight to a navigator's `component` prop. */
export function makePlaceholder(props) {
  return function Placeholder() {
    return <PlaceholderScreen {...props} />;
  };
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  title: { ...typography.h2, color: colors.ink[900], textAlign: 'center' },
  module: { ...typography.body, color: colors.muted, textAlign: 'center' },
  meta: { ...typography.caption, color: colors.ink[400], textAlign: 'center' },
  note: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing[3],
    paddingHorizontal: spacing[4],
  },
});
