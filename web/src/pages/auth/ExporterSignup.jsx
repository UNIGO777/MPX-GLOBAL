import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { apiError } from '../../lib/format.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { MobileInput } from '../../components/ui/MobileInput.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { CheckIcon } from '../../components/ui/icons.jsx';
import { Logo } from '../../components/ui/Logo.jsx';
import { fieldErrorMap } from './BuyerSignup.jsx';

/**
 * Exporter signup — the 3-step form wizard from the step_1..3 design images
 * (the shared OTP screen is the fourth step the rail counts): white
 * top app bar ("Already have an account? · Sign in" pill), canvas background,
 * a NAVY step-rail card on the left (numbered circles → green ticks, OPTIONAL
 * chip on Address, reassurance list at the bottom) and the white form card on
 * the right with a recessed footer strip holding Back / Continue.
 *
 * 🔴 Deliberate divergence from the step-2 image (owner decision 2026-07-30):
 * Registration number / Tax ID / Year established are NOT built — the backend
 * strips `businessProfile` at signup; they're captured at verification. With
 * those gone, step 2 has only required fields, so the image's "Skip and create
 * account" has nothing to skip and is not rendered. Step 3 keeps "Skip for
 * now" (address is genuinely optional).
 */
const STEPS = [
  { title: 'Your account', sub: "How you'll sign in, and how buyers reach you." },
  { title: 'Your business', sub: 'The details buyers see, plus what we check when you get verified.' },
  { title: 'Your address', sub: 'Optional — you can add this anytime from your profile.' },
];

// Four steps, not three: the OTP screen is the fourth and the form must count
// it, or the user hits "Step 3 of 3" and is then asked for one more thing.
// It stays "upcoming" throughout — the form owns steps 0–2 only.
const RAIL = [
  { label: 'Your account' },
  { label: 'Your business' },
  { label: 'Address', optional: true },
  { label: 'Verify your email' },
];

const REASSURANCE = [
  'Your profile goes live straight away',
  'No approval wait, no listing fees',
  'Get verified later to list without limits',
];

