import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsApi, settingsKeys } from '../../api/settings.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { apiError, formatListTime } from '../../lib/format.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { MailIcon, SparkleIcon } from '../../components/ui/icons.jsx';

/**
 * D8 · Platform settings (§3.5) — superadmin only.
 *
 * 🔴 WHY THIS PAGE EXISTS, in one line: agreement §3.3 says the AI guest daily
 * ceiling "may be changed by the Client **at any time**", and until now it lived
 * in `AI_GUEST_DAILY_MAX` — a `.env` edit plus a restart, i.e. not something the
 * Client could do at all. This page is what makes that sentence true.
 *
 * 🔴 KEEP IT SMALL. The contents were decided on 2026-08-21 (`docs/Note.md` D8)
 * and are deliberately two things. Do not "round it out":
 *   · **NOT the D1 caps** (3 active / 10 drafts) — those are written into
 *     agreement **§3.2**, and an editable cap invites someone to set 5 and put
 *     the running platform silently out of step with the contract.
 *   · **NOT OTP knobs** — security controls, env-only.
 *   · **NEVER a secret** — no API key, no SMTP password.
 *   · **NOT banners/featured** — that is `/admin/featured` already.
 * §3.11.1 fixes scope to Clause 3, where "Platform settings" is undefined, so
 * anything elaborate here is scope creep rather than delivery. The server
 * schema is `.strict()`, so a field added here without a server change is
 * refused rather than silently dropped.
 *
 * Every save writes an AuditLog entry (§11.1) — visible at `/admin/audit` under
 * `settings.update`, with the before/after of only the fields that moved.
 */

// `null`/undefined → '' so the inputs stay controlled; '' on save means "clear".
const toInput = (v) => (v == null ? '' : String(v));

