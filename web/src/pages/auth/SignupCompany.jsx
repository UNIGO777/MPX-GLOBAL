import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { firstRunHome } from '../../auth/roleHome.js';
import { ERROR_CODES, apiError, fieldErrorMap, isErrorCode } from '../../lib/format.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { CheckIcon, ChevronDownIcon } from '../../components/ui/icons.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { statesFor } from '../../lib/states.js';
import { ClaimOffer } from './ClaimOffer.jsx';

/**
 * A21 · step 2 — the company. The LAST step, and the first that creates
 * anything: `/auth/signup/complete` is where the User and the Organisation are
 * finally written, and the server refuses it unless both channels were verified.
 *
 * A21 puts these fields here rather than on the first form deliberately — step 1
 * is identity only, shared by both sides. `entityType` and address are exporter
 * extras (entityType drives the KYC document path).
 *
 * ✅ Organisation CLAIM (D7, rule set of 2026-09-23 — build-prompt §A21). On
 * mount this asks `/auth/signup/organisation` which companies already hold the
 * identity the two OTPs just proved; `ClaimOffer` renders them (a picker when
 * the email and phone reach different companies, and rule 6's company-email
 * code when needed). The user JOINS one, or creates a separate company.
 *
 * 🔴 Joining sends the opaque `choice` the server issued — never an org id. The
 * server resolves it against the stored offer AND re-checks eligibility, and
 * answers `CLAIM_SEAT_TAKEN` when the company can no longer be joined; the
 * signup is kept, so this screen simply falls back to the create form.
 *
 * 🔴 Joining is NOT always free of consequence, and the screen says so before
 * the user commits. An exporter joining a buyer-made company has to supply
 * `entityType` + address — KYC-locked details nobody has reviewed — so a
 * verified company goes back for review and its tick is withheld until an
 * employee approves the exporter side (`needs` / `carriesTickOver` from the
 * server carry that).
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
  // D7 · the claim offers. `undefined` = not asked yet, `[]` = nothing to claim.
  const [offers, setOffers] = useState(undefined);
  const [picked, setPicked] = useState(null);
  const [claimNotice, setClaimNotice] = useState(null);
  // "Neither — set up a separate company". Kept separate from `offers` so the
  // person can change their mind and go back to the list.
  const [declined, setDeclined] = useState(false);
  const [joining, setJoining] = useState(false);
  // The offer AS IT WAS when they joined — the success screen needs the company
  // name and whether the tick paused, and `offers` itself is cleared on decline.
  const [joined, setJoined] = useState(null);
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

  // Ask ONCE, on mount. A failure here is not fatal: the offer is an
  // enhancement, so `[]` falls through to the ordinary create form rather
  // than blocking a signup that is otherwise ready to complete.
  //
  // 🔴 A ref, not state, and in an effect, not in render: the old render-phase
  // guard fired TWICE under React's dev double-render, the two requests raced,
  // one 500'd and its `.catch` wiped the offer — a person entitled to join saw
  // only "create a company" (found in the browser walkthrough, 2026-09-23). The
  // server now tolerates concurrent reads too; this just stops sending two.
  const offerAsked = useRef(false);
  useEffect(() => {
    if (!flow.signupToken || offerAsked.current) return;
    offerAsked.current = true;
    authApi
      .signupClaimOffer({ signupToken: flow.signupToken })
      .then((list) => {
        setOffers(list);
        // One company needs no picking; several must be chosen explicitly.
        if (list.length === 1) setPicked(list[0].choice);
      })
      .catch(() => setOffers([]));
  }, [flow.signupToken]);

  // The seat went (or the company was blocked) between offer and join. Same
  // outcome as "no offer": the signup is intact, so they finish by creating.
  const seatTaken = (message) => {
    setOffers([]);
    setPicked(null);
    setClaimNotice(message);
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

  const submit = async (e, { claim = null } = {}) => {
    e.preventDefault();
    setError(null);

    const fe = {};
    // On a CLAIM the company name and country come from the existing
    // organisation, not this form — the server ignores whatever is sent, so
    // validating them here would block a join for no reason.
    if (!claim && !form.company.trim()) fe.company = 'Enter your company name.';
    if (!claim && !form.country) fe.country = 'Choose your country.';
    // Required for an exporter — the server enforces it too, and refuses the
    // whole call without it.
    // Required for an exporter creating a company, and for one joining a company
    // that has no entity type yet — never asked for when the company has one.
    const entityNeeded = claim ? Boolean(claim.needs?.includes('entityType')) : isExporter;
    if (entityNeeded && !form.entityType) fe.entityType = 'Choose your entity type.';
    // Joining a buyer-made company as a seller: the server needs the address
    // (a KYC-locked field) and refuses the whole call without it.
    const a = form.address;
    if (claim?.needs?.includes('address') && !(a.line1.trim() && a.city.trim() && a.postalCode.trim())) {
      fe.address = 'Add your business address (line 1, city and postal code) to join this company.';
      setAddressOpen(true);
    }
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      // The Join button set `joining` before calling in; a client-side stop
      // must release it, or the button stays disabled for good (found in the
      // browser walkthrough, 2026-09-23 — a missing address froze the join).
      setJoining(false);
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
        // Sent on a claim too: the server ignores them there (the existing
        // company's own name wins), but the field is required by the schema.
        company: claim ? claim.name ?? '-' : form.company.trim(),
        country: claim ? claim.country ?? 'IN' : form.country,
        ...(isExporter && form.entityType ? { entityType: form.entityType } : {}),
        ...(isExporter && Object.keys(address).length > 0 ? { address } : {}),
        ...(claim ? { claimChoice: claim.choice } : {}),
      });
      // `complete` returns a real session — both factors were just proved, so
      // there is no further code to enter.
      const user = await completeSignIn(result);
      if (claim) setJoined(claim);
      setCreated(user);
    } catch (err) {
      const { message, fields } = apiError(err, 'Could not create your account.');
      if (claim && isErrorCode(err, ERROR_CODES.CLAIM_SEAT_TAKEN)) {
        seatTaken(message);
        setLoading(false);
        setJoining(false);
        return;
      }
      // Branch on the CODE; the prose match is only a shim for older servers.
      if (isErrorCode(err, ERROR_CODES.SIGNUP_SESSION_EXPIRED, /start again/i)) setSessionDead(true);
      setFieldErrors(fieldErrorMap(fields));
      setError(message);
      setLoading(false);
      setJoining(false);
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
          <h2 className="text-[28px] font-bold text-ink-900">
            {joined ? 'You\u2019ve joined ' + joined.name + '.' : 'You\u2019re in.'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
            Your {isExporter ? 'exporter' : 'buyer'} account is ready to use.{' '}
            {isExporter ? 'Add your products and apply for the verified tick.' : 'Start browsing suppliers now.'}
          </p>

          {/* ── Post-claim hints ──────────────────────────────────────────────
              Only after a claim, and only on this screen: the person is
              authenticated and has just explicitly joined a company they proved
              they own, so naming their other account here leaks nothing. The
              portal login pages still must not hint at it — that is what the
              generic "Invalid credentials" protects. */}
          {joined && (
            <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
              {/* 🔴 The thing people will otherwise get wrong. Claim shares the
                  COMPANY, not the credentials: each side is its own account with
                  its own password (CLAUDE.md — credentials stay independent). */}
              {/* Only the SAME person holds the other account when their own email
                  reached the company. A phone-only match joined via a colleague's
                  code — that other account is the colleague's, not theirs. */}
              <p className="rounded-xl bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
                <span className="font-semibold text-ink-900">Two sign-ins, one company. </span>
                Use the password you just set for your{' '}
                {isExporter ? 'seller' : 'buyer'} sign-in.{' '}
                {joined.matchedOn === 'mobile'
                  ? `The company's ${isExporter ? 'buyer' : 'seller'} account stays with your colleague, with its own sign-in.`
                  : `Your ${isExporter ? 'buyer' : 'seller'} account keeps its own password — changing one does not change the other.`}
              </p>

              {joined.needs?.length > 0 && joined.verified ? (
                <p className="rounded-xl bg-warning-50 px-4 py-3 text-[13px] leading-relaxed text-warning-800">
                  <span className="font-semibold">Verification is being re-checked. </span>
                  You added registered details our team hasn&apos;t seen yet, so the verified tick is
                  paused until they approve them. Your profile stays live the whole time.
                </p>
              ) : joined.carriesTickOver ? (
                <p className="rounded-xl bg-success-50 px-4 py-3 text-[13px] leading-relaxed text-success-700">
                  <span className="font-semibold">Verified already. </span>
                  {joined.name} keeps its tick \u2014 there is no second check to go through.
                </p>
              ) : null}
            </div>
          )}
          <Button
            className="mt-8"
            onClick={() => navigate(firstRunHome(created), { replace: true })}
          >
            Go to your dashboard →
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // ── Which view ────────────────────────────────────────────────────────────
  //  checking → the offer is still loading; showing the create form first and
  //             then swapping it out looked broken.
  //  join     → a company matched: ONLY the picker, the code step and whatever
  //             seller details that company is missing. No create fields.
  //  create   → nothing matched, or "Neither — set up a separate company".
  const view = offers === undefined ? 'checking' : offers.length > 0 && !declined ? 'join' : 'create';
  const current = offers?.find((o) => o.choice === picked) ?? null;
  // Seller details are asked for only once the company is named and they
  // are actually missing (`needs` is withheld until rule 6's code is in).
  const joinNeeds = isExporter && current && !current.needsOrgEmailOtp ? (current.needs ?? []) : [];

  const join = (e) => {
    if (!current || current.needsOrgEmailOtp) return;
    setJoining(true);
    submit(e, { claim: current });
  };

  const entityTypeField = (
    <fieldset className="space-y-2 pt-1">
      <legend className="text-sm font-medium text-ink-800">Entity type</legend>
      <p className="pb-1 text-xs text-muted">
        This decides which documents we ask for when you apply for verification.
      </p>
      {/* role="radio" promises radiogroup behaviour: one tab stop and arrows to
          move between options. */}
      <div role="radiogroup" aria-label="Entity type" onKeyDown={onEntityKeyDown} className="grid gap-3 sm:grid-cols-2">
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
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                form.entityType === value ? 'border-primary-600' : 'border-ink-300'
              }`}
            >
              {form.entityType === value && <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${form.entityType === value ? 'text-primary-700' : 'text-ink-900'}`}>
                {label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{sub}</span>
            </span>
          </button>
        ))}
      </div>
      {/* `danger` is 50 + DEFAULT only — text-danger-600 compiles to nothing. */}
      {fieldErrors.entityType && (
        <p className="text-sm text-danger" role="alert">
          {fieldErrors.entityType}
        </p>
      )}
    </fieldset>
  );

  // Line 1, city and postal code are REQUIRED when joining as a seller (the
  // server refuses the join without them) and optional when creating.
  const addressFields = (required) => (
    <div className="space-y-4">
      <Input label="Address line 1" optional={!required} autoComplete="address-line1" placeholder="Street, building name" value={form.address.line1} onChange={setAddress('line1')} disabled={loading} />
      <Input label="Address line 2" optional autoComplete="address-line2" placeholder="Apartment, suite, unit" value={form.address.line2} onChange={setAddress('line2')} disabled={loading} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="City" optional={!required} autoComplete="address-level2" placeholder="Enter city" value={form.address.city} onChange={setAddress('city')} disabled={loading} />
        <Input label="Postal code" optional={!required} autoComplete="postal-code" placeholder="PIN code" value={form.address.postalCode} onChange={setAddress('postalCode')} disabled={loading} />
      </div>
      {/* A real list where we have one; free text everywhere else. */}
      {stateOptions ? (
        <Select
          label="State"
          optional
          value={form.address.state}
          onChange={setAddress('state')}
          disabled={loading}
          options={[{ value: '', label: 'Choose a state' }, ...stateOptions.map((st) => ({ value: st, label: st }))]}
        />
      ) : (
        <Input label="State" optional autoComplete="address-level1" placeholder="Enter state" value={form.address.state} onChange={setAddress('state')} disabled={loading} />
      )}
      {fieldErrors.address && (
        <p className="text-sm text-danger" role="alert">
          {fieldErrors.address}
        </p>
      )}
    </div>
  );

  const restart = (
    <Button fullWidth onClick={() => navigate(flow.signupPath ?? '/signup/buyer', { replace: true })}>
      Start signup again
    </Button>
  );

  return (
    <AuthLayout
      wide={isExporter}
      headline={isExporter ? 'Last step — tell us about your company.' : 'Last step — your company.'}
      sub="This is what buyers see, and what our team checks when you apply for the verified tick."
    >
      <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-600">
        Step {totalSteps} of {totalSteps}
      </p>
      <h2 className="mt-1 text-[28px] font-bold text-ink-900">
        {view === 'join' ? 'Join your company' : 'Your company'}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {view === 'join'
          ? 'Email and phone verified. Your company is already on MPX Global.'
          : 'Email and phone verified. This is the last thing we need.'}
      </p>

      {error && (
        <Alert tone="danger" className="mt-5">
          {error}
        </Alert>
      )}

      {/* ── checking ───────────────────────────────────────────────────────── */}
      {view === 'checking' && (
        <div className="mt-5 space-y-3" role="status" aria-label="Checking for your company">
          <p className="text-sm text-muted">Checking whether your company is already on MPX Global…</p>
          <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
          <div className="h-12 animate-pulse rounded-xl bg-ink-100" />
        </div>
      )}

      {/* ── join ─────────────────────────────────────────────────────────────
           D7 · a company already holds this verified identity. A company's name
           appears only once rule 6 is satisfied (see ClaimOffer). */}
      {view === 'join' &&
        (sessionDead ? (
          <div className="mt-5">{restart}</div>
        ) : (
          <>
            <ClaimOffer
              signupToken={flow.signupToken}
              offers={offers}
              picked={picked}
              onPick={setPicked}
              onOffersChange={setOffers}
              onSeatTaken={seatTaken}
              onSessionExpired={(message) => {
                setError(message);
                setSessionDead(true);
              }}
            />

            {joinNeeds.length > 0 && (
              <section className="mt-5 space-y-4 rounded-2xl border border-surface-border p-5">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink-900">Your seller details</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    {current.name} has no seller profile yet, so we need these to set one up.
                  </p>
                </div>
                {joinNeeds.includes('entityType') && entityTypeField}
                {joinNeeds.includes('address') && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-ink-800">Registered business address</p>
                    {addressFields(true)}
                  </div>
                )}
              </section>
            )}

            <div className="mt-6 space-y-3 border-t border-surface-border pt-6">
              <Button
                fullWidth
                loading={joining}
                disabled={loading || !current || current.needsOrgEmailOtp}
                onClick={join}
              >
                {current?.name ? `Join ${current.name}` : 'Join this company'}
              </Button>
              <p className="text-center text-xs text-muted">
                {!current
                  ? 'Pick your company above to continue.'
                  : current.needsOrgEmailOtp
                    ? 'Enter the code from the company email to continue.'
                    : 'You get your own sign-in — the company profile is shared.'}
              </p>
              <p className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setDeclined(true);
                    setFieldErrors({});
                  }}
                  className="text-sm font-semibold text-primary-700 hover:underline"
                >
                  {offers.length > 1 ? 'Neither — set up a separate company' : 'Not my company — set up a separate one'}
                </button>
              </p>
            </div>
          </>
        ))}

      {/* ── create ───────────────────────────────────────────────────────── */}
      {view === 'create' && (
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          {claimNotice && <Alert tone="warning">{claimNotice}</Alert>}
          {declined && offers?.length > 0 && (
            <button
              type="button"
              onClick={() => setDeclined(false)}
              className="text-sm font-semibold text-primary-700 hover:underline"
            >
              ← Join an existing company instead
            </button>
          )}

          {sessionDead ? (
            restart
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
                onChange={(code) => {
                  set('country')(code);
                  // A state from the previous country is meaningless here.
                  setForm((f) => ({ ...f, address: { ...f.address, state: '' } }));
                }}
                error={fieldErrors.country}
                disabled={loading}
              />

              {isExporter && entityTypeField}

              {/* Collapsed by default, so the step reads as "company, country,
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
                      <span className="block text-[15px] font-semibold text-ink-900">Business address</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        Optional — you can add or change this later from your company profile.
                      </span>
                    </span>
                    <ChevronDownIcon
                      className={`h-5 w-5 shrink-0 text-ink-500 transition-transform ${addressOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {addressOpen && <div className="border-t border-surface-border p-4">{addressFields(false)}</div>}
                </div>
              )}

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
      )}
    </AuthLayout>
  );
}
