import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { kycApi, KYC_DOC_TYPES } from '../../api/kyc.js';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';

/**
 * Choose which document to upload.
 *
 * The list is driven by entity type and is enforced server-side — an invalid
 * pair is a 400, so the UI must mirror `KYC_DOCS_BY_ENTITY` exactly.
 *
 * `entityType` arrives either from the route (a buyer who just chose it) or from
 * the account (an exporter, set at signup). It is threaded onward to the upload
 * call, which is the only place it actually gets recorded.
 */
export function DocumentTypeScreen({ navigation, route }) {
  const [entityType, setEntityType] = useState(route.params?.entityType ?? null);
  const [uploaded, setUploaded] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      kycApi
        .getVerification()
        .then((v) => {
          if (!alive) return;
          // Route param wins for the buyer who has just picked; otherwise the
          // account's own value (exporters).
          setEntityType((current) => current ?? v.entityType ?? null);
          setUploaded((v.documents ?? []).map((d) => d.docType));
        })
        .catch(() => {
          // Non-fatal: the list still renders, it just cannot mark what is
          // already uploaded. The upload itself re-validates server-side.
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const options = KYC_DOC_TYPES[entityType] ?? [];

  return (
    <NavyCanopy
      eyebrow="VERIFICATION"
      title="Choose a document"
      subtitle={
        entityType === 'individual'
          ? 'Any one of these is enough to start the review.'
          : 'Any one of these is enough to start the review.'
      }
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
    >
      <View style={styles.block}>
        {options.map((opt) => {
          const already = uploaded.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() =>
                navigation.navigate('KycCapture', { docType: opt.value, label: opt.label, entityType })
              }
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={already ? 'checkmark-circle' : 'document-text-outline'}
                  size={22}
                  color={already ? colors.success : colors.primary[600]}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.rowTitle}>{opt.label}</Text>
                {already ? <Text style={styles.rowMeta}>Already uploaded</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          );
        })}

        {/* Uploading more than one is allowed and often helps a reviewer — say so
            rather than implying one slot per type. */}
        <Text style={styles.note}>
          You can add more than one. Uploading a second document doesn&apos;t replace the first.
        </Text>
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[3] },
  flex1: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing[4],
  },
  rowPressed: { backgroundColor: colors.primary[50] },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...typography.label, color: colors.ink[900] },
  rowMeta: { ...typography.caption, color: colors.success, marginTop: spacing[1] },
  note: { ...typography.caption, color: colors.muted, marginTop: spacing[1] },
});
