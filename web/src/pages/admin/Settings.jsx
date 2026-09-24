import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsApi, settingsKeys } from '../../api/settings.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { cp } from '../../lib/consolePath.js';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { AlertIcon, BuildingIcon, CheckCircleIcon, ClockIcon, HelpIcon, ListIcon, MailIcon, PhoneIcon, SparkleIcon } from '../../components/ui/icons.jsx';

/**
 * D8 · Platform settings (§3.5) — superadmin only.
 *
 * 🔴 WHY THIS PAGE EXISTS, in one line: agreement §3.3 says the AI guest daily
 * ceiling "may be changed by the Client **at any time**", and until now it lived
 * in `AI_GUEST_DAILY_MAX` — a `.env` edit plus a restart, i.e. not something the
 * Client could do at all. This page is what makes that sentence true.
 *
 * 🔴 KEEP IT SMALL. The contents were decided on 2026-08-21 (`docs/Note.md` D8)
 * as two things; on 2026-09-25 the owner confirmed three more after a D8 red
 * alert — support hours, ticket auto-close days, company footer details.
 * Anything further is a new decision. Do not "round it out":
 *   · **NOT the D1 caps** (3 active / 10 drafts) — those are written into
 *     agreement **§3.2**, and an editable cap invites someone to set 5 and put
 *     the running platform silently out of step with the contract.
 *   · **NOT OTP knobs** — security controls, env-only.
 *   · **NEVER a secret** — no API key, no SMTP password.
 *   · **NOT banners/featured** — that is `/admin/featured` already.
 * The server schema is `.strict()`, so a field added here without a server
 * change is refused rather than silently dropped.
 *
 * 2026-09-25 redesign (owner: "fix setting screen"): a label column + control
 * card per setting; plain status for what is IN FORCE (with a warning when guest
 * AI is uncapped); a live "what people see" preview for the contact; checks in
 * the form before saving; and a save bar that says when something is unsaved and
 * can discard it. Every save still writes one AuditLog entry (§11.1), linked
 * from the header.
 */

// `null`/undefined → '' so the inputs stay controlled; '' on save means "clear".
const toInput = (v) => (v == null ? '' : String(v));

