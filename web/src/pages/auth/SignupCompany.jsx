import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { roleHome } from '../../auth/roleHome.js';
import { ERROR_CODES, apiError, fieldErrorMap, isErrorCode } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { CheckIcon, ChevronDownIcon } from '../../components/ui/icons.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { statesFor } from '../../lib/states.js';

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
// Wording per the exporter registration step-2 design image.
const ENTITY_TYPES = [
  { value: 'business', label: 'Business', sub: 'Registered company, firm or LLP' },
  { value: 'individual', label: 'Individual', sub: 'Sole proprietor or individual seller' },
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
  // Design's closing state — shown instead of dropping the user straight in.
  const [created, setCreated] = useState(null);
  const [addressOpen, setAddressOpen] = useState(false);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };
  const setAddress = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  };

  const entityRefs = useRef({});
  const onEntityKeyDown = (e) => {
    const delta = ['ArrowRight', 'ArrowDown'].includes(e.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(e.key)
        ? -1
        : 0;
    if (!delta) return;
    e.preventDefault();
    const i = ENTITY_TYPES.findIndex((t) => t.value === form.entityType);
    const next = ENTITY_TYPES[(Math.max(i, 0) + delta + ENTITY_TYPES.length) % ENTITY_TYPES.length];
    set('entityType')(next.value);
    entityRefs.current[next.value]?.focus();
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
      setCreated(user);
    } catch (err) {
      const { message, fields } = apiError(err, 'Could not create your account.');
      // Branch on the CODE; the prose match is only a shim for older servers.
      if (isErrorCode(err, ERROR_CODES.SIGNUP_SESSION_EXPIRED, /start again/i)) setSessionDead(true);
      setFieldErrors(fieldErrorMap(fields));
      setError(message);
      setLoading(false);
    }
  };

  const totalSteps = isExporter ? 5 : 4;
  const stateOptions = statesFor(form.country);

  if (created) {
    return (
      <AuthLayout
        headline={isExporter ? 'Last step — tell us about your company.' : 'Last step — your company.'}
        sub="This is what buyers see, and what our team checks when you apply for the verified tick."
      >
        <div className="text-center">
          <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success">
            <CheckIcon className="h-8 w-8" />
          </span>
          <h2 className="text-[28px] font-bold text-ink-900">You&apos;re in.</h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
            Your {isExporter ? 'exporter' : 'buyer'} account is ready to use.{' '}
            {isExporter ? 'Add your products and apply for the verified tick.' : 'Start browsing suppliers now.'}
          </p>
          <Button
            className="mt-8"
            onClick={() => navigate(roleHome(created), { replace: true })}
          >
            Go to your dashboard →
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      wide={isExporter}
      headline={isExporter ? 'Last step — tell us about your company.' : 'Last step — your company.'}
      sub="This is what buyers see, and what our team checks when you apply for the verified tick."
    >
      <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-600">
        Step {totalSteps} of {totalSteps}
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">Your company</h2>
      <p className="mt-2 text-sm text-muted">
        Email and phone verified. This is the last thing we need.
      </p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
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
            {/* Required, so it sits with the company fields rather than inside
                the optional address. Reading order is still country → state →
                postal code. */}
            <CountrySelect
              value={form.country}
              onChange={(code) => {
                set('country')(code);
                // A state from the previous country is meaningless here.
                setForm((f) => ({ ...f, address: { ...f.address, state: '' } }));
              }}
              error={fieldErrors.country}
              disabled={loading}
            />

            {isExporter && (
              <fieldset className="space-y-2 pt-1">
                <legend className="text-sm font-medium text-ink-800">Entity type</legend>
                <p className="pb-1 text-xs text-muted">
                  This decides which documents we ask for when you apply for verification.
                </p>
                {/* role="radio" promises radiogroup behaviour: one tab stop and
                    arrows to move between options. Without the container role
                    and roving focus, the markup described behaviour the cards
                    did not have. */}
                <div
                  role="radiogroup"
                  aria-label="Entity type"
                  onKeyDown={onEntityKeyDown}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {ENTITY_TYPES.map(({ value, label, sub }) => (
                    <button
                      key={value}
                      ref={(el) => (entityRefs.current[value] = el)}
                      type="button"
                      role="radio"
                      aria-checked={form.entityType === value}
                      tabIndex={form.entityType === value || (!form.entityType && value === ENTITY_TYPES[0].value) ? 0 : -1}
                      onClick={() => set('entityType')(value)}
                      disabled={loading}
                      className={`flex h-full items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                        form.entityType === value
                          ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                          : 'border-surface-border bg-white hover:border-ink-400'
                      }`}
                    >
                      {/* Radio dot, as the step-2 design draws it */}
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          form.entityType === value ? 'border-primary-600' : 'border-ink-300'
                        }`}
                      >
                        {form.entityType === value && (
                          <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-sm font-bold ${
                            form.entityType === value ? 'text-primary-700' : 'text-ink-900'
                          }`}
                        >
                          {label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted">{sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {/* `danger` is 50 + DEFAULT only — text-danger-600 compiled to
                    nothing, so this error rendered in body colour, not red. */}
                {fieldErrors.entityType && (
                  <p className="text-sm text-danger" role="alert">
                    {fieldErrors.entityType}
                  </p>
                )}
              </fieldset>
            )}

            {/* Five optional fields used to out-bulk the three required ones.
                Collapsed by default, so the step reads as "company, country,
                entity type" — and the address is one click away. */}
            {isExporter && (
              <div className="overflow-hidden rounded-xl border border-surface-border">
                <button
                  type="button"
                  onClick={() => setAddressOpen((o) => !o)}
                  aria-expanded={addressOpen}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-ink-50"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink-900">
                      Business address
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      Optional — you can add or change this later from your company profile.
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-ink-500 transition-transform ${addressOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {addressOpen && (
                  <div className="space-y-4 border-t border-surface-border p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* A real list where we have one; free text everywhere
                          else — the server takes any string. */}
                      {stateOptions ? (
                        <Select
                          label="State"
                          optional
                          value={form.address.state}
                          onChange={setAddress('state')}
                          disabled={loading}
                          options={[
                            { value: '', label: 'Choose a state' },
                            ...stateOptions.map((s) => ({ value: s, label: s })),
                          ]}
                        />
                      ) : (
                        <Input
                          label="State"
                          optional
                          autoComplete="address-level1"
                          placeholder="Enter state"
                          value={form.address.state}
                          onChange={setAddress('state')}
                          disabled={loading}
                        />
                      )}
                      <Input label="Postal code" optional autoComplete="postal-code" placeholder="PIN code" value={form.address.postalCode} onChange={setAddress('postalCode')} disabled={loading} />
                    </div>
                    <Input label="City" optional autoComplete="address-level2" placeholder="Enter city" value={form.address.city} onChange={setAddress('city')} disabled={loading} />
                    <Input label="Address line 1" optional autoComplete="address-line1" placeholder="Street, building name" value={form.address.line1} onChange={setAddress('line1')} disabled={loading} />
                    <Input label="Address line 2" optional autoComplete="address-line2" placeholder="Apartment, suite, unit" value={form.address.line2} onChange={setAddress('line2')} disabled={loading} />
                  </div>
                )}
              </div>
            )}

            {/* Same CTA spacing as every other auth screen, and it survives a
                change to the form's space-y. */}
            <div className="space-y-3 border-t border-surface-border pt-6">
              <Button type="submit" fullWidth loading={loading}>
                Create my account
              </Button>
              <p className="text-center text-xs text-muted">
                Your profile goes live straight away — verification comes later.
              </p>
            </div>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
