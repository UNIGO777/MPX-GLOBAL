import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { RadioCard } from '../../components/RadioCard.jsx';
import { colors, spacing, typography } from '../../theme/index.js';

/**
 * Entity type — **buyer only**.
 *
 * An exporter chose this at signup and is never asked again; the hub routes them
 * straight past this screen. A buyer has never been asked, and the server
 * refuses their first upload without it, so it is the first thing here.
 *
 * Two full-width cards, never a dropdown: it decides which documents get
 * requested and it is publicly visible.
 *
 * 🚫 No "KYB REQUIRED" / "VAT REG" chips from the mockup — we have no KYB
 * concept, and India uses GST, not VAT. Naming a requirement we do not have
 * would send sellers looking for a document nobody will ask them for.
 *
 * The choice is NOT persisted here — there is no endpoint for it. It travels to
 * the upload call, which is what actually records it on the Organisation.
 */
export function EntityTypeScreen({ navigation }) {
  const [entityType, setEntityType] = useState(null);

  return (
    <NavyCanopy
      eyebrow="VERIFICATION"
      title="Business type"
      subtitle="Select the legal structure of the entity you represent."
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        <Button
          label="Continue"
          onPress={() => navigation.navigate('KycDocumentType', { entityType })}
          disabled={!entityType}
        />
      }
    >
      <View style={styles.block}>
        <View style={styles.cards} accessibilityRole="radiogroup">
          <RadioCard
            icon="business-outline"
            title="Business"
            description="A registered company, firm or LLP"
            selected={entityType === 'business'}
            onPress={() => setEntityType('business')}
          />
          <RadioCard
            icon="person-outline"
            title="Individual"
            description="A sole proprietor trading in your own name"
            selected={entityType === 'individual'}
            onPress={() => setEntityType('individual')}
          />
        </View>

        <Text style={styles.note}>
          This decides which documents we ask for, and it appears on your public profile. It
          can&apos;t be changed casually afterwards.
        </Text>
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[4] },
  cards: { gap: spacing[3] },
  note: { ...typography.caption, color: colors.muted },
});
