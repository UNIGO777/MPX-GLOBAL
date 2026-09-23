import { useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../../theme/index.js';
import { fileBadge, formatFileSize } from '../../utils/chatFiles.js';

/**
 * A message's attachment (D9 image · D10 document), sent or still uploading.
 *
 * `attachment.url` is the server's SHORT-LIVED signed link (10 min), minted per
 * read — never stored, never shared out of the app. A document's `url` is a
 * forced download; a PDF also carries `viewUrl` (inline, same TTL), so tapping
 * the card OPENS it in the phone's browser / PDF viewer — on Cloudinary's
 * origin, never inside the app (owner, 2026-09-24, as on the web). Word and
 * Excel have no `viewUrl`: tapping downloads them.
 *
 * While a message is uploading there is no url yet: the image shows from the
 * local file, a document shows its card without the download affordance.
 */
export function ChatAttachment({ message, mine }) {
  const att = message.attachment;
  const local = message.localFile;
  const kind = att?.kind ?? local?.kind ?? (att ? 'image' : null);
  if (!kind) return null;

  if (kind === 'document') {
    return (
      <DocumentCard
        name={att?.name ?? local?.name}
        format={att?.format}
        bytes={att?.bytes ?? local?.size}
        url={att?.url}
        viewUrl={att?.viewUrl}
        mine={mine}
      />
    );
  }
  return (
    <Photo
      uri={att?.url ?? local?.uri}
      width={att?.width ?? local?.width}
      height={att?.height ?? local?.height}
      pending={!att}
    />
  );
}

function Photo({ uri, width, height, pending }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  // Reserve the right box before the image loads, so the thread doesn't jump.
  const ratio = width && height ? width / height : 4 / 3;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={pending}
        accessibilityRole="imagebutton"
        accessibilityLabel="View image full size"
      >
        <Image
          source={{ uri }}
          style={[styles.photo, { aspectRatio: Math.min(Math.max(ratio, 0.6), 1.8) }, pending && styles.pending]}
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.viewer}>
          <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" accessibilityLabel="Shared image" />
          <Pressable
            onPress={() => setOpen(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            style={[styles.viewerClose, { top: insets.top + spacing[3] }]}
          >
            <Ionicons name="close" size={26} color={colors.white} accessible={false} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function DocumentCard({ name, format, bytes, url, viewUrl, mine }) {
  const info = (
    <>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{fileBadge(format ?? name)}</Text>
      </View>
      <View style={styles.docText}>
        <Text style={[styles.docName, mine && styles.onBrand]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.docSize, mine && styles.onBrandMuted]}>
          {formatFileSize(bytes)}
          {viewUrl ? ' · Tap to open' : ''}
        </Text>
      </View>
    </>
  );
  const style = [styles.doc, mine ? styles.docMine : styles.docTheirs];
  if (!url) return <View style={style}>{info}</View>; // still uploading

  return (
    <View style={style}>
      {/* The card OPENS a PDF; for Word / Excel (no in-browser viewer) the
          card itself downloads. */}
      <Pressable
        onPress={() => Linking.openURL(viewUrl ?? url)}
        accessibilityRole="button"
        accessibilityLabel={viewUrl ? `Open ${name}` : `Download ${name}`}
        style={({ pressed }) => [styles.docMain, pressed && styles.docPressed]}
      >
        {info}
      </Pressable>
      <Pressable
        onPress={() => Linking.openURL(url)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Download ${name}`}
        style={({ pressed }) => [styles.docDownload, pressed && styles.docPressed]}
      >
        <Ionicons name="download-outline" size={19} color={mine ? colors.white : colors.ink[600]} accessible={false} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: 220, borderRadius: radii.md, marginBottom: 6, backgroundColor: colors.ink[100] },
  pending: { opacity: 0.6 },

  viewer: { flex: 1, backgroundColor: 'rgba(0, 5, 23, 0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', right: spacing[4], padding: spacing[2] },

  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 210,
    padding: spacing[2],
    borderRadius: radii.md,
    marginBottom: 6,
  },
  docMine: { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  docTheirs: { backgroundColor: colors.white },
  docPressed: { opacity: 0.7 },
  docMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  docDownload: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: colors.primary[700] },
  docText: { flex: 1 },
  docName: { ...typography.caption, fontWeight: '600', color: colors.ink[900] },
  docSize: { ...typography.tiny, color: colors.muted },
  onBrand: { color: colors.white },
  onBrandMuted: { color: 'rgba(255, 255, 255, 0.75)' },
});
