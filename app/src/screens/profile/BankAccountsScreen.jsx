import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert as RNAlert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { bankAccountsApi } from '../../api/quotations.js';
import { Button } from '../../components/Button.jsx';
import { Input } from '../../components/Input.jsx';
import { ScreenContainer } from '../../components/ScreenContainer.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';

/**
 * The bank details a quotation prints — the app's half (owner, 2026-09-25).
 *
 * 🔴 **DISPLAY-ONLY, which is what keeps it inside C1.** `security-baseline.md`
 * forbids bank details that are AUTHORITATIVE — ones our code could send to a
 * payment API and redirect money with. These are printed on a document the buyer
 * pays against directly; the platform never touches that money and no payout
 * path may ever read them.
 *
 * 🔴 **The full number never comes back.** The API returns `••••4444` and
 * nothing else (`accountNumber` is `select: false` on the model, and the stored
 * value is encrypted at rest). So an edit cannot pre-fill it: the exporter
 * re-types the number, or leaves it blank to keep the stored one. Deliberate
 * friction, not an oversight — and the field says so.
 *
 * 🔴 **A quotation SNAPSHOTS these at send.** Editing here never changes a
 * document already in a buyer's hands, which is the whole reason the quotation
 * copies them instead of linking. Said on screen, because an exporter fixing a
 * typo will reasonably wonder.
 *
 * ⚠️ Exporter-only, and the server agrees: `/me/bank-accounts` refuses any other
 * role outright. Hiding the row on the profile is convenience, not the control.
 */
const BLANK = { label: '', beneficiary: '', bankName: '', accountNumber: '', ifsc: '', swift: '' };