export function ExporterSignup() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: { countryCode: '+91', number: '' },
    password: '',
    confirm: '',
    company: '',
    country: 'IN',
    entityType: null,
    address: { line1: '', line2: '', city: '', state: '', postalCode: '' },
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
  const setAddr = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  };

  const validateStep = () => {
    const fe = {};
    if (step === 0) {
      if (!form.name.trim()) fe.name = 'Enter your full name.';
      if (!form.email.trim()) fe.email = 'Enter your work email.';
      if (!form.mobile.number.trim()) fe.mobile = 'Enter your mobile number.';
      if (form.password.length < 8) fe.password = 'At least 8 characters.';
      if (form.confirm !== form.password) fe.confirm = "Passwords don't match.";
    }
    if (step === 1) {
      if (!form.company.trim()) fe.company = 'Enter your business name.';
      if (!form.country) fe.country = 'Choose your country.';
      if (!form.entityType) fe.entityType = 'Choose your entity type.';
    }
    return fe;
  };

  const next = () => {
    const fe = validateStep();
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  };

  const submit = async (includeAddress) => {
    setError(null);
    setDuplicate(false);
    setLoading(true);
    const address = Object.fromEntries(
      Object.entries(form.address)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v !== ''),
    );
    try {
      const { loginToken, method } = await authApi.exporterSignup({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: { countryCode: form.mobile.countryCode, number: form.mobile.number.replace(/[\s-]/g, '') },
        password: form.password,
        company: form.company.trim(),
        country: form.country,
        entityType: form.entityType,
        ...(includeAddress && Object.keys(address).length > 0 ? { address } : {}),
      });
      navigate('/otp', {
        state: {
          loginToken,
          method,
          identifier: form.email.trim(),
          backTo: '/signup/exporter',
          // The form counts 1–3 of 4; OTP is the fourth (see RAIL).
          step: '4 of 4',
          backLabel: 'Back to signup',
          notice: "You're in. One last step — verify the code we just sent you.",
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
      const stepOf = (k) =>
        ['name', 'email', 'mobile', 'password'].some((p) => k.startsWith(p))
          ? 0
          : ['company', 'country', 'entityType'].some((p) => k.startsWith(p))
            ? 1
            : 2;
      const keys = Object.keys(mapped);
      if (status === 409) setStep(0);
      else if (keys.length > 0) setStep(Math.min(...keys.map(stepOf)));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Top app bar */}
      <header className="flex h-[72px] items-center justify-between bg-white px-4 shadow-sm sm:px-8">
        <Link to="/" aria-label="MPX Global — home">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-ink-600 sm:block">Already have an account?</span>
          <Link
            to="/signin"
            className="flex h-10 items-center rounded-full border border-surface-border px-5 text-sm font-semibold text-ink-900 hover:bg-surface-subtle"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] items-start gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[340px_1fr] lg:py-14">
        {/* Navy step rail */}
        <aside className="hidden rounded-xl bg-primary-800 p-8 text-white shadow-card lg:block">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-200">
            Step {step + 1} of 4
          </p>
          <h1 className="mt-2 text-[26px] font-bold leading-tight">Create your exporter account</h1>

          <ol className="mt-8 space-y-0">
            {RAIL.map((r, i) => (
              <li key={r.label} className="relative flex items-center gap-4 pb-8 last:pb-0">
                {i < RAIL.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${i < step ? 'bg-success' : 'bg-white/20'}`}
                  />
                )}
                <span
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    i < step
                      ? 'bg-success text-white'
                      : i === step
                        ? 'bg-primary-600 text-white ring-4 ring-white/10'
                        : 'bg-white/10 text-white/60'
                  }`}
                >
                  {i < step ? <CheckIcon className="h-4 w-4" /> : i + 1}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-[15px] font-semibold ${i === step ? 'text-white' : i < step ? 'text-white/90' : 'text-white/50'}`}>
                    {r.label}
                  </span>
                  {r.optional && (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
                      Optional
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-8 space-y-4 border-t border-white/15 pt-8">
            {REASSURANCE.map((line) => (
              <p key={line} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <CheckIcon className="h-3 w-3" />
                </span>
                {line}
              </p>
            ))}
          </div>
        </aside>

        {/* Form card */}
        <section className="overflow-hidden rounded-xl bg-white shadow-card">
          <div className="border-b border-surface-border px-6 py-6 sm:px-10 sm:py-8">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
              Step {step + 1} of 4
              {step === 2 && (
                <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-600">
                  Optional
                </span>
              )}
            </p>
            <h2 className="mt-1 text-[28px] font-bold text-ink-900">{STEPS[step].title}</h2>
            <p className="mt-1 text-base text-muted">{STEPS[step].sub}</p>
          </div>

          <div className="px-6 py-6 sm:px-10 sm:py-8">
            {error && (
              <div className="mb-6">
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
              </div>
            )}

            {step === 0 && (
              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
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
                </div>
                <MobileInput
                  value={form.mobile}
                  onChange={set('mobile')}
                  error={fieldErrors.mobile}
                  disabled={loading}
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <PasswordInput
                    label="Password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={set('password')}
                    error={fieldErrors.password}
                    helper="At least 8 characters"
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
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Input
                    label="Business name"
                    autoComplete="organization"
                    placeholder="Legal registered business name"
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
                </div>

                <div>
                  <span className="text-sm font-medium text-ink-800">Entity type</span>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Entity type">
                    {[
                      { value: 'business', title: 'Business', desc: 'Registered company, firm or LLP' },
                      { value: 'individual', title: 'Individual', desc: 'Sole proprietor or individual seller' },
                    ].map(({ value, title, desc }) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={form.entityType === value}
                        onClick={() => set('entityType')(value)}
                        disabled={loading}
                        className={`flex items-start gap-3 rounded-xl border p-5 text-left transition-all ${
                          form.entityType === value
                            ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                            : 'border-surface-border bg-white hover:border-ink-400'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            form.entityType === value ? 'border-primary-600' : 'border-ink-300'
                          }`}
                        >
                          {form.entityType === value && <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />}
                        </span>
                        <span>
                          <span
                            className={`block text-[15px] font-bold ${form.entityType === value ? 'text-primary-700' : 'text-ink-900'}`}
                          >
                            {title}
                          </span>
                          <span className="mt-0.5 block text-sm text-ink-600">{desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {fieldErrors.entityType && (
                    <p className="mt-2 text-sm text-danger" role="alert">{fieldErrors.entityType}</p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    This decides which documents we ask for at verification. It can&apos;t be changed
                    after your first document upload.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Input
                  label="Address line 1"
                  autoComplete="address-line1"
                  placeholder="Street, building name"
                  value={form.address.line1}
                  onChange={setAddr('line1')}
                  disabled={loading}
                />
                <Input
                  label="Address line 2"
                  autoComplete="address-line2"
                  placeholder="Apartment, suite, unit"
                  value={form.address.line2}
                  onChange={setAddr('line2')}
                  disabled={loading}
                />
                <div className="grid gap-6 sm:grid-cols-3">
                  <Input
                    label="City"
                    autoComplete="address-level2"
                    placeholder="Enter city"
                    value={form.address.city}
                    onChange={setAddr('city')}
                    disabled={loading}
                  />
                  <Input
                    label="State / province"
                    autoComplete="address-level1"
                    placeholder="Enter state"
                    value={form.address.state}
                    onChange={setAddr('state')}
                    disabled={loading}
                  />
                  <Input
                    label="Postal code"
                    autoComplete="postal-code"
                    placeholder="PIN code"
                    value={form.address.postalCode}
                    onChange={setAddr('postalCode')}
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Recessed footer strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-ink-50 px-6 py-5 sm:px-10">
            <div>
              {step > 0 && (
                <Button variant="secondary" className="border-surface-border bg-white text-ink-900" disabled={loading} onClick={() => setStep(step - 1)}>
                  ← Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-6">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={loading}
                  className="text-sm font-semibold text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-400"
                >
                  Skip for now
                </button>
              )}
              {step < 2 ? (
                <Button onClick={next}>
                  {step === 0 ? 'Next: your business →' : 'Continue to address →'}
                </Button>
              ) : (
                <Button loading={loading} onClick={() => submit(true)}>
                  Create account →
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
