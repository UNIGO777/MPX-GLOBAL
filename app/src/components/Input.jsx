import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Text field with label, helper text and error state.
 *
 * `secureTextEntry` gets a show/hide toggle: on a phone keyboard a masked
 * password is a genuine source of failed logins, and hiding it by default with
 * an explicit reveal is the accepted trade-off.
 *
 * The error string is rendered verbatim — pass the server's message through
 * rather than substituting a friendlier guess. The backend is deliberate about
 * what it does and does not disclose.
 */
export const Input = forwardRef(function Input(
  {
    label,
    value,
    onChangeText,
    placeholder,
    helperText,
    error,
    disabled = false,
    secureTextEntry = false,
    required = false,
    leftIcon,
    style,
    ...textInputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const hasError = Boolean(error);
  const isSecure = secureTextEntry && !revealed;

  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrap,
          focused && styles.focused,
          hasError && styles.errored,
          disabled && styles.disabled,
        ]}
      >
        {leftIcon ? (
          // Decorative: the field already has a real label, so announcing the
          // icon too would just be noise for a screen reader.
          <Ionicons
            name={leftIcon}
            size={20}
            color={colors.ink[400]}
            style={styles.leftIcon}
            accessible={false}
          />
        ) : null}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink[400]}
          editable={!disabled}
          secureTextEntry={isSecure}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          style={[typography.body, styles.input]}
          {...textInputProps}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            disabled={disabled}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={styles.reveal}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.ink[500]}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Error replaces helper text rather than stacking — two messages under
          one field is noise, and the error is always the more urgent one. */}
      {hasError ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  label: { ...typography.label, color: colors.ink[700] },
  required: { color: colors.danger.DEFAULT },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: spacing[3],
  },
  focused: { borderColor: colors.primary[600] },
  errored: { borderColor: colors.danger.DEFAULT, backgroundColor: colors.danger[50] },
  disabled: { backgroundColor: colors.ink[100], opacity: 0.7 },
  input: { flex: 1, color: colors.ink[900], paddingVertical: spacing[3] },
  leftIcon: { marginRight: spacing[2] },
  reveal: { paddingLeft: spacing[2] },
  helperText: { ...typography.caption, color: colors.muted },
  errorText: { ...typography.caption, color: colors.danger.DEFAULT },
});
