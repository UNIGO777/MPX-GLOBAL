import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { NavyCanopy } from '../components/NavyCanopy.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Honest landing for tapping a sub-category on `CategoryBrowseScreen` — M2
 * app screen 2 (category product listing) isn't built yet. Doing nothing on
 * tap, or silently going nowhere, reads as broken; this names the exact
 * category and says plainly that the listing is next, rather than pretending
 * to be a real result. Logged in `docs/UiWebNotes.md`.
 */
export function CategoryComingSoonScreen({ navigation, route }) {
  const { name, image } = route.params ?? {};

  return (
    <NavyCanopy eyebrow="CATALOGUE" title={name ?? 'Category'} onBack={() => navigation.goBack()}>
      <View style={styles.body}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="image-outline" size={28} color={colors.ink[400]} accessible={false} />
          </View>
        )}
        <Ionicons name="construct-outline" size={22} color={colors.primary[600]} accessible={false} />
        <Text style={styles.title}>Product listings are coming soon</Text>
        <Text style={styles.message}>
          Browsing {name ?? 'this category'}&apos;s products arrives with the next update. Nothing is broken —
          this part of the catalogue just isn&apos;t built yet.
        </Text>
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.lg },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink[100] },
  title: { ...typography.h3, color: colors.ink[900], textAlign: 'center', marginTop: spacing[2] },
  message: { ...typography.body, color: colors.muted, textAlign: 'center' },
});
