import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { OtpInput } from '../../components/OtpInput.jsx';
import { PasswordStrength } from '../../components/PasswordStrength.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import {
  collectErrors,
  validateConfirmPassword,
  validateIdentifier,
  validateOtp,
  validatePassword,
} from '../../utils/validation.js';

/**
 * Screen 6 · Reset password.
 *
 * The brief suggests splitting this across two steps if four fields cannot
 * breathe. It is kept as ONE scrolling screen with a pinned footer, for a
 * reason the brief could not have known: `POST /auth/reset-password` takes the
 * code and the new password in a single call, and there is no endpoint that
 * validates a reset code on its own. Splitting the form would mean the user
 * types a whole new password before discovering the code was wrong, and the
 * server's single generic error could not be attributed to the right step.
 *
 * On success every other session dies — the backend bumps `tokenVersion` on a
 * password change — so the confirmation says so rather than letting the user
 * discover it on another device.
 */
const CODE_LENGTH = 6;

export function ResetPasswordScreen({ navigation, route }) {
  const portal = route.params?.portal ?? 'buyer';

  const [identifier, setIdentifier] = useState(route.params?.identifier ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const errors = collectErrors({
      identifier: validateIdentifier(identifier),
      code: validateOtp(code, CODE_LENGTH),
      password: validatePassword(password),
      confirm: validateConfirmPassword(password, confirm),
    });

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        identifier: identifier.trim(),
        code,
        newPassword: password,
        portal,
      });
      setDone(true);
    } catch (error) {
      setFormError(toAppError(error));
      // The code is the likeliest culprit and is cheap to retype; the password
      // fields are left alone so the user does not lose a long passphrase.
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <NavyCanopy
        title="Password updated"
        subtitle="You can sign in with your new password."
        footer={
          <Button
            label="Back to sign in"
            onPress={() => navigation.navigate('Login', { portal })}
          />
        }
      >
        <View style={styles.doneBody}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} accessible={false} />
          </View>
          <Text style={styles.doneText}>
            For your security, you&apos;ve been signed out everywhere else. Any other device will
            need to sign in again.
          </Text>
        </View>
      </NavyCanopy>
    );
  }

  return (
    <NavyCanopy
      title="Set a new password"
      subtitle="Enter the code we sent, then choose a new password."
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        <Button
          label="Update password"
          onPress={submit}
          loading={submitting}
          disabled={submitting}
        />
      }
    >
      <View style={styles.form}>
        <FormError error={formError} />

        <Input
          label="Email or mobile"
          leftIcon="person-outline"
          value={identifier}
          onChangeText={setIdentifier}
          error={fieldErrors.identifier}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
        />

        <View style={styles.codeBlock}>
          <Text style={styles.label}>Reset code</Text>
          <OtpInput
            value={code}
            onChange={setCode}
            length={CODE_LENGTH}
            error={fieldErrors.code}
            disabled={submitting}
            autoFocus={false}
          />
        </View>

        <View>
          <Input
            label="New password"
            leftIcon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            error={fieldErrors.password}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!submitting}
          />
          <PasswordStrength password={password} style={styles.strength} />
        </View>

        <Input
          label="Confirm new password"
          leftIcon="lock-closed-outline"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          error={fieldErrors.confirm}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
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
  codeBlock: { gap: spacing[2] },
  label: { ...typography.label, color: colors.ink[700] },
  strength: { marginTop: spacing[2] },
  doneBody: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[4] },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F7EF',
  },
  doneText: { ...typography.body, color: colors.muted, textAlign: 'center' },
});
