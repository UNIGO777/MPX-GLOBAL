import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { leadsApi } from '../../api/support.js';
import { Button } from '../../components/Button.jsx';
import { CountryPicker } from '../../components/CountryPicker.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { UnitPicker } from '../../components/UnitPicker.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';

/** New "find me a supplier" request (Step 1d). */
export function NewLeadScreen({ navigation }) {
  const [what, setWhat] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [country, setCountry] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      await leadsApi.create({
        what: what.trim(),
        ...(Number(quantity) > 0 ? { quantity: Number(quantity) } : {}),
        ...(unit ? { unit } : {}),
        ...(country?.code ? { destinationCountry: country.code } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      navigation.goBack();
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <NavyCanopy
      title="Find me a supplier"
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={<Button label="Send request" onPress={submit} loading={sending} disabled={what.trim().length < 3 || sending} />}
    >
      <View style={styles.form}>
        <FormError error={error} />
        <Text style={styles.label}>What are you looking for?</Text>
        <TextInput
          value={what}
          onChangeText={setWhat}
          placeholder="e.g. Organic cotton fabric, 180 gsm, white"
          placeholderTextColor={colors.ink[400]}
          multiline
          maxLength={200}
          style={styles.textarea}
          textAlignVertical="top"
          accessibilityLabel="What are you looking for?"
        />
        <Text style={styles.help}>This becomes your first message to each supplier we connect.</Text>
        <Input label="Quantity (optional)" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="5000" />
        <UnitPicker label="Unit (optional)" value={unit} onChange={setUnit} />
        <CountryPicker label="Deliver to (optional)" value={country} onChange={setCountry} />
        <Text style={styles.label}>Anything else? (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Certifications, budget, timing — only our team sees this."
          placeholderTextColor={colors.ink[400]}
          multiline
          maxLength={500}
          style={styles.textarea}
          textAlignVertical="top"
          accessibilityLabel="Anything else"
        />
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[3] },
  label: { ...typography.label, color: colors.ink[800] },
  help: { ...typography.caption, color: colors.ink[500], marginTop: -spacing[2] },
  textarea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    padding: spacing[3],
    ...typography.body,
    color: colors.ink[900],
  },
});
