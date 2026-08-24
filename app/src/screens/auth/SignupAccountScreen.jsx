import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { Input } from '../../components/Input.jsx';
import { MobileInput } from '../../components/MobileInput.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { PasswordStrength } from '../../components/PasswordStrength.jsx';
import { DEFAULT_COUNTRY } from '../../constants/countries.js';
import { colors, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { openLegal } from '../../utils/legal.js';
import {
  collectErrors,
  validateConfirmPassword,
  validateEmail,
  validateMobile,
  validateName,
  validatePassword,
} from '../../utils/validation.js';
import { PORTAL_LABEL } from './portals.js';
import { signupDraft } from './signupDraft.js';

/**
 * Screen 7 · Signup step 1 — your account. Shared by both portals.
 *
 * Nothing about the company appears here (brief rule: step 1 is the person).
 *
 * ✅ The brief's original order is now what actually ships: step 1 → verify →
 * step 2, with the company behind verification. The earlier deviation existed
 * only because the backend had a single signup call that demanded the company up
 * front; A21 replaced it, so the workaround is gone.
 *
 * This step DOES make a network call now — and it deliberately creates nothing.
 * It opens a short-lived pending signup and sends two codes (email + phone).
 * Until both are proved there is no User and no Organisation, which is what
 * stops a stranger's email or phone being permanently taken.
 */
export function SignupAccountScreen({ navigation, route }) {
  const portal = route.params?.portal ?? 'buyer';

  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: { country: DEFAULT_COUNTRY, number: '' },
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const next = async () => {
    const found = collectErrors({
      name: validateName(form.name),
      email: validateEmail(form.email),
      mobile: validateMobile(form.mobile),
      password: validatePassword(form.password),
      confirm: validateConfirmPassword(form.password, form.confirm),
    });

    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      // A21: this creates NOTHING. It opens a short-lived pending signup and
      // sends one code to the email and another to the phone. The password is
      // hashed server-side here, so the plaintext stops travelling with the
      // flow — the draft below no longer carries it.
      const started = await authApi.signupStart({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: { countryCode: form.mobile.country.dial, number: form.mobile.number },
        password: form.password,
        role: portal,
      });

      // Token in the in-memory holder, not a navigation param (signupDraft.js).
      // `email` / `mobile` come back MASKED, so nothing here is the raw address.
      signupDraft.set({
        signupToken: started.signupToken,
        email: started.email,
        mobile: started.mobile,
        role: portal,
      });

      navigation.navigate('SignupVerify', { portal });
    } catch (error) {
      setFormError(toAppError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NavyCanopy
      eyebrow="STEP 1 OF 4"
      title="Create account"
      subtitle={`Start trading on MPX Global as ${
        portal === 'buyer' ? 'a buyer' : 'an exporter'
      }.`}
      onBack={() => navigation.goBack()}
      footer={<Button label="Continue" onPress={next} loading={submitting} />}
    >
      <FormError error={formError} />

      <View style={styles.form}>
        <Input
          label="Full legal name"
          leftIcon="person-outline"
          value={form.name}
          onChangeText={set('name')}
          placeholder="As it appears on your documents"
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          required
        />

        <Input
          label="Work email address"
          leftIcon="mail-outline"
          value={form.email}
          onChangeText={set('email')}
          placeholder="name@company.com"
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          required
        />

        <MobileInput
          label="Mobile"
          value={form.mobile}
          onChange={set('mobile')}
          error={errors.mobile}
          required
        />

        <View>
          <Input
            label="Create password"
            leftIcon="lock-closed-outline"
            value={form.password}
            onChangeText={set('password')}
            placeholder="At least 8 characters"
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            required
          />
          <PasswordStrength password={form.password} style={styles.strength} />
        </View>

        <Input
          label="Confirm password"
          leftIcon="lock-closed-outline"
          value={form.confirm}
          onChangeText={set('confirm')}
          placeholder="Re-enter your password"
          error={errors.confirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={next}
          required
        />
      </View>

      <View style={styles.footerLinks}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable
          onPress={() => navigation.navigate('Login', { portal })}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>

      <Text style={styles.portalNote}>
        You&apos;re creating {portal === 'buyer' ? 'a' : 'an'} {PORTAL_LABEL[portal].toLowerCase()}{' '}
        account. You can open the other type later with the same email.
      </Text>

      {/* ✅ 2026-08-23. The mockup had an "I agree to the Terms of Service and
          Privacy Policy" checkbox that was never built, because neither document
          existed — a consent control pointing at nothing is worse than none.
          Both now exist on the website, so this states the consent and links to
          them. Kept as a statement rather than a checkbox: the server has no
          field to record a tick against, so a checkbox would imply we store an
          agreement we do not. */}
      <Text style={styles.legalNote}>
        By continuing you agree to our{' '}
        <Text style={styles.legalLink} onPress={() => openLegal('/terms')}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={styles.legalLink} onPress={() => openLegal('/privacy')}>
          Privacy Policy
        </Text>
        .
      </Text>
    </NavyCanopy>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  strength: { marginTop: spacing[2] },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[6],
  },
  footerText: { ...typography.caption, color: colors.ink[700] },
  link: { ...typography.label, color: colors.primary[600] },
  portalNote: {
    ...typography.tiny,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing[3],
  },
  legalNote: {
    ...typography.tiny,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  legalLink: { color: colors.primary[600], textDecorationLine: 'underline' },
});