// Mirrors the server's rules (settings.validators.js), which stay the authority.
const MAX_LIMIT = 1_000_000;
function limitProblem(v) {
  if (v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return 'Enter a whole number, 1 or more.';
  if (n > MAX_LIMIT) return `At most ${MAX_LIMIT.toLocaleString()}.`;
  return null;
}
const emailProblem = (v) => (v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'That doesn’t look like an email address.' : null);
const phoneProblem = (v) => (v.trim().length > 40 ? 'Keep it under 40 characters.' : null);
const maxLen = (n) => (v) => (v.trim().length > n ? `Keep it under ${n} characters.` : null);
function daysProblem(v) {
  if (v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 3 && n <= 90 ? null : 'Enter a whole number of days from 3 to 90.';
}
// LinkedIn only, https only — it becomes a link on every public page.
const linkedinProblem = (v) =>
  v.trim() && !/^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/[^\s]*$/i.test(v.trim())
    ? 'Use your LinkedIn page address, starting with https://www.linkedin.com/'
    : null;

export function Settings() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: settingsKeys.platform, queryFn: settingsApi.get });

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [seededFrom, setSeededFrom] = useState(null);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Platform settings — MPX Global';
    return () => { document.title = previous; };
  }, []);

  // Server state seeds the form once it lands, and RE-seeds after a save so the
  // inputs show what was actually stored (the server lowercases the email, for
  // one). Adjusted during render — the React-recommended shape for "derive state
  // from a changed prop" — keyed on the query data's identity.
  const data = query.data;
  const seed = (d) => ({
    aiGuestDailyMax: toInput(d.aiGuestDailyMax),
    supportEmail: toInput(d.supportEmail),
    supportPhone: toInput(d.supportPhone),
    supportHours: toInput(d.supportHours),
    ticketAutoCloseDays: toInput(d.ticketAutoCloseDays),
    companyLegalName: toInput(d.companyLegalName),
    companyAddress: toInput(d.companyAddress),
    companyLinkedinUrl: toInput(d.companyLinkedinUrl),
  });
  if (data && seededFrom !== data) {
    setSeededFrom(data);
    setForm(seed(data));
  }

  const save = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (next) => {
      qc.setQueryData(settingsKeys.platform, next);
      setSaved(true);
    },
  });

  if (query.error) {
    return (
      <AdminLayout>
        <ErrorState title="We couldn't load the settings" message={apiError(query.error).message} onRetry={() => query.refetch()} />
      </AdminLayout>
    );
  }
  if (query.isLoading || !form) {
    return (
      <AdminLayout>
        <SkeletonRows rows={6} />
      </AdminLayout>
    );
  }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
    save.reset();
  };

  // Only what actually changed travels — the server rejects an empty body, and
  // a no-op save must not write an audit entry claiming something moved.
  const patch = {};
  if (form.aiGuestDailyMax !== toInput(data.aiGuestDailyMax)) {
    patch.aiGuestDailyMax = form.aiGuestDailyMax === '' ? null : Number(form.aiGuestDailyMax);
  }
  if (form.supportEmail !== toInput(data.supportEmail)) patch.supportEmail = form.supportEmail.trim();
  if (form.supportPhone !== toInput(data.supportPhone)) patch.supportPhone = form.supportPhone.trim();
  if (form.ticketAutoCloseDays !== toInput(data.ticketAutoCloseDays)) {
    patch.ticketAutoCloseDays = form.ticketAutoCloseDays === '' ? null : Number(form.ticketAutoCloseDays);
  }
  for (const key of ['supportHours', 'companyLegalName', 'companyAddress', 'companyLinkedinUrl']) {
    if (form[key] !== toInput(data[key])) patch[key] = form[key].trim();
  }
  const dirty = Object.keys(patch).length > 0;

  const problems = {
    aiGuestDailyMax: limitProblem(form.aiGuestDailyMax),
    supportEmail: emailProblem(form.supportEmail),
    supportPhone: phoneProblem(form.supportPhone),
    supportHours: maxLen(80)(form.supportHours),
    ticketAutoCloseDays: daysProblem(form.ticketAutoCloseDays),
    companyLegalName: maxLen(120)(form.companyLegalName),
    companyAddress: maxLen(300)(form.companyAddress),
    companyLinkedinUrl: linkedinProblem(form.companyLinkedinUrl),
  };
  const invalid = Object.values(problems).some(Boolean);
  const error = save.error ? apiError(save.error) : null;

  return (
    <AdminLayout>
      <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Platform settings</h1>
          <p className="mt-1 text-sm text-muted">Changes apply straight away — no restart.</p>
        </div>
        <Link
          to={cp('/admin/audit?action=settings.update')}
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary-700 hover:underline sm:self-auto"
        >
          <ListIcon className="h-4 w-4" aria-hidden="true" />
          {data.updatedAt ? `Last changed ${formatDate(data.updatedAt)}, ${formatTime(data.updatedAt)}` : 'Change history'}
        </Link>
      </header>

      {/* Save bar — sticky, so Save is never a scroll away, and it SAYS when
          something is unsaved instead of just enabling a grey button. */}
      <div className="sticky top-0 z-20 mb-5 pt-1">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 shadow-lift backdrop-blur transition-colors ${
            dirty ? 'border-warning-200 bg-warning-50/95' : 'border-surface-border bg-white/95'
          }`}
        >
          <p className="flex min-w-0 items-center gap-2 text-[13px]" aria-live="polite">
            {dirty ? (
              <>
                <AlertIcon className="h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
                <span className="font-semibold text-warning-900">
                  {invalid ? 'Fix the highlighted field to save' : 'You have unsaved changes'}
                </span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                <span className="text-ink-600">Everything is saved</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setForm(seed(data)); save.reset(); }}
                disabled={save.isPending}
              >
                Discard
              </Button>
            )}
            <Button size="sm" onClick={() => save.mutate(patch)} disabled={!dirty || invalid || save.isPending} loading={save.isPending}>
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="That didn’t save" className="mb-4">
          {error.message}
        </Alert>
      )}
      {saved && !dirty && (
        <FlashMessage className="mb-4" onDismiss={() => setSaved(false)}>
          Saved. It’s live now, and the change is in the audit log.
        </FlashMessage>
      )}

      <div className="space-y-5">
        <AiLimitSetting form={form} data={data} set={set} problem={problems.aiGuestDailyMax} onUseDefault={() => set('aiGuestDailyMax')({ target: { value: '' } })} />
        <SupportContactSetting form={form} data={data} set={set} problems={problems} />
        <TicketSetting form={form} data={data} set={set} problem={problems.ticketAutoCloseDays} onUseDefault={() => set('ticketAutoCloseDays')({ target: { value: '' } })} />
        <CompanySetting form={form} set={set} problems={problems} />
      </div>
    </AdminLayout>
  );
}

/** Label column on the left (lg+), the controls in a card on the right. */
function SettingRow({ Icon, title, children, aside }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-ink-900">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-ink-600">{aside}</div>
      </div>
      <div className="min-w-0 rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">{children}</div>
    </section>
  );
}

function AiLimitSetting({ form, data, set, problem, onUseDefault }) {
  const override = data.aiGuestDailyMax;
  const envDefault = data.envAiGuestDailyMax;
  const effective = override ?? envDefault;

  return (
    <SettingRow
      Icon={SparkleIcon}
      title="AI search for guests"
      aside={(
        <>
          <p>How many AI searches signed-out visitors can run in total each day, across the whole site.</p>
          <p>
            When the limit is reached, guests get normal keyword search instead — nothing breaks, the AI simply
            stops costing money until tomorrow. Signed-in companies have their own allowance and aren&apos;t
            affected.
          </p>
        </>
      )}
    >
      {/* What is enforced RIGHT NOW, stated so nobody has to work it out. */}
      {effective != null ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-700">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[12.5px] font-semibold text-success-800 ring-1 ring-inset ring-success-200">
            <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
            In force: {effective.toLocaleString()} a day
          </span>
          <span className="text-muted">{override != null ? 'your setting' : 'the server default'}</span>
        </p>
      ) : (
        <Alert tone="warning" className="mb-4">
          <b>No limit is in force.</b> Guests can run unlimited AI searches, so AI costs have no daily cap. Set a
          number below to cap it.
        </Alert>
      )}

      <div className="max-w-xs">
        <Field
          label="Daily limit"
          error={problem ?? undefined}
          helper={form.aiGuestDailyMax === ''
            ? envDefault != null
              ? `Empty uses the server default (${envDefault.toLocaleString()}).`
              : 'Empty means no limit.'
            : undefined}
        >
          {(id) => (
            <div className="relative">
              <input
                id={id}
                type="number"
                min="1"
                max={MAX_LIMIT}
                step="1"
                inputMode="numeric"
                value={form.aiGuestDailyMax}
                onChange={set('aiGuestDailyMax')}
                placeholder={envDefault != null ? String(envDefault) : 'No limit'}
                aria-invalid={problem ? true : undefined}
                className={inputClasses(Boolean(problem), 'pr-28')}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                searches / day
              </span>
            </div>
          )}
        </Field>
      </div>
      {override != null && form.aiGuestDailyMax !== '' && (
        <button type="button" onClick={onUseDefault} className="mt-3 text-[13px] font-semibold text-primary-700 hover:underline">
          Go back to the server default{envDefault != null ? ` (${envDefault.toLocaleString()})` : ''}
        </button>
      )}
    </SettingRow>
  );
}

function SupportContactSetting({ form, data, set, problems }) {
  const email = form.supportEmail.trim();
  const phone = form.supportPhone.trim();
  const hours = form.supportHours.trim();
  const nothingPublished = !data.supportEmail && !data.supportPhone;

  return (
    <SettingRow
      Icon={MailIcon}
      title="Support contact"
      aside={(
        <>
          <p>How buyers and exporters reach you. It appears on the Help page and at the foot of every email the platform sends.</p>
          <p>The Terms and Privacy pages also point people to it.</p>
        </>
      )}
    >
      {nothingPublished && (
        <Alert tone="warning" className="mb-4">
          <b>Nothing is published yet.</b> The Help page and emails have no contact to show until you add one.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" error={problems.supportEmail ?? undefined}>
          {(id) => (
            <input
              id={id}
              type="email"
              autoComplete="off"
              value={form.supportEmail}
              onChange={set('supportEmail')}
              placeholder="support@yourcompany.com"
              aria-invalid={problems.supportEmail ? true : undefined}
              className={inputClasses(Boolean(problems.supportEmail))}
            />
          )}
        </Field>
        <Field label="Phone" optional helper="With the country code, e.g. +91." error={problems.supportPhone ?? undefined}>
          {(id) => (
            <input
              id={id}
              type="tel"
              autoComplete="off"
              value={form.supportPhone}
              onChange={set('supportPhone')}
              placeholder="+91 98765 43210"
              aria-invalid={problems.supportPhone ? true : undefined}
              className={inputClasses(Boolean(problems.supportPhone))}
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Support hours" optional helper="When someone replies — include the time zone." error={problems.supportHours ?? undefined}>
            {(id) => (
              <input
                id={id}
                value={form.supportHours}
                maxLength={80}
                onChange={set('supportHours')}
                placeholder="Mon–Sat, 10:00–18:00 IST"
                aria-invalid={problems.supportHours ? true : undefined}
                className={inputClasses(Boolean(problems.supportHours))}
              />
            )}
          </Field>
        </div>
      </div>

      {/* Live preview of what the public sees — follows the typing. */}
      <div className="mt-5 rounded-xl border border-dashed border-surface-border bg-surface-subtle/60 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">What people will see</p>
        {email || phone ? (
          <ul className="mt-2 space-y-1.5 text-[14px] text-ink-900">
            {email && (
              <li className="flex items-center gap-2">
                <MailIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span className="min-w-0 break-all font-semibold text-primary-700">{email.toLowerCase()}</span>
              </li>
            )}
            {phone && (
              <li className="flex items-center gap-2">
                <PhoneIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span className="font-semibold">{phone}</span>
              </li>
            )}
            {hours && (
              <li className="flex items-center gap-2 text-[13px] text-ink-600">
                <ClockIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span>Support hours: {hours}</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-muted">No contact — the Help page will show only the ticket option.</p>
        )}
      </div>
    </SettingRow>
  );
}

function TicketSetting({ form, data, set, problem, onUseDefault }) {
  const def = data.defaultTicketAutoCloseDays;
  const effective = data.ticketAutoCloseDays ?? def;
  const typed = form.ticketAutoCloseDays === '' ? def : Number(form.ticketAutoCloseDays);
  const lowering = !problem && Number.isInteger(typed) && typed < effective;

  return (
    <SettingRow
      Icon={HelpIcon}
      title="Support tickets"
      aside={(
        <>
          <p>When your team has replied and the company doesn&apos;t answer, the ticket closes itself after this many days.</p>
          <p>The company is emailed when it closes and can raise a follow-up. Closed tickets keep the number that applied at the time.</p>
        </>
      )}
    >
      <p className="mb-4 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-700">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[12.5px] font-semibold text-success-800 ring-1 ring-inset ring-success-200">
          <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          In force: {effective} days
        </span>
        <span className="text-muted">{data.ticketAutoCloseDays != null ? 'your setting' : 'the default'}</span>
      </p>
      <div className="max-w-xs">
        <Field
          label="Close a waiting ticket after"
          error={problem ?? undefined}
          helper={form.ticketAutoCloseDays === '' ? `Empty uses the default (${def} days).` : 'From 3 to 90 days.'}
        >
          {(id) => (
            <div className="relative">
              <input
                id={id}
                type="number"
                min="3"
                max="90"
                step="1"
                inputMode="numeric"
                value={form.ticketAutoCloseDays}
                onChange={set('ticketAutoCloseDays')}
                placeholder={String(def)}
                aria-invalid={problem ? true : undefined}
                className={inputClasses(Boolean(problem), 'pr-14')}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">days</span>
            </div>
          )}
        </Field>
      </div>
      {lowering && (
        <Alert tone="warning" className="mt-4">
          Tickets already waiting {typed} days or more will close at the next nightly run (03:30), and each company gets
          the &ldquo;closed&rdquo; email.
        </Alert>
      )}
      {data.ticketAutoCloseDays != null && form.ticketAutoCloseDays !== '' && (
        <button type="button" onClick={onUseDefault} className="mt-3 text-[13px] font-semibold text-primary-700 hover:underline">
          Go back to the default ({def} days)
        </button>
      )}
    </SettingRow>
  );
}

function CompanySetting({ form, set, problems }) {
  const name = form.companyLegalName.trim();
  const address = form.companyAddress.trim();
  const linkedin = form.companyLinkedinUrl.trim();

  return (
    <SettingRow
      Icon={BuildingIcon}
      title="Company details"
      aside={(
        <>
          <p>Your registered company name and address, shown in the website footer and at the foot of every email.</p>
          <p>The LinkedIn link appears on the website only — platform emails never contain links.</p>
        </>
      )}
    >
      <div className="grid gap-4">
        <Field label="Registered company name" optional error={problems.companyLegalName ?? undefined}>
          {(id) => (
            <input
              id={id}
              value={form.companyLegalName}
              maxLength={120}
              onChange={set('companyLegalName')}
              placeholder="MPX Global Private Limited"
              aria-invalid={problems.companyLegalName ? true : undefined}
              className={inputClasses(Boolean(problems.companyLegalName))}
            />
          )}
        </Field>
        <Field
          label="Registered address"
          optional
          error={problems.companyAddress ?? undefined}
          trailing={<span className="text-xs text-muted">{300 - form.companyAddress.length} left</span>}
        >
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={form.companyAddress}
              maxLength={300}
              onChange={set('companyAddress')}
              placeholder={'Office 12, Trade Centre\nMumbai 400001, India'}
              aria-invalid={problems.companyAddress ? true : undefined}
              className={inputClasses(Boolean(problems.companyAddress), 'h-auto py-2.5')}
            />
          )}
        </Field>
        <Field label="LinkedIn page" optional error={problems.companyLinkedinUrl ?? undefined}>
          {(id) => (
            <input
              id={id}
              type="url"
              value={form.companyLinkedinUrl}
              maxLength={200}
              onChange={set('companyLinkedinUrl')}
              placeholder="https://www.linkedin.com/company/…"
              aria-invalid={problems.companyLinkedinUrl ? true : undefined}
              className={inputClasses(Boolean(problems.companyLinkedinUrl), 'font-mono text-[13px]')}
            />
          )}
        </Field>
      </div>

      {/* Live preview of the website footer block. */}
      <div className="mt-5 rounded-xl bg-ink-900 p-4 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Website footer</p>
        {name || address || linkedin ? (
          <div className="mt-2 text-xs leading-relaxed text-white/60">
            {name && <p className="font-semibold text-white/85">{name}</p>}
            {address && <p className="whitespace-pre-line">{address}</p>}
            {linkedin && !problems.companyLinkedinUrl && <p className="mt-2 font-semibold text-white/80">LinkedIn ↗</p>}
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/50">Nothing extra — the footer shows only the MPX Global line.</p>
        )}
      </div>
    </SettingRow>
  );
}
