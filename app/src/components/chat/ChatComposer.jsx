import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { colors, radii, spacing, typography } from '../../theme/index.js';
import { CHAT_EMOJI } from '../../utils/chatEmoji.js';
import { CHAT_FILE_MAX_MB, DOCUMENT_MIME, fileBadge, formatFileSize } from '../../utils/chatFiles.js';

/**
 * The chat composer — the web's layout (2026-09-24), one row:
 *   [+]  message  [emoji] [send]
 * "+" opens Photo / Document (D9 / D10); the emoji panel is the web's curated
 * set. Both panels open INLINE above the row rather than as modals, so the
 * keyboard and the draft stay where they are.
 *
 * 🔴 The 200-character cap is a real server rule (M4-12). Emoji are 2+ UTF-16
 * units and the server counts `.length`, so a glyph that would not fit is
 * greyed out, exactly as on the web.
 */
const MAX_LENGTH = 200;

export function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  file,
  onQueueFile,
  onClearFile,
  attachError,
  bottomInset,
}) {
  const [panel, setPanel] = useState(null); // null | 'attach' | 'emoji'
  const selection = useRef({ start: value.length, end: value.length });
  // A queued file can go on its own — text is optional then (owner, 2026-09-24,
  // same as the web; the server accepts an empty body on the file routes).
  const canSend = (value.trim().length > 0 || Boolean(file)) && value.trim().length <= MAX_LENGTH && !sending;

  const toggle = (which) => setPanel((p) => (p === which ? null : which));

  // Insert at the caret (replacing any selection), and only if it still fits.
  const fits = (text) => value.length - (selection.current.end - selection.current.start) + text.length <= MAX_LENGTH;
  const insert = (text) => {
    const { start, end } = selection.current;
    const next = value.slice(0, start) + text + value.slice(end);
    if (next.length > MAX_LENGTH) return;
    onChange(next);
    const caret = start + text.length;
    selection.current = { start: caret, end: caret };
  };

  const pickPhoto = async () => {
    setPanel(null);
    // quality < 1 re-encodes to JPEG — an iPhone's HEIC would otherwise be
    // refused by the server's JPG/PNG/WEBP/GIF allowlist.
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, exif: false });
    const a = !res.canceled && res.assets?.[0];
    if (!a) return;
    onQueueFile(
      {
        uri: a.uri,
        name: a.fileName ?? 'photo.jpg',
        mimeType: a.mimeType ?? 'image/jpeg',
        size: a.fileSize,
        width: a.width,
        height: a.height,
      },
      'image',
    );
  };

  const pickDocument = async () => {
    setPanel(null);
    const res = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_MIME, copyToCacheDirectory: true });
    const a = !res.canceled && res.assets?.[0];
    if (!a) return;
    onQueueFile({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size }, 'document');
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, spacing[3]) }]}>
      {panel === 'attach' ? (
        <View style={styles.menu}>
          <MenuOption icon="image-outline" title="Photo" detail="JPG, PNG, WEBP or GIF" onPress={pickPhoto} />
          <MenuOption
            icon="document-text-outline"
            title="Document"
            detail={`PDF, Word or Excel · up to ${CHAT_FILE_MAX_MB} MB`}
            onPress={pickDocument}
          />
        </View>
      ) : null}

      {panel === 'emoji' ? (
        <View style={styles.emojiPanel}>
          {CHAT_EMOJI.map(([char, name]) => {
            const ok = fits(char);
            return (
              <Pressable
                key={char}
                onPress={() => insert(char)}
                disabled={!ok}
                accessibilityRole="button"
                accessibilityLabel={name}
                style={({ pressed }) => [styles.emojiCell, pressed && styles.emojiCellPressed, !ok && styles.emojiOff]}
              >
                <Text style={styles.emojiChar}>{char}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.card}>
        {/* The chosen file, before it is sent — so nobody sends an 8 MB file to
            a supplier without seeing which one they picked. */}
        {file ? (
          <View style={styles.queued}>
            {file.kind === 'image' ? (
              <Image source={{ uri: file.uri }} style={styles.queuedThumb} />
            ) : (
              <View style={[styles.queuedThumb, styles.badge]}>
                <Text style={styles.badgeText}>{fileBadge(file.name)}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.queuedName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.queuedSize}>{formatFileSize(file.size)}</Text>
            </View>
            <Pressable
              onPress={onClearFile}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={file.kind === 'image' ? 'Remove image' : 'Remove file'}
            >
              <Ionicons name="close" size={18} color={colors.ink[500]} accessible={false} />
            </Pressable>
          </View>
        ) : null}

        {attachError ? (
          <View style={styles.errorRow} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={14} color={colors.danger.DEFAULT} accessible={false} />
            <Text style={styles.errorText}>{attachError}</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <IconButton
            name={panel === 'attach' ? 'close' : 'add'}
            label="Attach a photo or document"
            active={panel === 'attach'}
            disabled={sending}
            onPress={() => toggle('attach')}
          />
          <TextInput
            value={value}
            onChangeText={onChange}
            onSelectionChange={(e) => {
              selection.current = e.nativeEvent.selection;
            }}
            onFocus={() => setPanel(null)}
            placeholder={file ? 'Add a message (optional)…' : 'Write a message…'}
            placeholderTextColor={colors.ink[400]}
            style={styles.input}
            accessibilityLabel="Message"
            multiline
            maxLength={MAX_LENGTH}
          />
          <IconButton
            name="happy-outline"
            label="Add an emoji"
            active={panel === 'emoji'}
            disabled={sending}
            onPress={() => toggle('emoji')}
          />
          {/* Empty = the same button, dimmed — not a grey disc that reads as
              broken (owner, 2026-09-24, web). */}
          <Pressable
            onPress={() => {
              setPanel(null);
              onSend();
            }}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.send, !canSend && styles.sendOff]}
          >
            <Ionicons name="send" size={16} color={colors.white} accessible={false} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function IconButton({ name, label, active, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: active }}
      style={({ pressed }) => [styles.iconButton, (active || pressed) && styles.iconButtonActive]}
    >
      <Ionicons name={name} size={22} color={active ? colors.primary[700] : colors.ink[500]} accessible={false} />
    </Pressable>
  );
}

function MenuOption({ icon, title, detail, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${detail}`}
      style={({ pressed }) => [styles.menuOption, pressed && styles.menuOptionPressed]}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={19} color={colors.primary[700]} accessible={false} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    backgroundColor: colors.surface.DEFAULT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
  },

  card: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4, paddingVertical: 4 },
  iconButton: { width: 38, height: 38, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  iconButtonActive: { backgroundColor: colors.primary[50] },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.ink[900],
    maxHeight: 110,
    minHeight: 38,
    paddingHorizontal: spacing[1],
    paddingTop: 9,
    paddingBottom: 9,
  },
  send: {
    width: 38,
    height: 38,
    marginLeft: 2,
    borderRadius: radii.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.35 },

  queued: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    margin: spacing[2],
    marginBottom: 0,
    padding: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
  },
  queuedThumb: { width: 42, height: 42, borderRadius: radii.md },
  badge: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary[100] },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: colors.primary[700] },
  queuedName: { ...typography.caption, fontWeight: '600', color: colors.ink[900] },
  queuedSize: { ...typography.tiny, color: colors.muted },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingTop: spacing[2] },
  errorText: { ...typography.tiny, flex: 1, fontWeight: '600', color: colors.danger.DEFAULT },

  menu: {
    marginBottom: spacing[2],
    padding: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.white,
  },
  menuOption: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[2], borderRadius: radii.md },
  menuOptionPressed: { backgroundColor: colors.ink[50] },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { ...typography.caption, fontWeight: '600', color: colors.ink[900] },
  menuDetail: { ...typography.tiny, color: colors.muted },

  emojiPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing[2],
    padding: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.white,
  },
  emojiCell: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  emojiCellPressed: { backgroundColor: colors.ink[50] },
  emojiOff: { opacity: 0.3 },
  emojiChar: { fontSize: 22 },
});
