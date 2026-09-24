import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LEAD_STATUS, leadsApi } from '../../api/support.js';
import { Badge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { ErrorState, Spinner } from '../../components/Feedback.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';

/**
 * Find a supplier (Step 1d) — the buyer's requests to MPX Global and the
 * suppliers connected to each (tap → the chat). Refreshed on focus.
 */
export function FindSupplierScreen({ navigation }) {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLeads(await leadsApi.mine());
    } catch (err) {
      setError(toAppError(err));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <NavyCanopy
      title="Find a supplier"
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={<Button label="New request" icon="add" onPress={() => navigation.navigate('NewLead')} />}
    >
      <View style={styles.body}>
        <Text style={styles.lead}>Tell us what you need — our team finds matching Indian exporters and connects you in chat.</Text>
        {!leads && !error ? <Spinner label="Loading…" /> : null}
        {error ? <ErrorState error={error} onRetry={load} /> : null}
        {leads && leads.length === 0 ? (
          <View style={styles.card}><Text style={styles.muted}>No requests yet. Tap “New request” below.</Text></View>
        ) : null}
        {(leads ?? []).map((l) => {
          const st = LEAD_STATUS[l.status] ?? LEAD_STATUS.new;
          return (
            <View key={l.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.what}>{l.what}</Text>
                <Badge label={st.label} tone={st.tone} />
                <Text style={styles.meta}>
                  {l.ref}{l.quantity ? ` · ${l.quantity} ${l.unit ?? ''}` : ''}{l.destinationCountry ? ` · to ${l.destinationCountry}` : ''}
                </Text>
              </View>
              {l.suppliers.length ? (
                l.suppliers.map((s) => (
                  <Pressable
                    key={s.conversationId}
                    onPress={() => navigation.navigate('ChatThread', { id: s.conversationId })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.supplier, pressed && styles.pressed]}
                  >
                    <Ionicons name="chatbubbles-outline" size={18} color={colors.primary[600]} accessible={false} />
                    <View style={styles.flex}>
                      <Text style={styles.supplierName} numberOfLines={1}>{s.exporter}</Text>
                      <Text style={styles.meta} numberOfLines={1}>{s.product}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.ink[400]} accessible={false} />
                  </Pressable>
                ))
              ) : l.status !== 'closed' ? (
                <Text style={styles.waiting}>Our team is looking for suppliers — they&apos;ll appear here and in your chats.</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  lead: { ...typography.body, color: colors.ink[600] },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.surface.border, overflow: 'hidden' },
  cardHead: { padding: spacing[3], gap: spacing[2], alignItems: 'flex-start' },
  what: { ...typography.bodyStrong, color: colors.ink[900] },
  meta: { ...typography.caption, color: colors.ink[500] },
  muted: { ...typography.body, color: colors.ink[500], padding: spacing[3] },
  waiting: { ...typography.caption, color: colors.ink[500], padding: spacing[3], borderTopWidth: 1, borderTopColor: colors.surface.border, backgroundColor: colors.ink[50] },
  supplier: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderTopWidth: 1, borderTopColor: colors.surface.border },
  pressed: { backgroundColor: colors.ink[50] },
  flex: { flex: 1, minWidth: 0 },
  supplierName: { ...typography.label, color: colors.ink[900] },
});
