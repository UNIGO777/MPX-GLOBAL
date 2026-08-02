import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../../components/BrandMark.jsx';
import { RadioCard } from '../../components/RadioCard.jsx';
import { colors, spacing, typography } from '../../theme/index.js';

/**
 * Screen 2 · Welcome / portal choice — the entry point that picks the portal.
 *
 * 🔴 This screen exists because §A21 makes buyer and exporter separate accounts
 * on separate portals, and the login screen is forbidden from carrying a portal
 * selector (brief rule 2). The choice has to be made here or not at all.
 *
 * The two cards are deliberately EQUAL — neither is styled as the primary path.
 * Tapping one navigates straight on; there is no "continue" button to confirm a
 * choice that is itself the action.
 */
export function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const choosePortal = (portal) => navigation.navigate('Login', { portal });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing[8] }]}>
      <View style={styles.header}>
        <BrandMark size={72} />
        <Text style={styles.brand}>MPX Global</Text>
        <Text style={styles.tagline}>
          The trusted B2B network connecting Indian exporters with international buyers.
        </Text>
      </View>

      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) + spacing[2] }]}
      >
        <Text style={styles.prompt}>How do you want to trade?</Text>

        {/* Cards, not radios: tapping one navigates rather than selecting a
            value, so each is announced as a button. Neither is styled as the
            primary — they are equal paths. */}
        <View style={styles.cards}>
          <RadioCard
            icon="cube-outline"
            title="I'm a buyer"
            description="I want to buy from Indian suppliers"
            onPress={() => choosePortal('buyer')}
            accessibilityRole="button"
          />
          <RadioCard
            icon="business-outline"
            title="I'm an exporter"
            description="I want to sell to international buyers"
            onPress={() => choosePortal('exporter')}
            accessibilityRole="button"
          />
        </View>

        {/* §A21: the same email may hold one buyer AND one exporter account.
            Saying so here prevents the "I already have an account" dead end on
            the other portal's login screen. */}
        <Text style={styles.note}>You can have both a buyer and an exporter account.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary[800] },
  header: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[3] },
  brand: { ...typography.display, color: colors.white },
  tagline: {
    ...typography.body,
    color: colors.primary[100],
    textAlign: 'center',
    maxWidth: 300,
  },

  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[4],
  },
  prompt: { ...typography.h2, color: colors.ink[900] },
  cards: { gap: spacing[3] },
  note: { ...typography.caption, color: colors.muted, textAlign: 'center' },
});