export function BankAccountsScreen() {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null); // null = list; object = add/edit form
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await bankAccountsApi.list());
      setLoadError(null);
    } catch (err) {
      setLoadError(toAppError(err).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        label: form.label.trim() || form.bankName.trim() || 'Bank account',
        beneficiary: form.beneficiary.trim(),
        bankName: form.bankName.trim(),
        ...(form.ifsc.trim() ? { ifsc: form.ifsc.trim().toUpperCase() } : {}),
        ...(form.swift.trim() ? { swift: form.swift.trim().toUpperCase() } : {}),
      };
      // Blank on an edit means "keep the stored number" — the API never sent it
      // back, so there is nothing to resubmit unless it is changing.
      if (form.accountNumber.trim()) body.accountNumber = form.accountNumber.trim();

      if (editing) await bankAccountsApi.update(editing.id, body);
      else await bankAccountsApi.create(body);

      setForm(null);
      setEditing(null);
      await load();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (row) => {
    RNAlert.alert(
      'Remove these bank details?',
      `“${row.label}” (${row.masked}) will no longer be offered when a quotation is sent. Quotations already sent keep the details they were sent with.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await bankAccountsApi.remove(row.id);
              await load();
            } catch (err) {
              setError(toAppError(err).message);
            }
          },
        },
      ],
    );
  };

  const start = (row) => {
    setEditing(row ?? null);
    setError(null);
    setForm(
      row
        ? {
            label: row.label ?? '',
            beneficiary: row.beneficiary ?? '',
            bankName: row.bankName ?? '',
            accountNumber: '',
            ifsc: row.ifsc ?? '',
            swift: row.swift ?? '',
          }
        : { ...BLANK },
    );
  };

  const incomplete =
    form &&
    (!form.beneficiary.trim() || !form.bankName.trim() || (!editing && !form.accountNumber.trim()));

  if (form) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{editing ? 'Edit bank details' : 'Add bank details'}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Input
            label="Account holder"
            value={form.beneficiary}
            onChangeText={(v) => setForm((f) => ({ ...f, beneficiary: v }))}
            placeholder="As the bank has it"
          />
          <Input
            label="Bank"
            value={form.bankName}
            onChangeText={(v) => setForm((f) => ({ ...f, bankName: v }))}
          />
          <Input
            label="Account number"
            value={form.accountNumber}
            onChangeText={(v) => setForm((f) => ({ ...f, accountNumber: v }))}
            autoCapitalize="characters"
            placeholder={editing ? `Leave blank to keep ${editing.masked}` : ''}
            helperText={
              editing
                ? 'We never show a stored number back, so type it again only if it is changing.'
                : 'Digits, letters, spaces and dashes.'
            }
          />
          <Input
            label="IFSC"
            value={form.ifsc}
            onChangeText={(v) => setForm((f) => ({ ...f, ifsc: v }))}
            autoCapitalize="characters"
          />
          <Input
            label="SWIFT / BIC"
            value={form.swift}
            onChangeText={(v) => setForm((f) => ({ ...f, swift: v }))}
            autoCapitalize="characters"
          />
          <Input
            label="Name for this account"
            value={form.label}
            onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
            placeholder="HDFC current"
            helperText="Only you see this — it is how you pick the right account when sending."
          />

          <Text style={styles.note}>
            A quotation copies these details when it is sent, so changing them here never alters a
            quotation a buyer already has. Stored encrypted. MPX Global does not hold or move your
            money — these are printed for the buyer to pay you directly.
          </Text>

          <Button label={editing ? 'Save changes' : 'Add account'} onPress={save} loading={busy} disabled={incomplete} />
          <Button label="Cancel" variant="ghost" onPress={() => { setForm(null); setEditing(null); }} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Bank details for quotations</Text>
        <Text style={styles.lead}>
          These print on the quotations you send, so a buyer knows where to pay. You pick which
          account each quotation carries when you send it.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {rows === null && !loadError ? (
          <ActivityIndicator style={{ marginTop: spacing[6] }} color={colors.primary[600]} />
        ) : null}

        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

        {rows?.length === 0 ? (
          <Text style={styles.empty}>
            No bank details yet. Quotations you send will print without payment details.
          </Text>
        ) : null}

        {(rows ?? []).map((b) => (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{b.label}</Text>
              {b.isDefault ? (
                <View style={styles.defaultChip}>
                  <Text style={styles.defaultChipText}>Default</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardLine}>
              {b.beneficiary} · {b.bankName}
              {b.branch ? ` · ${b.branch}` : ''}
            </Text>
            {/* 🔴 The mask, never the number. The API does not return it. */}
            <Text style={styles.cardNumber}>
              {b.masked}
              {b.ifsc ? ` · IFSC ${b.ifsc}` : ''}
              {b.swift ? ` · SWIFT ${b.swift}` : ''}
            </Text>

            <View style={styles.cardActions}>
              <Pressable onPress={() => start(b)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.action}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmRemove(b)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${b.label}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.ink[400]} />
              </Pressable>
            </View>
          </View>
        ))}

        <Button label="Add bank details" variant="secondary" onPress={() => start(null)} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  title: { ...typography.h2, color: colors.ink[900] },
  lead: { ...typography.caption, color: colors.ink[600] },
  note: { ...typography.tiny, color: colors.ink[500], lineHeight: 18 },
  empty: {
    ...typography.caption,
    color: colors.ink[500],
    textAlign: 'center',
    paddingVertical: spacing[5],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
  },
  error: {
    ...typography.caption,
    color: colors.danger[800],
    backgroundColor: colors.danger[100],
    borderRadius: radii.md,
    padding: spacing[3],
  },
  card: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    padding: spacing[3],
    backgroundColor: colors.white,
    gap: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardTitle: { ...typography.bodyStrong, color: colors.ink[900] },
  defaultChip: { backgroundColor: colors.primary[50], borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  defaultChipText: { ...typography.tiny, color: colors.primary[700], fontWeight: '700' },
  cardLine: { ...typography.caption, color: colors.ink[500] },
  cardNumber: { ...typography.caption, color: colors.ink[800] },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[4], marginTop: spacing[2] },
  action: { ...typography.label, color: colors.primary[700] },
});
