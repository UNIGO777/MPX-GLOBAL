import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { PasswordStrength } from '../../components/PasswordStrength.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import {
  collectErrors,
  validateConfirmPassword,
  validatePassword,
} from '../../utils/validation.js';

/**
 * Screen 16 sub-screen · Change password (design brief §2.4).
 *
 * `POST /auth/change-password` bumps `tokenVersion` and rotates the session
 * server-side (auth-sessions A7) — every OTHER device is signed out. This
 * device gets a fresh token pair back, so `AuthContext.changePassword` applies
 * it and the user stays signed in here without a fresh OTP challenge.
 *
 * "Wrong current password" is a real, attributable error — unlike login, this
 * caller has already proved who they are (a valid access token), so pointing
 * at the current-password field does not leak anything a stranger could use.
 */
export function ChangePasswordScreen({ navigation }) {
  const { completeSignIn } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const errors = collectErrors({
      currentPassword: currentPassword ? null : 'Enter your current password.',
      newPassword: validatePassword(newPassword),
      confirm: validateConfirmPassword(newPassword, confirm),
    });

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const tokens = await authApi.changePassword({ currentPassword, newPassword });
      // Applies the fresh token pair so this device's session survives the
      // tokenVersion bump that just signed out every OTHER device. Shared with
      // verify-otp / A21 signup — see AuthContext's own note on why.
      await completeSignIn(tokens);
      setDone(true);
    } catch (error) {
      setFormError(toAppError(error));
      setCurrentPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <NavyCanopy
        title="Password updated"
        footer={<Button label="Done" onPress={() => navigation.goBack()} />}
      >
        <View style={styles.doneBody}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} accessible={false} />
          </View>
          <Text style={styles.doneText}>
            For your security, you&apos;ve been signed out everywhere else. This device stays
            signed in.
          </Text>
        </View>
      </NavyCanopy>
    );
  }

  return (
    <NavyCanopy
      title="Change password"
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        <Button label="Update password" onPress={submit} loading={submitting} disabled={submitting} />
      }
    >
      <View style={styles.form}>
        <FormError error={formError} />

        <Input
          label="Current password"
          leftIcon="lock-closed-outline"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          error={fieldErrors.currentPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          editable={!submitting}
          required
        />

        <View>
          <Input
            label="New password"
            leftIcon="lock-closed-outline"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            error={fieldErrors.newPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!submitting}
            required
          />
          <PasswordStrength password={newPassword} style={styles.strength} />
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
          required
        />
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
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
