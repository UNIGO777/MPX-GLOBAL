import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { inquiriesApi } from '../api/inquiries.js';
import { Button } from '../components/Button.jsx';
import { CountryPicker } from '../components/CountryPicker.jsx';
import { Input } from '../components/Input.jsx';
import { useToast } from '../components/Toast.jsx';
import { CURRENCIES } from '../constants/currencies.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M4 app screen 2 — the enquiry form, full-screen and NOTE-FIRST (§0.2: only
 * the note is required; six inputs as a first impression suppress enquiries).
 * Replaces the note-only modal sheet the product page carried since M4-B
 * shipped — same endpoint, now with the typed fields behind an "Add details"
 * disclosure.
 *
 * The structured fields follow the product's category type, mirroring the
 * server's own field sets (`inquiry.validators.js`, locked O2): goods →
 * quantity+unit · target price+currency · delivery country · timeline;
 * services → engagement type · budget+currency · timeline · delivery model.
 * Unknown keys are REJECTED server-side, never stripped — so only these are
 * ever sent, and only when filled.
 *
 * 🔴 `targetPrice`/`budget` is the buyer's stated ask — NOT an offer flow.
 * Quotation/negotiation is deferred (Bucket A1); nothing here implies
 * accept/decline mechanics.
 *
 * Success lands IN THE THREAD (M4-5): 201 → the new conversation; 200 → the
 * existing one, with a line saying so. `navigation.replace` keeps back =
 * product page, not the spent form.
 */
