import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CountryPicker } from './CountryPicker.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Mobile number: a country-code button plus a number field.
 *
 * The backend wants the two parts separately —
 * `mobile: { countryCode, number }` (`auth.validators.js`) — so they are kept
 * separate here rather than parsed out of one string at submit time.
 *
 * @param {{ country: object, number: string }} value
 */
export function MobileInput({ value, onChange, label = 'Mobile', error, disabled = false, required = false }) {
  const setCountry = (country) => onChange({ ...value, country });

  // Digits only. A pasted "+91 98765 43210" would otherwise fail the server's
  // 4–15 character rule for reasons the user cannot see.
  const setNumber = (raw) => onChange({ ...value, number: raw.replace(/\D/g, '').slice(0, 15) });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <View style={styles.row}>
        <CountryPicker value={value.country} onChange={setCountry} mode="dial" disabled={disabled} />

        <View
          style={[
            styles.numberWrap,
            Boolean(error) && styles.numberError,
            disabled && styles.numberDisabled,
          ]}
        >
          <TextInput
            value={value.number}
            onChangeText={setNumber}
            placeholder="98765 43210"
            placeholderTextColor={colors.ink[400]}
            editable={!disabled}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            accessibilityLabel={label}
            style={styles.numberInput}
          />
        </View>
      </View>

      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  label: { ...typography.label, color: colors.ink[700] },
  required: { color: colors.danger.DEFAULT },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  numberWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface.DEFAULT,
  },
  numberError: { borderColor: colors.danger.DEFAULT, backgroundColor: colors.danger[50] },
  numberDisabled: { backgroundColor: colors.ink[100], opacity: 0.7 },
  numberInput: { ...typography.body, color: colors.ink[900], paddingVertical: spacing[3] },
  errorText: { ...typography.caption, color: colors.danger.DEFAULT },
});
