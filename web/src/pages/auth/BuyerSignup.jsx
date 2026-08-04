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
 * Buyer signup · STEP 1 — identity only.
 *
 * A21 splits signup: this form takes name, email, phone and password and
 * nothing about the company. The company moves to step 2 (`SignupCompany`),
 * behind verification of BOTH channels.
 *
 * That ordering is the security fix, not a layout preference: signup used to
 * create the User and the Organisation here, before anyone proved they owned
 * the email or the phone. Because `(email, role)` and `(mobile, role)` are
 * unique, that let a stranger's address be permanently taken. Now this call
 * creates nothing — it only starts a short-lived pending signup and sends two
 * codes.
 */
export function BuyerSignup() {
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
        role: 'buyer',
      });
      // `email` / `mobile` come back MASKED — the verify screen shows them but
      // never holds the raw address.
      navigate('/signup/verify', {
        state: {
          signupToken: started.signupToken,
          email: started.email,
          mobile: started.mobile,
          role: 'buyer',
          signupPath: '/signup/buyer',
        },
      });
    } catch (err) {
      const { message, fields, status } = apiError(err, 'Could not create your account.');
      if (status === 409) setDuplicate(true);
      const mapped = fieldErrorMap(fields);
      // mobile.* issues render on the one mobile field
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
      headline="Source directly from Indian exporters."
      sub="Create a buyer account and start finding suppliers today. It's free, and you can use the platform straight away."
      bullets={[
        'Verified suppliers carry a visible tick',
        'Message exporters directly, no middlemen',
        'Suppliers across 20+ export categories',
      ]}
      footNote="Already trading with India? You'll feel at home."
    >
      {/* Every other screen in this chain counts its step (SignupVerify 2 and 3,
          SignupCompany 4) — starting the count at screen two left the buyer with
          no idea the flow had further steps. Buyer = 4, exporter = 5. */}
      <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-600">
        Step 1 of 4
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">Create your buyer account</h2>
      <p className="mt-2 text-sm text-muted">Free to join. Start finding suppliers right away.</p>

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

        {/* A21 step 1 is identity ONLY — name · email · mobile · password ·
            confirm. Company and country moved to step 2, behind verification. */}
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="John Doe"
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name}
          disabled={loading}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="john@company.com"
          value={form.email}
          onChange={set('email')}
          error={fieldErrors.email}
          disabled={loading}
        />
        <MobileInput
          value={form.mobile}
          onChange={set('mobile')}
          error={fieldErrors.mobile}
          helper="We'll send a sign-in code to this number."
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
        {/* pt-3 rather than an !important margin override — same CTA spacing as
            every other auth screen, and it survives a change to the form's
            space-y. */}
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
          <Link to="/signup/exporter" className="font-semibold text-primary-600 hover:underline">
            Sign up as Exporter
          </Link>
        </p>

        {/* Design's closing fine print. Terms of Service and Privacy Policy are
            NOT links — those pages don't exist yet, and a dead link here is
            worse than plain text. Logged in docs/UiWebNotes.md. */}
        <p className="text-center text-xs leading-relaxed text-ink-400">
          By creating an account, you agree to our Terms of Service and Privacy Policy. MPX Global
          ensures your data is protected with enterprise-grade security.
        </p>
      </form>
    </AuthLayout>
  );
}
