import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { kycApi, KYC_MAX_FILE_BYTES, KYC_ACCEPTED_MIME } from '../../api/kyc.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';

/**
 * Capture or choose the document, then upload it.
 *
 * Both routes exist on purpose: most people photograph a physical card, but GST
 * and registration certificates are PDFs that live in Files/Drive and never
 * appear in the camera roll.
 *
 * The size and type checks are enforced server-side too — they are repeated here
 * only so a 12 MB phone photo fails instantly instead of after a slow upload on
 * a mobile network. The server remains authoritative.
 */
const MB = (b) => `${(b / (1024 * 1024)).toFixed(1)} MB`;

export function CaptureDocumentScreen({ navigation, route }) {
  const { docType, label, entityType } = route.params ?? {};

  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  /** Shared validation for both pickers — one rule set, checked once. */
  const accept = (picked) => {
    setError(null);
    if (!picked) return;

    if (picked.size != null && picked.size > KYC_MAX_FILE_BYTES) {
      setError({
        message: `That file is ${MB(picked.size)}. The limit is 10 MB — try a lower-resolution photo, or a PDF.`,
      });
      return;
    }
    // The server sniffs the real bytes, so a renamed file is rejected there.
    // Say something honest rather than talking about extensions.
    if (picked.mimeType && !KYC_ACCEPTED_MIME.includes(picked.mimeType)) {
      setError({ message: "That file isn't a PDF or an image. Use a PDF, JPG, PNG or WEBP." });
      return;
    }
    setFile(picked);
  };

  const takePhoto = async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      // Permission refused is a normal choice, not a failure — offer the file
      // route instead of dead-ending.
      setError({ message: 'Camera access is off. You can still choose a file instead.' });
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false });
    if (res.canceled) return;
    const a = res.assets?.[0];
    accept(a && { uri: a.uri, name: a.fileName ?? `${docType}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize });
  };

  const chooseFile = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: KYC_ACCEPTED_MIME, copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets?.[0];
    accept(a && { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
  };

  const upload = async () => {
    setUploading(true);
    setError(null);
    try {
      await kycApi.uploadDocument({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        docType,
        // Only sent when the account has none yet (a buyer's first upload); the
        // server rejects a mismatch against an exporter's signup value.
        entityType,
      });
      // One upload puts the whole organisation into review — land back on the
      // hub, which refetches on focus and shows the new state.
      navigation.navigate('KycHub');
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setUploading(false);
    }
  };

  const isImage = file?.mimeType?.startsWith('image/');

  return (
    <NavyCanopy
      eyebrow="VERIFICATION"
      title={label ?? 'Add document'}
      subtitle="Photograph it, or choose a file."
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        file ? (
          <Button label="Upload document" onPress={upload} loading={uploading} disabled={uploading} />
        ) : null
      }
    >
      <View style={styles.block}>
        <FormError error={error} />

        {file ? (
          <View style={styles.preview}>
            {isImage ? (
              <Image source={{ uri: file.uri }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.pdfThumb]}>
                <Ionicons name="document-text" size={36} color={colors.primary[600]} />
              </View>
            )}
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            {file.size != null ? <Text style={styles.fileMeta}>{MB(file.size)}</Text> : null}

            {uploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color={colors.primary[600]} />
                <Text style={styles.fileMeta}>Uploading…</Text>
              </View>
            ) : (
              <Button label="Choose a different file" variant="ghost" onPress={() => setFile(null)} />
            )}
          </View>
        ) : (
          <View style={styles.choices}>
            <Button label="Take a photo" onPress={takePhoto} fullWidth />
            <Button label="Choose a file" variant="secondary" onPress={chooseFile} fullWidth />
            <Text style={styles.hint}>PDF, JPG, PNG or WEBP · up to 10 MB</Text>
          </View>
        )}
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[4] },
  choices: { gap: spacing[3] },
  hint: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  preview: {
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing[4],
  },
  thumb: { width: '100%', height: 220, borderRadius: radii.md, backgroundColor: colors.primary[50] },
  pdfThumb: { alignItems: 'center', justifyContent: 'center' },
  fileName: { ...typography.label, color: colors.ink[900] },
  fileMeta: { ...typography.caption, color: colors.muted },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
