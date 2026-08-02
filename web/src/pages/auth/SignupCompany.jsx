import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { apiError } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { fieldErrorMap } from './BuyerSignup.jsx';

/**
 * A21 · step 2 — the company. The LAST step, and the first that creates
 * anything: `/auth/signup/complete` is where the User and the Organisation are
 * finally written, and the server refuses it unless both channels were verified.
 *
 * A21 puts these fields here rather than on the first form deliberately — step 1
 * is identity only, shared by both sides. `entityType` and address are exporter
 * extras (entityType drives the KYC document path).
 *
 * 🚧 Organisation CLAIM ("this company already exists — claim it?") is NOT built.
 * This screen always creates a new Organisation, exactly as signup did before.
 * Claim is the remaining half of A21 — logged in docs/UiWebNotes.md.
 */
const ENTITY_TYPES = [
  { value: 'business', label: 'Registered business', sub: 'Company, LLP, partnership or firm' },
  { value: 'individual', label: 'Individual', sub: 'Sole proprietor or individual exporter' },
];

export function SignupCompany() {
  const navigate = useNavigate();
  const location = useLocation();
  const { completeSignIn } = useAuth();

  const flow = location.state ?? {};
  const isExporter = flow.role === 'exporter';

  const [form, setForm] = useState({
    company: '',
    country: '',
    entityType: null,
    address: { line1: '', line2: '', city: '', state: '', postalCode: '' },
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionDead, setSessionDead] = useState(false);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };
  const setAddress = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  };

  if (!flow.signupToken) return <Navigate to="/signin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const fe = {};
    if (!form.company.trim()) fe.company = 'Enter your company name.';
    if (!form.country) fe.country = 'Choose your country.';
    // Required for an exporter — the server enforces it too, and refuses the
    // whole call without it.
    if (isExporter && !form.entityType) fe.entityType = 'Choose your entity type.';
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    setLoading(true);
    try {
      // Drop blank optional address lines rather than storing empty strings.
      const address = Object.fromEntries(
        Object.entries(form.address).filter(([, v]) => String(v).trim() !== ''),
      );
      const result = await authApi.signupComplete({
        signupToken: flow.signupToken,
        company: form.company.trim(),
        country: form.country,
        ...(isExporter ? { entityType: form.entityType } : {}),
        ...(isExporter && Object.keys(address).length > 0 ? { address } : {}),
      });
      // `complete` returns a real session — both factors were just proved, so
      // there is no further code to enter.
      const user = await completeSignIn(result);
      navigate(roleHome(user), { replace: true });
    } catch (err) {
      const { message, fields } = apiError(err, 'Could not create your account.');
      if (/start again/i.test(message)) setSessionDead(true);
      setFieldErrors(fieldErrorMap(fields));
      setError(message);
      setLoading(false);
    }
  };

  const totalSteps = isExporter ? 5 : 4;

  return (
    <AuthLayout
      headline={isExporter ? 'Last step — tell us about your company.' : 'Last step — your company.'}
      sub="This is what buyers see, and what our team checks when you apply for the verified tick."
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Step {totalSteps} of {totalSteps}
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">Your company</h2>
      <p className="mt-1 text-sm text-muted">
        Email and phone verified. This is the last thing we need.
      </p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}

        {sessionDead ? (
          <Button fullWidth onClick={() => navigate(flow.signupPath ?? '/signup/buyer', { replace: true })}>
            Start signup again
          </Button>
        ) : (
          <>
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

            {isExporter && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink-800">Entity type</legend>
                <p className="text-xs text-muted">
                  This decides which documents we ask for when you apply for verification.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ENTITY_TYPES.map(({ value, label, sub }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={form.entityType === value}
                      onClick={() => set('entityType')(value)}
                      disabled={loading}
                      className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                        form.entityType === value
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-ink-200 hover:border-ink-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-ink-900">{label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{sub}</span>
                    </button>
                  ))}
                </div>
                {fieldErrors.entityType && (
                  <p className="text-sm text-danger-600">{fieldErrors.entityType}</p>
                )}
              </fieldset>
            )}

            {isExporter && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink-800">
                  Address <span className="font-normal text-muted">(optional)</span>
                </legend>
                <Input label="Address line 1" value={form.address.line1} onChange={setAddress('line1')} disabled={loading} />
                <Input label="Address line 2" value={form.address.line2} onChange={setAddress('line2')} disabled={loading} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="City" value={form.address.city} onChange={setAddress('city')} disabled={loading} />
                  <Input label="State" value={form.address.state} onChange={setAddress('state')} disabled={loading} />
                </div>
                <Input label="Postal code" value={form.address.postalCode} onChange={setAddress('postalCode')} disabled={loading} />
              </fieldset>
            )}

            <Button type="submit" fullWidth loading={loading} className="!mt-8">
              Create my account
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
