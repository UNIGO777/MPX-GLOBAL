import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { maskDestination } from '../../utils/mask.js';
import { collectErrors, validateIdentifier } from '../../utils/validation.js';

/**
 * Screen 5 · Forgot password.
 *
 * 🔴 The confirmation is deliberately unconditional: "If an account exists, a
 * reset code has been sent." That is exactly what the backend answers, and the
 * screen must not improve on it. Any variation — a different message when the
 * account is unknown, a shorter path when it is known — turns this form into an
 * account-enumeration oracle.
 *
 * The sent state therefore says nothing about whether the account exists, and
 * "Enter reset code" is offered either way.
 */
export function ForgotPasswordScreen({ navigation, route }) {
  const portal = route.params?.portal ?? 'buyer';

  const [identifier, setIdentifier] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const errors = collectErrors({ identifier: validateIdentifier(identifier) });
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await authApi.forgotPassword({ identifier: identifier.trim(), portal });
      setSent(true);
    } catch (error) {
      // Only a transport or rate-limit failure reaches here — the endpoint
      // answers 200 whether or not the account exists.
      setFormError(toAppError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <NavyCanopy
        title="Check your messages"
        subtitle="If an account exists, a reset code is on its way."
        onBack={() => navigation.goBack()}
        footer={
          <Button
            label="Enter reset code"
            onPress={() =>
              navigation.navigate('ResetPassword', { portal, identifier: identifier.trim() })
            }
          />
        }
      >
        <View style={styles.sentBody}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-outline" size={28} color={colors.primary[700]} accessible={false} />
          </View>
          <Text style={styles.sentTitle}>Sent to {maskDestination(identifier.trim())}</Text>
          <Text style={styles.sentText}>
            The code is valid for 5 minutes. If nothing arrives, check the address you entered and
            try again.
          </Text>
        </View>
      </NavyCanopy>
    );
  }

  return (
    <NavyCanopy
      title="Reset your password"
      subtitle="We'll send a code to the email or mobile on your account."
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        <Button label="Send reset code" onPress={submit} loading={submitting} disabled={submitting} />
      }
    >
      <View style={styles.form}>
        <FormError error={formError} />

        <Input
          label="Email or mobile"
          leftIcon="person-outline"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="name@company.com"
          error={fieldErrors.identifier}
          helperText="Mobile must include country code, e.g. +91…"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!submitting}
        />
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  sentBody: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[4] },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  sentTitle: { ...typography.h3, color: colors.ink[900], textAlign: 'center' },
  sentText: { ...typography.body, color: colors.muted, textAlign: 'center' },
});