export function EnquiryFormScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { productId, productName, productImage, sellerName, categoryType } = route.params ?? {};
  const isService = categoryType === 'service';

  const [note, setNote] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [fields, setFields] = useState({});
  const [country, setCountry] = useState(null); // picker object; `.code` is sent
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const set = (key) => (v) => setFields((f) => ({ ...f, [key]: v }));

  const buildFields = () => {
    const clean = (v) => {
      const t = typeof v === 'string' ? v.trim() : v;
      return t === '' || t == null ? undefined : t;
    };
    const num = (v) => (v != null && String(v).trim() !== '' ? Number(v) : undefined);
    const out = isService
      ? {
          engagementType: clean(fields.engagementType),
          budget: num(fields.budget),
          currency: fields.budget?.trim() ? (fields.currency ?? 'INR') : undefined,
          timeline: clean(fields.timeline),
          deliveryModel: clean(fields.deliveryModel),
        }
      : {
          quantity: num(fields.quantity),
          unit: clean(fields.unit),
          targetPrice: num(fields.targetPrice),
          currency: fields.targetPrice?.trim() ? (fields.currency ?? 'INR') : undefined,
          deliveryCountry: country?.code ?? undefined,
          deliveryTimeline: clean(fields.deliveryTimeline),
        };
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
  };

  const submit = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const result = await inquiriesApi.create({ productId, note: trimmed, fields: buildFields() });
      if (!result.created) {
        toast.show('You already have a conversation about this product — continuing it.', {
          tone: 'neutral',
          duration: 4000,
        });
      } else {
        toast.show(`Enquiry sent to ${sellerName ?? 'the seller'}.`, { tone: 'success' });
      }
      // Into the thread, with back = the product page (not the spent form).
      navigation.replace('ChatThread', { id: result.conversationId });
    } catch (error) {
      toast.show(toAppError(error).message, { tone: 'danger' });
    } finally {
      setSending(false);
    }
  };

  const currency = fields.currency ?? 'INR';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
          <Pressable
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.ink[900]} />
          </Pressable>
          <Text style={styles.title}>Send enquiry</Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* What this enquiry is about — the one anchor every thread has. */}
          <View style={styles.productCard}>
            {productImage ? (
              <Image source={{ uri: productImage }} style={styles.productThumb} />
            ) : (
              <View style={[styles.productThumb, styles.thumbFallback]}>
                <Ionicons name="image-outline" size={18} color={colors.ink[400]} accessible={false} />
              </View>
            )}
            <View style={styles.productText}>
              <Text style={styles.productName} numberOfLines={2}>
                {productName ?? 'Product'}
              </Text>
              {sellerName ? (
                <Text style={styles.productSeller} numberOfLines={1}>
                  {sellerName}
                </Text>
              ) : null}
            </View>
          </View>

          <Input
            label="Your message"
            required
            value={note}
            onChangeText={setNote}
            placeholder="What would you like to ask? Quantity, specs, delivery…"
            multiline
            numberOfLines={4}
            maxLength={200}
            style={styles.noteInput}
            helperText={`${note.trim().length}/200 · This starts the conversation — MPX Global stays part of the thread.`}
          />

          {/* Note-first: the typed fields hide behind one disclosure. */}
          <Pressable
            onPress={() => setShowDetails((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
            style={styles.disclosure}
          >
            <Ionicons
              name={showDetails ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={colors.primary[700]}
              accessible={false}
            />
            <Text style={styles.disclosureText}>Add details (optional)</Text>
          </Pressable>

          {showDetails ? (
            <View style={styles.detailFields}>
              {!isService ? (
                <>
                  <View style={styles.rowPair}>
                    <View style={styles.pairField}>
                      <Input
                        label="Quantity"
                        value={fields.quantity ?? ''}
                        onChangeText={set('quantity')}
                        keyboardType="numeric"
                        placeholder="e.g. 1000"
                      />
                    </View>
                    <View style={styles.pairField}>
                      <Input
                        label="Unit"
                        value={fields.unit ?? ''}
                        onChangeText={set('unit')}
                        placeholder="meter / kg / piece"
                        maxLength={40}
                      />
                    </View>
                  </View>
                  <View style={styles.rowPair}>
                    <View style={styles.pairField}>
                      <Input
                        label="Target price"
                        value={fields.targetPrice ?? ''}
                        onChangeText={set('targetPrice')}
                        keyboardType="numeric"
                        placeholder="Your stated ask"
                        helperText="Not an offer — just context"
                      />
                    </View>
                    <Pressable
                      onPress={() => setCurrencyOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Currency"
                      style={styles.currencyButton}
                    >
                      <Text style={styles.currencyText}>{currency}</Text>
                      <Ionicons name="chevron-down" size={14} color={colors.ink[600]} accessible={false} />
                    </Pressable>
                  </View>
                  <CountryPicker label="Delivery country" value={country} onChange={setCountry} />
                  <Input
                    label="Delivery timeline"
                    value={fields.deliveryTimeline ?? ''}
                    onChangeText={set('deliveryTimeline')}
                    placeholder="e.g. within 6 weeks"
                    maxLength={200}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Engagement type"
                    value={fields.engagementType ?? ''}
                    onChangeText={set('engagementType')}
                    placeholder="Project / hourly / dedicated team"
                    maxLength={120}
                  />
                  <View style={styles.rowPair}>
                    <View style={styles.pairField}>
                      <Input
                        label="Budget"
                        value={fields.budget ?? ''}
                        onChangeText={set('budget')}
                        keyboardType="numeric"
                        placeholder="Your stated budget"
                      />
                    </View>
                    <Pressable
                      onPress={() => setCurrencyOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Currency"
                      style={styles.currencyButton}
                    >
                      <Text style={styles.currencyText}>{currency}</Text>
                      <Ionicons name="chevron-down" size={14} color={colors.ink[600]} accessible={false} />
                    </Pressable>
                  </View>
                  <Input
                    label="Timeline"
                    value={fields.timeline ?? ''}
                    onChangeText={set('timeline')}
                    placeholder="e.g. 6–8 weeks"
                    maxLength={200}
                  />
                  <Input
                    label="Delivery model"
                    value={fields.deliveryModel ?? ''}
                    onChangeText={set('deliveryModel')}
                    placeholder="Remote / onsite / hybrid"
                    maxLength={120}
                  />
                </>
              )}
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <Button label="Send enquiry" loading={sending} disabled={note.trim().length === 0} onPress={submit} />
        </View>
      </KeyboardAvoidingView>

      {/* Currency sheet — same pattern as the product form's. */}
      {currencyOpen ? (
        <CurrencySheet
          current={currency}
          onPick={(c) => {
            setFields((f) => ({ ...f, currency: c }));
            setCurrencyOpen(false);
          }}
          onClose={() => setCurrencyOpen(false)}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

function CurrencySheet({ current, onPick, onClose, bottomInset }) {
  const [q, setQ] = useState('');
  const results = q.trim() ? CURRENCIES.filter((c) => c.toLowerCase().includes(q.trim().toLowerCase())) : CURRENCIES;
  return (
    <View style={styles.sheetScrim}>
      <Pressable style={styles.sheetScrimTouch} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, spacing[5]) }]}>
        <Text style={styles.sheetTitle}>Currency</Text>
        <View style={styles.sheetSearch}>
          <Ionicons name="search" size={16} color={colors.ink[400]} accessible={false} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search ISO code…"
            placeholderTextColor={colors.ink[400]}
            style={styles.sheetSearchInput}
            autoCapitalize="characters"
          />
        </View>
        <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
          {results.map((c) => (
            <Pressable
              key={c}
              onPress={() => onPick(c)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            >
              <Text style={styles.sheetRowText}>{c}</Text>
              {current === c ? <Ionicons name="checkmark" size={18} color={colors.primary[600]} accessible={false} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  backButton: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  title: { ...typography.h2, color: colors.ink[900] },

  body: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[8], gap: spacing[4] },

  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
  },
  productThumb: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface.DEFAULT },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productText: { flex: 1 },
  productName: { ...typography.bodyStrong, color: colors.ink[900] },
  productSeller: { ...typography.caption, color: colors.muted, marginTop: 1 },

  noteInput: { minHeight: 96 },

  disclosure: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingVertical: spacing[1] },
  disclosureText: { ...typography.label, color: colors.primary[700] },
  detailFields: { gap: spacing[4] },
  rowPair: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  pairField: { flex: 1 },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    marginTop: 26,
    paddingHorizontal: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
  },
  currencyText: { ...typography.bodyStrong, color: colors.ink[900] },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },

  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheetScrimTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    maxHeight: '70%',
  },
  sheetTitle: { ...typography.h3, color: colors.ink[900], marginBottom: spacing[2] },
  sheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 40,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing[3],
    marginBottom: spacing[2],
  },
  sheetSearchInput: { flex: 1, ...typography.body, color: colors.ink[900], paddingVertical: spacing[1] },
  sheetList: { maxHeight: 380 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  sheetRowPressed: { backgroundColor: colors.ink[50] },
  sheetRowText: { ...typography.body, color: colors.ink[900], flex: 1 },
});
