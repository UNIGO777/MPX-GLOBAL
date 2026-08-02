import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Six-box OTP entry with auto-advance and paste support.
 *
 * Implemented as ONE hidden TextInput behind six drawn boxes rather than six
 * real inputs. That is what makes paste and iOS/Android SMS autofill work: the
 * platform hands the whole code to a single field, and six separate inputs
 * would take only the first character. Backspace across boxes also stays
 * correct for free.
 *
 * The value never leaves this component except through `onChange` — an OTP is
 * never logged, never put in navigation params, never persisted.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  disabled = false,
  autoFocus = true,
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);

  const digits = useMemo(() => value.padEnd(length, ' ').slice(0, length).split(''), [value, length]);

  const handleChange = (raw) => {
    const next = raw.replace(/\D/g, '').slice(0, length);
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        disabled={disabled}
        accessibilityRole="none"
        accessibilityLabel={`Enter the ${length} digit code`}
        style={styles.boxes}
      >
        {digits.map((digit, index) => {
          const isActive = focused && index === activeIndex;
          return (
            <View
              key={index}
              style={[
                styles.box,
                isActive && styles.boxActive,
                Boolean(error) && styles.boxError,
                disabled && styles.boxDisabled,
              ]}
            >
              <Text style={styles.digit}>{digit.trim()}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        maxLength={length}
        caretHidden
        style={styles.hiddenInput}
      />

      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  box: {
    flex: 1,
    aspectRatio: 0.8,
    maxWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface.DEFAULT,
  },
  boxActive: { borderColor: colors.primary[600], borderWidth: 2 },
  boxError: { borderColor: colors.danger.DEFAULT, backgroundColor: colors.danger[50] },
  boxDisabled: { backgroundColor: colors.ink[100], opacity: 0.7 },
  digit: { ...typography.h1, color: colors.ink[900] },
  // Kept in the tree (not display:none) so the platform still routes SMS
  // autofill to it; visually collapsed and un-hittable.
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  errorText: { ...typography.caption, color: colors.danger.DEFAULT },
});
