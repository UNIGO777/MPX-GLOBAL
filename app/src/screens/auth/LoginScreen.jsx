import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { colors, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { collectErrors, validateIdentifier } from '../../utils/validation.js';
import { PORTAL_LABEL } from './portals.js';

/**
 * Screen 3 · Login, portal-scoped. One design rendered twice.
 *
 * 🔴 Two constraints that must not be "improved" later:
 *
 *  1. There is NO portal selector here (brief rule 2). The portal arrives from
 *     the Welcome screen as a route param and is shown back only as identity —
 *     "Buyer sign-in". Switching portal means going back, which is what the
 *     back arrow does.
 *
 *  2. Wrong password, unknown email, and an email that exists only on the OTHER
 *     portal all produce the identical "Invalid credentials." (brief rule 1).
 *     The server already guarantees this; the screen must not undo it by
 *     inferring a friendlier message, offering a "switch portal?" hint, or
 *     attaching the error to a field. The banner sits above the form.
 *
 * Login does not establish a session — it returns an OTP challenge.
 */
export function LoginScreen({ navigation, route }) {
  const portal = route.params?.portal ?? 'buyer';
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const errors = collectErrors({
      identifier: validateIdentifier(identifier),
      // Only presence is checked. A client-side "too short" here would leak
      // that the stored password has a minimum the attempt did not meet.
      password: password ? null : 'Enter your password.',
    });

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const { loginToken, method, sentTo } = await login({
        identifier: identifier.trim(),
        password,
        portal,
      });

      navigation.navigate('Otp', {
        loginToken,
        method,
        // The server's mask of where the code really went — see OtpScreen.
        sentTo,
        destination: identifier.trim(),
        context: 'login',
        portal,
      });
    } catch (error) {
      // Server message verbatim — it is already the generic one.
      setFormError(toAppError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NavyCanopy
      title={`${PORTAL_LABEL[portal]} sign-in`}
      subtitle={
        portal === 'buyer'
          ? 'Access your global sourcing dashboard.'
          : 'Access your export catalogue and enquiries.'
      }
      onBack={() => navigation.goBack()}
      sheetTone="subtle"
      footer={
        <Button label="Sign in" onPress={submit} loading={submitting} disabled={submitting} />
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
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          editable={!submitting}
        />

        <View>
          <View style={styles.passwordRow}>
            <Text style={styles.passwordLabel}>Password</Text>
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword', { portal })}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Forgot?</Text>
            </Pressable>
          </View>
          <Input
            leftIcon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            error={fieldErrors.password}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!submitting}
            accessibilityLabel="Password"
          />
        </View>
      </View>

      <View style={styles.footerLinks}>
        <Text style={styles.footerText}>
          {portal === 'buyer' ? "Don't have a buyer account?" : "Don't have an exporter account?"}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('SignupAccount', { portal })}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.link}>Create account</Text>
        </Pressable>
      </View>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  passwordLabel: { ...typography.label, color: colors.ink[700] },
  link: { ...typography.label, color: colors.primary[600] },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[6],
  },
  footerText: { ...typography.caption, color: colors.ink[700] },
});
