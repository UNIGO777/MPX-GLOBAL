import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABEL, TICKET_STATUS, supportApi } from '../../api/support.js';
import { Badge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { Spinner } from '../../components/Feedback.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { logger } from '../../utils/logger.js';
import { openLegal } from '../../utils/legal.js';

/**
 * Help & support (Step 1a, 2026-09-24) — pushed from Profile.
 *
 * Shows the support contact a superadmin published in web Settings (email +
 * phone, either may be unset) and tapping one opens the mail app / dialler.
 * Step 1b: this account's own support tickets + "New ticket" (refreshed each
 * time the screen comes back into focus, so a reply shows up).
 * Nothing here is invented: no reply-time or hours promise.
 */
export function HelpSupportScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, email: null, phone: null, hours: null, failed: false });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, failed: false }));
    try {
      const c = await supportApi.contact();
      setState({ loading: false, email: c?.email ?? null, phone: c?.phone ?? null, hours: c?.hours ?? null, failed: false });
    } catch (err) {
      logger.warn('support contact load failed', { message: err?.message });
      setState({ loading: false, email: null, phone: null, hours: null, failed: true });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [tickets, setTickets] = useState(null);
  const loadTickets = useCallback(async () => {
    try {
      const res = await supportApi.myTickets({ pageSize: 50 });
      setTickets(res.rows);
    } catch (err) {
      logger.warn('tickets load failed', { message: err?.message });
      setTickets([]);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [loadTickets]),
  );

  const { loading, email, phone, hours, failed } = state;

  return (
    <NavyCanopy
      title="Help & support"
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={<Button label="New ticket" icon="add" onPress={() => navigation.navigate('NewTicket')} />}
    >
      <View style={styles.body}>
        <Text style={styles.lead}>
          Raise a ticket and the MPX Global team replies here — you&apos;ll get an email too.
        </Text>

        <Text style={styles.section}>Your tickets</Text>
        {tickets === null ? (
          <Spinner label="Loading…" />
        ) : tickets.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No tickets yet. Tap “New ticket” below if you need help.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {tickets.map((t, i) => (
              <View key={t.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  onPress={() => navigation.navigate('SupportTicket', { id: t.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.ticketRow, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={t.unread ? styles.ticketSubjectNew : styles.ticketSubject} numberOfLines={1}>
                      {t.subject}
                    </Text>
                    <Text style={styles.ticketMeta} numberOfLines={1}>
                      {t.unread ? 'Update · ' : ''}{t.ref} · {CATEGORY_LABEL[t.category] ?? t.category}
                    </Text>
                  </View>
                  <Badge label={TICKET_STATUS[t.status]?.label ?? t.status} tone={TICKET_STATUS[t.status]?.tone ?? 'neutral'} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.section}>Contact us</Text>
        {loading ? (
          <Spinner label="Loading…" />
        ) : failed ? (
          <Pressable style={styles.card} onPress={load} accessibilityRole="button">
            <Text style={styles.muted}>Couldn&apos;t load the support contact. Tap to try again.</Text>
          </Pressable>
        ) : !email && !phone ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Our support contact hasn&apos;t been published yet. Please check back shortly.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {email && (
              <ContactRow
                icon="mail-outline"
                label="Email us"
                value={email}
                onPress={() => Linking.openURL(`mailto:${email}`)}
              />
            )}
            {email && phone && <View style={styles.divider} />}
            {phone && (
              <ContactRow
                icon="call-outline"
                label="Call us"
                value={phone}
                onPress={() => Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
              />
            )}
            {/* Published in web Settings since 2026-09-25; absent → nothing shown. */}
            {hours && <Text style={[styles.muted, { paddingTop: 10 }]}>Support hours: {hours}</Text>}
          </View>
        )}

        <Text style={styles.section}>More</Text>
        <View style={styles.card}>
          <ContactRow icon="document-text-outline" label="Terms of Service" onPress={() => openLegal('/terms')} external />
          <View style={styles.divider} />
          <ContactRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => openLegal('/privacy')} external />
        </View>
      </View>
    </NavyCanopy>
  );
}

function ContactRow({ icon, label, value, onPress, external = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary[600]} accessible={false} />
      </View>
      <View style={styles.rowText}>
        <Text style={value ? styles.rowLabelSmall : styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={16}
        color={colors.ink[400]}
        accessible={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  lead: { ...typography.body, color: colors.ink[600] },
  section: { ...typography.label, color: colors.ink[500], marginTop: spacing[3] },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.surface.border,
    overflow: 'hidden',
    padding: spacing[1],
  },
  muted: { ...typography.body, color: colors.ink[500], padding: spacing[3] },
  divider: { height: 1, backgroundColor: colors.surface.border, marginHorizontal: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg },
  rowPressed: { backgroundColor: colors.ink[50] },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { ...typography.bodyStrong, color: colors.ink[900] },
  rowLabelSmall: { ...typography.caption, color: colors.ink[500] },
  rowValue: { ...typography.bodyStrong, color: colors.ink[900] },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg },
  ticketSubject: { ...typography.bodyStrong, color: colors.ink[900] },
  ticketSubjectNew: { ...typography.bodyStrong, color: colors.primary[700] },
  ticketMeta: { ...typography.caption, color: colors.ink[500], marginTop: 2 },
});
