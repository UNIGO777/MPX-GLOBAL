import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/Button.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';

/**
 * The post-signup nudge. Shown once, after signup completes, when the company is
 * not yet verified.
 *
 * 🔴 The copy is deliberately NOT the mockup's "Action required to unlock full
 * access". Nothing is locked and nothing is required: a buyer is fully active
 * from signup (D3) and an exporter's profile is public from signup. Promising an
 * unlock that does not exist is both untrue and the exact thing D3 guards.
 *
 * What IS true, and what each side is told:
 * - Exporter → the 3-active / 10-draft listing cap (D1), lifted by verifying.
 * - Buyer → the tick, and nothing about limits, because they have none.
 *
 * "Not now" carries equal weight on purpose. A modal a buyer cannot escape is
 * the worst possible outcome of this flow, and the hub stays reachable from
 * Profile afterwards so dismissing is never a dead end.
 */
export function VerificationPromptScreen({ navigation }) {
  const { user } = useAuth();
  const isExporter = user?.role === 'exporter';

  const benefits = isExporter
    ? [
        { icon: 'infinite', text: 'List without the 3-product limit' },
        { icon: 'shield-checkmark', text: 'The verified tick buyers filter for' },
      ]
    : [
        { icon: 'shield-checkmark', text: 'The verified tick on your company' },
        { icon: 'chatbubbles', text: 'Suppliers tend to reply faster' },
      ];

  return (
    <NavyCanopy
      title="You're all set"
      subtitle={
        isExporter
          ? 'Your profile is live. One optional step makes it stronger.'
          : 'Your account is ready to use. One optional step adds trust.'
      }
      showWordmark
      sheetTone="subtle"
      footer={
        <View style={styles.actions}>
          <Button label="Verify now" onPress={() => navigation.replace('KycHub')} fullWidth />
          {/* Equal weight, not a whisper. */}
          <Button
            label="Not now"
            variant="secondary"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>
      }
    >
      <View style={styles.block}>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary[600]} />
        </View>

        <Text style={styles.title}>
          {isExporter ? 'List without limits' : 'Get the verified tick'}
        </Text>
        <Text style={styles.body}>
          {isExporter
            ? 'You can list 3 products right now. Verify your business to list without limits and get the tick buyers filter for.'
            : 'Suppliers reply faster to verified buyers. Everything else already works — this is entirely optional.'}
        </Text>

        <View style={styles.benefits}>
          {benefits.map((b) => (
            <View key={b.icon} style={styles.benefitRow}>
              <Ionicons name={b.icon} size={20} color={colors.primary[600]} />
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>You can do this any time from your profile.</Text>
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', gap: spacing[3] },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h2, color: colors.ink[900], textAlign: 'center' },
  body: { ...typography.body, color: colors.ink[700], textAlign: 'center' },
  benefits: { alignSelf: 'stretch', gap: spacing[2], marginTop: spacing[2] },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: radii.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  benefitText: { ...typography.label, color: colors.ink[900], flex: 1 },
  footnote: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  actions: { gap: spacing[2] },
});
