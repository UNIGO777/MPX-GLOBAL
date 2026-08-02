import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { MobileInput } from '../../components/ui/MobileInput.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';

/**
 * Buyer signup — one page. Mockup: mpx_global_buyer_registration_states.
 * Payload mirrors auth.validators.js `buyerSignup` exactly: {name, email,
 * mobile{countryCode,number}, password, company, country}. A 201 returns
 * {user, loginToken, method} and NO session (A21 §4a) — so success goes
 * straight to /otp, same screen the logins use.
 */

/** `fields: [{field:'body.email', message}]` → `{email: message, ...}`. */
export function fieldErrorMap(fields) {
  const map = {};
  for (const f of fields ?? []) {
    const key = String(f.field ?? '').replace(/^body\./, '');
    if (!map[key]) map[key] = f.message;
  }
  return map;
}

export function BuyerSignup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: { countryCode: '+91', number: '' },
    password: '',
    confirm: '',
    company: '',
    country: '',
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
    if (!form.company.trim()) fe.company = 'Enter your company name.';
    if (!form.country) fe.country = 'Choose your country.';
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
      const { loginToken, method } = await authApi.buyerSignup({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: { countryCode: form.mobile.countryCode, number: form.mobile.number.replace(/[\s-]/g, '') },
        password: form.password,
        company: form.company.trim(),
        country: form.country,
      });
      navigate('/otp', {
        state: {
          loginToken,
          method,
          identifier: form.email.trim(),
          backTo: '/signup/buyer',
          notice: "You're in. One last step — verify the code we just sent you.",
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
      headline="Source directly from verified Indian exporters."
      sub="Create a buyer account and start finding suppliers today. It's free, and you can use the platform straight away."
    >
      <h2 className="text-[28px] font-bold text-ink-900">Create your buyer account</h2>
      <p className="mt-1 text-base text-muted">Free to join. Start finding suppliers right away.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
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

        {/* Single column, mockup field order: name · email · mobile · password
            · confirm · company · country. */}
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
        <Input
          label="Company name"
          autoComplete="organization"
          placeholder="Global Trade LLC"
          value={form.company}
          onChange={set('company')}
          error={fieldErrors.company}
          disabled={loading}
        />
        <CountrySelect
          value={form.country}
          onChange={set('country')}
          error={fieldErrors.country}
          disabled={loading}
        />

        <Button type="submit" fullWidth loading={loading} className="!mt-8">
          Create account
        </Button>

        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/signin" className="font-semibold text-primary-600 hover:underline">
            Sign in
          </Link>
          {' · '}
          <Link to="/signup/exporter" className="font-semibold text-primary-600 hover:underline">
            Sign up as Exporter
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