export function Settings() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: settingsKeys.platform, queryFn: settingsApi.get });

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [seededFrom, setSeededFrom] = useState(null);

  // Server state seeds the form once it lands, and RE-seeds after a save so the
  // inputs reflect what was actually stored (the server lowercases the email,
  // for one) rather than what was typed.
  //
  // Adjusted during render rather than in an effect — the React-recommended
  // shape for "derive state from a changed prop", and it avoids the cascading
  // extra render an effect-plus-setState causes (react-hooks/set-state-in-effect).
  // Keyed on the query data's identity, so it re-seeds exactly when a new object
  // arrives and never on an unrelated re-render.
  const data = query.data;
  if (data && seededFrom !== data) {
    setSeededFrom(data);
    setForm({
      aiGuestDailyMax: toInput(data.aiGuestDailyMax),
      supportEmail: toInput(data.supportEmail),
      supportPhone: toInput(data.supportPhone),
    });
  }

  const save = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (next) => {
      qc.setQueryData(settingsKeys.platform, next);
      setSaved(true);
    },
  });

  if (query.isLoading || !form) {
    return (
      <AdminLayout>
        <SkeletonRows rows={5} />
      </AdminLayout>
    );
  }
  if (query.error) {
    return (
      <AdminLayout>
        <ErrorState message={apiError(query.error).message} onRetry={() => query.refetch()} />
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
  if (form.supportEmail !== toInput(data.supportEmail)) patch.supportEmail = form.supportEmail;
  if (form.supportPhone !== toInput(data.supportPhone)) patch.supportPhone = form.supportPhone;
  const dirty = Object.keys(patch).length > 0;

  // What the platform is ACTUALLY enforcing right now — the override if one is
  // set, otherwise the env floor. Stated plainly so nobody has to infer it.
  const effective = data.aiGuestDailyMax ?? data.envAiGuestDailyMax;

  const error = save.error ? apiError(save.error) : null;

  return (
    <AdminLayout>
      <header className="mb-5">
        <h1 className="text-[26px] font-bold leading-tight text-ink-900">Platform settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Two platform-wide controls. Everything else — verification, categories, featured content,
          staff permissions — has its own screen. Every change here is recorded in the audit log.
        </p>
      </header>

      {/* --- floating action bar: Save is never a scroll away ---
           Sticky TOP, matching `ProductForm` and `CompanyProfile`. A bottom bar
           was tried first and floated over the last field until you scrolled to
           the very end of the page. */}
      <div className="sticky top-0 z-20 mb-5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white/95 px-4 py-2.5 shadow-lift backdrop-blur">
          <p className="min-w-0 text-[12.5px] text-muted">
            {data.updatedAt ? `Last changed ${formatListTime(data.updatedAt)}` : 'Never changed'}
            {' · Recorded in the audit log'}
          </p>
          <Button
            size="sm"
            onClick={() => save.mutate(patch)}
            disabled={!dirty || save.isPending}
            loading={save.isPending}
          >
            Save changes
          </Button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="That didn’t save" className="mb-4">
          {error.message}
        </Alert>
      )}
      {saved && !dirty && (
        <FlashMessage className="mb-4" onDismiss={() => setSaved(false)}>
          Saved. The change is live immediately — no restart needed.
        </FlashMessage>
      )}

      <div className="space-y-5">
        {/* ── AI guest ceiling ─────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
          <div className="flex items-center gap-3 border-b border-surface-border px-5 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <SparkleIcon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-bold text-ink-900">AI search — guest daily limit</h2>
          </div>

          <div className="space-y-4 px-5 py-4">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-700">
              How many AI searches signed-out visitors may run between them each day, across the
              whole site. Past it, guests still get ordinary keyword results — search never breaks,
              it stops spending. Signed-in companies have their own separate allowance and are not
              affected by this number.
            </p>

            <div className="max-w-xs">
              <Field
                label="Daily limit for guests"
                helper={
                  form.aiGuestDailyMax === ''
                    ? `Empty — using the server default of ${data.envAiGuestDailyMax ?? 'no limit'}.`
                    : 'Applies immediately once saved.'
                }
              >
                {(id, hasError) => (
                  <input
                    id={id}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={form.aiGuestDailyMax}
                    onChange={set('aiGuestDailyMax')}
                    placeholder={data.envAiGuestDailyMax != null ? String(data.envAiGuestDailyMax) : 'No limit'}
                    className={inputClasses(hasError)}
                  />
                )}
              </Field>
            </div>

            <div className="rounded-xl bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
              <p>
                <span className="font-semibold">In force now: </span>
                {effective != null ? `${effective} searches a day` : 'No limit configured'}
                {data.aiGuestDailyMax == null && data.envAiGuestDailyMax != null && ' (the server default)'}
              </p>
              {/* The env var is not retired by this field — it stays the floor the
                  process boots with, and the value the platform falls back to if
                  this setting can't be read. Saying so here stops the next person
                  wondering why the .env still has it. */}
              <p className="mt-1 text-muted">
                Leave the box empty to go back to the server default
                {data.envAiGuestDailyMax != null ? ` (${data.envAiGuestDailyMax})` : ''}. The default
                is set on the server and is also what the platform falls back to if this setting
                can’t be read.
              </p>
            </div>
          </div>
        </section>

        {/* ── Support contact ──────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
          <div className="flex items-center gap-3 border-b border-surface-border px-5 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <MailIcon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-bold text-ink-900">Support contact</h2>
          </div>

          <div className="space-y-4 px-5 py-4">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-700">
              Shown to buyers and exporters when they need to reach you — in transactional email and
              on the public pages.{' '}
              <span className="font-semibold text-ink-900">
                The Terms and Privacy pages currently tell people to use “the contact address
                published by MPX Global”, and nothing is published until this is filled in.
              </span>
            </p>

            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <Field label="Support email" helper="Where account and privacy questions go.">
                {(id, hasError) => (
                  <input
                    id={id}
                    type="email"
                    autoComplete="off"
                    value={form.supportEmail}
                    onChange={set('supportEmail')}
                    placeholder="support@example.com"
                    className={inputClasses(hasError)}
                  />
                )}
              </Field>
              <Field label="Support phone" optional helper="Include the country code.">
                {(id, hasError) => (
                  <input
                    id={id}
                    type="tel"
                    autoComplete="off"
                    value={form.supportPhone}
                    onChange={set('supportPhone')}
                    placeholder="+91 98765 43210"
                    className={inputClasses(hasError)}
                  />
                )}
              </Field>
            </div>
          </div>
        </section>
      </div>

    </AdminLayout>
  );
}
