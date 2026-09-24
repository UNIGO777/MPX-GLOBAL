import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TICKET_CATEGORIES, supportApi } from '../../api/support.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { pickSupportFile } from '../../components/support/pickSupportFile.js';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { formatFileSize } from '../../utils/chatFiles.js';

/** New support ticket (Step 1b) — topic cards, subject, message, one optional file. */
export function NewTicketScreen({ navigation, route }) {
  // Raised from a closed ticket: linked back to it (the server re-checks ownership).
  const followUp = route?.params?.followUpOf ? { id: route.params.followUpOf, ref: route.params.followUpRef ?? '' } : null;
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [problem, setProblem] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const valid = subject.trim().length >= 3 && category && (body.trim() || file);

  const attach = async (kind) => {
    const res = await pickSupportFile(kind);
    if (!res) return;
    setProblem(res.problem ?? null);
    if (res.file) setFile(res.file);
  };

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await supportApi.create({ subject: subject.trim(), category, body: body.trim(), file, followUpOf: followUp?.id });
      navigation.replace('SupportTicket', { id: res.ticket.id });
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <NavyCanopy
      title="New ticket"
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={<Button label="Send ticket" onPress={submit} loading={sending} disabled={!valid || sending} />}
    >
      <View style={styles.form}>
        <FormError error={error} />
        {followUp ? (
          <View style={styles.followUp}>
            <Ionicons name="link-outline" size={16} color={colors.primary[600]} accessible={false} />
            <Text style={styles.followUpText}>
              Follow-up to {followUp.ref} — our team will see the earlier ticket.
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>What is it about?</Text>
        <View style={styles.topics}>
          {TICKET_CATEGORIES.map((c) => {
            const on = category === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.topic, on && styles.topicOn]}
              >
                <Ionicons name={c.icon} size={20} color={on ? colors.primary[700] : colors.ink[500]} accessible={false} />
                <Text style={[styles.topicText, on && styles.topicTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Input label="Subject" value={subject} onChangeText={setSubject} placeholder="e.g. My GST certificate won't upload" maxLength={120} />

        <Text style={styles.label}>Message</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What happened, and what did you expect?"
          placeholderTextColor={colors.ink[400]}
          multiline
          maxLength={2000}
          style={styles.textarea}
          textAlignVertical="top"
          accessibilityLabel="Message"
        />

        <Text style={styles.label}>Attachment (optional)</Text>
        {file ? (
          <View style={styles.fileRow}>
            <Ionicons name="attach-outline" size={20} color={colors.primary[600]} accessible={false} />
            <View style={styles.fileText}>
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              {file.size ? <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text> : null}
            </View>
            <Pressable onPress={() => setFile(null)} accessibilityLabel="Remove file" hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.ink[500]} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.attachRow}>
            <Pressable onPress={() => attach('image')} style={styles.attachBtn} accessibilityRole="button">
              <Ionicons name="image-outline" size={18} color={colors.ink[700]} accessible={false} />
              <Text style={styles.attachText}>Photo</Text>
            </Pressable>
            <Pressable onPress={() => attach('document')} style={styles.attachBtn} accessibilityRole="button">
              <Ionicons name="document-text-outline" size={18} color={colors.ink[700]} accessible={false} />
              <Text style={styles.attachText}>Document</Text>
            </Pressable>
          </View>
        )}
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  followUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
    backgroundColor: colors.primary[50],
  },
  followUpText: { ...typography.caption, color: colors.ink[800], flexShrink: 1 },
  form: { gap: spacing[3] },
  label: { ...typography.label, color: colors.ink[800] },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  topic: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.white,
  },
  topicOn: { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  topicText: { ...typography.label, color: colors.ink[800], flexShrink: 1 },
  topicTextOn: { color: colors.primary[800] },
  textarea: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    padding: spacing[3],
    ...typography.body,
    color: colors.ink[900],
  },
  attachRow: { flexDirection: 'row', gap: spacing[2] },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.white,
  },
  attachText: { ...typography.label, color: colors.ink[800] },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.white,
  },
  fileText: { flex: 1, minWidth: 0 },
  fileName: { ...typography.bodyStrong, color: colors.ink[900] },
  fileMeta: { ...typography.caption, color: colors.ink[500] },
  problem: { ...typography.caption, color: colors.danger.DEFAULT },
});
