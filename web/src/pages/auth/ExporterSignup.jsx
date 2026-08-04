import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { apiError, fieldErrorMap } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { MobileInput } from '../../components/ui/MobileInput.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';

/**
 * Exporter signup · STEP 1 — identity only.
 *
 * This WAS a three-pane wizard (company → entity type → address) that created
 * the account in one call. A21 says step 1 is "one shared form for both sides:
 * name, email, phone, password. Nothing about the company" — so those panes
 * moved to `SignupCompany`, behind verification of BOTH channels. Nothing was
 * dropped: every field is still captured, one step later.
 *
 * 🔴 The step-2 divergence still stands (owner decision 2026-07-30): registration
 * number / tax ID / year established are NOT captured at signup — the backend
 * strips `businessProfile` there, and they are collected at verification.
 *
 * The reordering is the security fix. Creating the User and the Organisation on
 * this form let anyone permanently take a stranger's email or phone — both are
 * uniquely indexed per role — with no proof of ownership. This call now creates
 * nothing; it starts a short-lived pending signup and sends two codes.
 */
export function ExporterSignup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: { countryCode: '+91', number: '' },
    password: '',
    confirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [duplicate, setDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  const validateLocal = () => {
    const fe = {};
    if (!form.name.trim()) fe.name = 'Enter your full name.';
    if (!form.email.trim()) fe.email = 'Enter your work email.';
    if (!form.mobile.number.trim()) fe.mobile = 'Enter your mobile number.';
    if (form.password.length < 8) fe.password = 'At least 8 characters.';
    if (form.confirm !== form.password) fe.confirm = "Passwords don't match.";
    return fe;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setDuplicate(false);
    const fe = validateLocal();
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }
    setLoading(true);
    try {
      const started = await authApi.signupStart({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: { countryCode: form.mobile.countryCode, number: form.mobile.number.replace(/[\s-]/g, '') },
        password: form.password,
        role: 'exporter',
      });
      navigate('/signup/verify', {
        state: {
          signupToken: started.signupToken,
          // Masked by the server — the raw address never reaches router state.
          email: started.email,
          mobile: started.mobile,
          role: 'exporter',
          signupPath: '/signup/exporter',
        },
      });
    } catch (err) {
      const { message, fields, status } = apiError(err, 'Could not create your account.');
      if (status === 409) setDuplicate(true);
      const mapped = fieldErrorMap(fields);
      if (mapped['mobile.countryCode'] || mapped['mobile.number']) {
        mapped.mobile = mapped['mobile.countryCode'] ?? mapped['mobile.number'];
      }
      setFieldErrors(mapped);
      setError(message);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline="Sell to buyers worldwide, from India."
      sub="List your products, get found by serious importers, and earn the verified tick buyers filter for."
    >
      <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-600">
        Step 1 of 5
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">Create your exporter account</h2>
      <p className="mt-2 text-sm text-muted">
        Start with your details — your company comes next.
      </p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {error && (
          <Alert tone="danger">
            {error}
            {duplicate && (
              <>
                {' '}
                <Link to="/signin" className="font-semibold underline">
                  Sign in instead
                </Link>
              </>
            )}
          </Alert>
        )}

        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Priya Sharma"
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name}
          disabled={loading}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="priya@company.com"
          value={form.email}
          onChange={set('email')}
          error={fieldErrors.email}
          disabled={loading}
        />
        <MobileInput
          value={form.mobile}
          onChange={set('mobile')}
          error={fieldErrors.mobile}
          disabled={loading}
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password}
          helper="At least 8 characters."
          showStrength
          disabled={loading}
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.confirm}
          onChange={set('confirm')}
          error={fieldErrors.confirm}
          disabled={loading}
        />

        {/* pt-3 rather than an !important margin — same CTA spacing as every
            other auth screen, and it survives a change to the form's space-y. */}
        <div className="space-y-3 pt-3">
          <Button type="submit" fullWidth loading={loading}>
            Continue
          </Button>
          <p className="text-center text-xs text-muted">
            We&rsquo;ll send a code to your email and another to your phone. Both keep your
            account yours.
          </p>
        </div>

        <p className="mt-7 border-t border-surface-border pt-5 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/signin" className="font-semibold text-primary-600 hover:underline">
            Sign in
          </Link>
          {' · '}
          <Link to="/signup/buyer" className="font-semibold text-primary-600 hover:underline">
            Sign up as Buyer
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
