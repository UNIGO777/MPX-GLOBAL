import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { actionDot, actionLabel } from '../../lib/auditFormat.js';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import {
  AlertIcon,
  BoxIcon,
  ChatIcon,
  ChevronLeftIcon,
  ExternalIcon,
  FileIcon,
  ListIcon,
  UsersIcon,
} from '../../components/ui/icons.jsx';

/**
 * M5 screen 15 — the Organisation detail: a company's whole file.
 *
 * §7 names three things this screen must be HONEST about, and each one is a
 * rendering decision here rather than a note in a doc:
 *
 *  1. **What a block actually reaches.** The server sends `blockReach` plus the
 *     cascade's own status, so the screen states the real consequence and can
 *     say when the cascade FAILED — a failure means the catalogue is still live
 *     while the console says "blocked".
 *  2. **`kycStatus` is ONE value across both sides.** Whichever side is reviewed
 *     first verifies the whole company, so an unreviewed exporter side can carry
 *     a public tick. `reviewedSides` is therefore shown next to the status, and
 *     an unreviewed side is called out rather than left to be inferred.
 *  3. **Some fields never fill.** `notCaptured` is the server's own list of
 *     fields with no capture path (identity capture is Phase 2). They are named
 *     as "not captured", never rendered as empty rows waiting for input.
 *
 * Gate: `organisation:read` for the page; block/unblock is a hard superadmin
 * gate on the server and the control is hidden for anyone else.
 */
/**
 * 🔴 `address` is a SUB-DOCUMENT (line1 · line2 · city · state · postalCode ·
 * country), not a string. Rendering it straight into JSX threw "Objects are not
 * valid as a React child" and blanked the whole page — the first version of this
 * screen did exactly that.
 *
 * An empty sub-document is `{}` rather than null, so "has an address" means
 * "has at least one populated part", not "is present".
 */
function formatAddress(address) {
  if (!address) return null;
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function Section({ title, children, action = null }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3 sm:px-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-ink-500">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * One fact, label above value. The label/value ROW works for long prose but
 * wasted half a card here — most of these values are one word or a date, and a
 * fixed label column pushed them into a narrow strip with a void beside it.
 */
/**
 * `span` controls how much of the row a fact takes:
 *   auto   one cell (2-up on a phone, 3-up from `sm`)
 *   phone  full width on a PHONE only — for a value that is a short sentence,
 *          which wraps badly in a half-width cell but sits fine in a third
 *   full   full width everywhere — for prose (an address, a rejection reason)
 *
 * 🔴 Getting this wrong is what left the verification card ragged: "Sides
 * reviewed" spanned all three columns at every width, so STATUS sat alone in
 * row 1 with two empty cells beside it and RESUBMITS sat alone in the last.
 * A grid only reads as a grid when the cells actually fill it.
 */
function Fact({ label, children, span = 'auto' }) {
  const width =
    span === 'full' ? 'col-span-2 sm:col-span-3' : span === 'phone' ? 'col-span-2 sm:col-span-1' : '';
  return (
    <div className={width}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-1 flex min-h-[1.75rem] items-center text-sm text-ink-800">
        {children ?? <span className="text-ink-400">—</span>}
      </dd>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-surface-border py-2.5 last:border-0">
      <dt className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-ink-800">{children ?? <span className="text-ink-400">—</span>}</dd>
    </div>
  );
}

/**
 * One number in the strip under the header — a PILL, not a card (owner,
 * 2026-08-18).
 *
 * Five bordered tiles was a lot of furniture for five small numbers: on a phone
 * they became a 2-up grid three rows deep, pushing the actual record below the
 * fold. As pills they wrap into one or two lines and read as a summary line,
 * which is what they are.
 *
 * §3 — a count still links to the list it counts wherever one exists; the two
 * with no list behind them render as plain pills rather than links to nowhere.
 */
function Pill({ to, value, label, Icon, tone = 'default' }) {
  const danger = tone === 'danger';
  const body = (
    <>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${danger ? 'text-danger-500' : 'text-ink-400'}`}
        aria-hidden="true"
      />
      <span className="text-[12px] font-medium text-ink-600">{label}</span>
      <span className={`text-[15px] font-bold leading-none ${danger ? 'text-danger-700' : 'text-ink-900'}`}>
        {value}
      </span>
    </>
  );
  const shell = `inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 ${
    danger ? 'border-danger-200 bg-danger-50/60' : 'border-surface-border bg-white'
  }`;
  return to ? (
    <Link to={to} className={`${shell} transition-colors hover:border-primary-300 hover:bg-primary-50/50`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

const SIDE_LABEL = { buyer: 'Buyer', exporter: 'Exporter' };

export function OrganisationDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const isSuperadmin = me?.role === 'superadmin';

  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState(null);

  const org = useQuery({
    queryKey: ['admin', 'org', id],
    queryFn: () => adminApi.getOrg(id),
    refetchInterval: (q) =>
      q.state.data?.blockReach?.cascade?.status === 'running' ? 4000 : false,
  });

  const canAudit = can(me, 'audit:read');
  // §5 — the audit trail is EMBEDDED, pre-filtered to this org, not just a link.
  const orgAudit = useQuery({
    queryKey: adminCatalogueKeys.audit({ orgId: id, preview: 6 }),
    queryFn: () => adminCatalogueApi.audit({ orgId: id, pageSize: 6 }),
    enabled: canAudit,
  });

  const data = org.data ?? null;
  const blocked = data?.header?.blocked;

  const setBlocked = useMutation({
    mutationFn: () =>
      blocked ? adminApi.unblockOrg(id, reason.trim() || undefined) : adminApi.blockOrg(id, reason.trim()),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setBlockOpen(false);
      setReason('');
      // The cascade runs in the background, so the whole record is re-read
      // rather than patched — product and chat counts move with it.
      qc.invalidateQueries({ queryKey: ['admin', 'org', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
    },
    onError: (err) => setActionError(apiError(err, 'Could not update this company.')),
  });

  if (org.isLoading) {
    return (
      <AdminLayout>
        <SkeletonRows rows={10} />
      </AdminLayout>
    );
  }

  if (org.error) {
    const e = apiError(org.error);
    return (
      <AdminLayout>
        <ErrorState title="We couldn't load this company" message={e.message} requestId={e.requestId} onRetry={org.refetch} />
      </AdminLayout>
    );
  }

  const { header, company, notCaptured, verification, sides, users, chats, products, buyerActivity, blockReach } = data;
  const cascade = blockReach?.cascade;

  // §7.2 — an unreviewed side inherits the tick. Say which sides were actually
  // looked at, and name the one that was not.
  const reviewed = verification.reviewedSides ?? [];
  const unreviewed = ['buyer', 'exporter'].filter((s) => sides[s] && !reviewed.includes(s));

  return (
    <AdminLayout>
      <Link
        to="/admin/organisations"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-primary-700"
      >
        <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        All organisations
      </Link>

      {actionError && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="danger">{actionError.message}</Alert>
        </div>
      )}

      {/* 🔴 A background cascade that FAILED means the console says "blocked"
          while the catalogue is still live. That cannot be a silent state. */}
      {cascade?.failed && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="danger">
            The block cascade failed for this company — its products and conversations may still be
            live. Re-run it by unblocking and blocking again, and check the audit log.
          </Alert>
        </div>
      )}

      <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-surface-border bg-white p-4 shadow-card sm:flex-row sm:items-start sm:gap-5 sm:p-5">
        {/* 🔴 The mark and the identity are ONE unit and stay on one row at every
            width — stacking them below `sm` spent a whole row on a 44px tile and
            pushed the name down the page. The type steps down instead. */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 shrink-0">
            <CompanyAvatar name={header.name} logo={company.logo} size="md" />
          </span>
          <div className="min-w-0 flex-1">
          {/* 🔴 The name owns its line. The chips used to sit INLINE with it, so
              a 24px heading and an 11px badge shared a baseline and the row
              wrapped mid-title on a phone. They are a set — status, blocked,
              side — so they get a row of their own, at ONE size: they were three
              different paddings and three different text sizes, which read as
              three unrelated things rather than one company's state. */}
          <h1 className="text-[17px] font-bold leading-tight text-ink-900 sm:text-2xl">{header.name}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip status={header.verified ? 'verified' : verification.status} />
            {blocked && (
              <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-danger-50 px-3 py-1.5 text-[13px] font-semibold text-danger-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                Blocked
              </span>
            )}
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-ink-100 px-3 py-1.5 text-[13px] font-medium text-ink-700">
              {sides.both ? 'Buyer + Exporter' : sides.exporter ? 'Exporter' : sides.buyer ? 'Buyer' : 'No side'}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            {header.slug ? <code className="font-mono text-xs">{header.slug}</code> : 'No slug'}
            {header.verified && header.verifiedAt ? ` · Verified ${formatDate(header.verifiedAt)}` : ''}
            {header.createdAt ? ` · Joined ${formatDate(header.createdAt)}` : ''}
          </p>
          </div>
        </div>

        {isSuperadmin && (
          <Button
            variant={blocked ? 'primary' : 'danger'}
            className="w-full sm:w-auto"
            onClick={() => { setReason(''); setBlockOpen(true); }}
          >
            {blocked ? 'Unblock company' : 'Block company'}
          </Button>
        )}
      </header>

      {blocked && header.blockReason && (
        <div className="mb-5 max-w-3xl">
          <Alert tone="danger">
            <span className="font-semibold">Blocked{header.blockedAt ? ` ${formatDate(header.blockedAt)}` : ''}:</span>{' '}
            {header.blockReason}
          </Alert>
        </div>
      )}

      {/* 🔴 The strip a moderator reads FIRST. The decision this page exists for
          is "should this company keep trading", and these are the numbers that
          answer it — not a row inside a section three scrolls down. Every tile
          that has a list behind it links to that list already filtered (§3: a
          count that cannot be clicked through is a dead end). */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {products && (
          <>
            <Pill to={`/admin/products?seller=${header.id}`} value={products.active ?? 0} label="Live products" Icon={BoxIcon} />
            <Pill
              to={`/admin/products?seller=${header.id}&status=blocked`}
              value={products.blocked ?? 0}
              label="Taken down"
              Icon={AlertIcon}
              tone={products.blocked > 0 ? 'danger' : 'default'}
            />
            <Pill
              value={products.takedownCount ?? 0}
              label="Takedowns all time"
              Icon={AlertIcon}
              tone={products.takedownCount > 0 ? 'danger' : 'default'}
            />
          </>
        )}
        <Pill
          to={`/admin/conversations?orgId=${header.id}&side=buyer`}
          value={chats.asBuyer ?? 0}
          label="Chats as buyer"
          Icon={ChatIcon}
        />
        <Pill
          to={`/admin/conversations?orgId=${header.id}&side=exporter`}
          value={chats.asExporter ?? 0}
          label="Chats as exporter"
          Icon={ChatIcon}
        />
        {buyerActivity && (
          <>
            <Pill
              to={`/admin/conversations?orgId=${header.id}&side=buyer`}
              value={buyerActivity.enquiriesSent ?? 0}
              label="Enquiries sent"
              Icon={ChatIcon}
            />
            <Pill value={buyerActivity.savedItems ?? 0} label="Saved items" Icon={BoxIcon} />
          </>
        )}
        <Pill value={users.length} label={users.length === 1 ? 'Account' : 'Accounts'} Icon={UsersIcon} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {/* The record — read top to bottom in the order the questions come:
            is this company trustworthy, who are they, what do they have. */}
        <div className="grid gap-5 lg:col-span-2">
          <Section
            title="Verification"
            action={
              can(me, 'kyc:view') && verification.kycDocumentCount > 0 ? (
                <Link
                  to={`/admin/verification/${header.id}/kyc`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline"
                >
                  <FileIcon className="h-4 w-4" aria-hidden="true" />
                  {verification.kycDocumentCount}{' '}
                  {verification.kycDocumentCount === 1 ? 'document' : 'documents'}
                </Link>
              ) : null
            }
          >
            {/* §7.2 — one shared kycStatus, so a side nobody looked at can carry
                the public tick. Stated at the TOP of this card, not under six
                rows: it is the caveat on everything below it. */}
            {header.verified && unreviewed.length > 0 && (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-800">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  The {unreviewed.map((s) => SIDE_LABEL[s]).join(' and ')} side carries the verified
                  tick without having been reviewed — verification is one shared status per company.
                </span>
              </p>
            )}

            <dl className="grid grid-cols-2 items-start gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact label="Status"><StatusChip status={verification.status} /></Fact>
              <Fact label="Sides reviewed" span="phone">
                {reviewed.length > 0 ? (
                  <>
                    {reviewed.map((x) => SIDE_LABEL[x] ?? x).join(' · ')}
                    {verification.reviewedAt ? ` · ${formatDate(verification.reviewedAt)}` : ''}
                  </>
                ) : (
                  <span className="text-ink-400">Nobody has reviewed either side</span>
                )}
              </Fact>
              <Fact label="Submitted">{verification.submittedAt ? formatDate(verification.submittedAt) : null}</Fact>
              <Fact label="Verified">{verification.verifiedAt ? formatDate(verification.verifiedAt) : null}</Fact>
              <Fact label="Verified by">
                {verification.verifiedBy ? (
                  <>
                    {verification.verifiedBy.name ?? <span className="text-muted">Account removed</span>}
                    {verification.verifiedBy.role && (
                      <span className="ml-2 text-xs text-muted">{verification.verifiedBy.role}</span>
                    )}
                  </>
                ) : header.verified ? (
                  /* A dash reads as "empty field". On a company that IS verified
                     it has to say the actual situation: the tick exists and no
                     actor was recorded against it (seeded or pre-audit data). */
                  <span className="text-warning-700">Verified with no actor recorded</span>
                ) : null}
              </Fact>
              <Fact label="Resubmits">{verification.resubmitCount ?? 0}</Fact>
              {verification.rejectionReason && (
                <Fact label="Rejection reason" span="full">{verification.rejectionReason}</Fact>
              )}
            </dl>
          </Section>

          <Section title="Company">
            {/* Two columns of short facts instead of one long ladder — the values
                are a word each and were costing a full row apiece. */}
            <dl className="grid grid-cols-2 items-start gap-x-6 gap-y-4 sm:grid-cols-3">
              {/* `countryName`, not the raw ISO code: "IN" is what the database
                  stores, "India" is what a person reads. Falls back to the code
                  for anything the table does not know. */}
              <Fact label="Country">
                {company.country ? (countryName(company.country) ?? company.country) : null}
              </Fact>
              <Fact label="Entity type">{company.entityType}</Fact>
              <Fact label="Created">{header.createdAt ? formatDate(header.createdAt) : null}</Fact>
              <Fact label="Address" span="full">{formatAddress(company.address)}</Fact>
            </dl>
            {company.description && (
              <p className="mt-3 border-t border-surface-border pt-3 text-sm leading-relaxed text-ink-700">
                {company.description}
              </p>
            )}
            {notCaptured?.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Never captured (identity capture is Phase 2): {notCaptured.join(', ')}.
              </p>
            )}
          </Section>

          {products && (
            <Section
              title="Catalogue"
              action={
                <div className="flex items-center gap-3">
                  <Link to={`/admin/products?seller=${header.id}`} className="text-sm font-semibold text-primary-700 hover:underline">
                    Open in monitoring
                  </Link>
                  {header.slug && (
                    <a
                      href={`/supplier/${header.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline"
                    >
                      Public profile
                      <ExternalIcon className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              }
            >
              {/* 🔴 The FULL breakdown, live and taken-down included (owner,
                  2026-08-18). I had removed those two because the strip at the
                  top carries them, but a card called "Catalogue" that omits the
                  live count is not a breakdown — it is a puzzle with a footnote
                  telling you where the missing pieces went. The strip answers
                  "should I act"; this card answers "what does this company
                  actually have", and it has to be complete to do that. */}
              <dl className="grid grid-cols-2 items-start gap-x-6 gap-y-4 sm:grid-cols-3">
                <Fact label="Live">{products.active ?? 0}</Fact>
                <Fact label="Hidden by seller">{products.inactive ?? 0}</Fact>
                <Fact label="Draft">{products.draft ?? 0}</Fact>
                <Fact label="Taken down">
                  <span className={products.blocked > 0 ? 'font-semibold text-danger-700' : undefined}>
                    {products.blocked ?? 0}
                  </span>
                </Fact>
                {/* W3 — the monitoring list refuses to show archived rows, so
                    this number deliberately links nowhere. */}
                <Fact label="Archived">
                  {products.archived ?? 0}
                  <span className="ml-2 text-xs text-muted">not in monitoring</span>
                </Fact>
                <Fact label="Total">
                  {(products.active ?? 0) + (products.inactive ?? 0) + (products.draft ?? 0) +
                    (products.blocked ?? 0) + (products.archived ?? 0)}
                </Fact>
              </dl>
            </Section>
          )}

          <Section title={`Accounts (${users.length})`}>
            {users.length === 0 ? (
              <p className="text-sm text-muted">No accounts on this company.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {users.map((u) => (
                  <li key={u.id} className="py-3 sm:grid sm:grid-cols-[1fr_6rem_7rem_10rem] sm:items-center sm:gap-x-4 sm:py-2.5">
                    <span className="block min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900">{u.name}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-0 sm:contents">
                      <span className="justify-self-start rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                        {SIDE_LABEL[u.role] ?? u.role}
                      </span>
                      <span className={`text-xs font-medium ${u.isActive ? 'text-ink-600' : 'text-danger-700'}`}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                      <span className="text-xs text-muted">
                        {u.lastLoginAt ? `Last login ${formatDate(u.lastLoginAt)}` : 'Never signed in'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* The rail — reference, not decisions. */}
        <div className="grid gap-5">
          <Section title="Sides">
            <dl>
              <Row label="Buyer">{sides.buyer ? 'Enabled' : <span className="text-ink-400">Not enabled</span>}</Row>
              <Row label="Exporter">{sides.exporter ? 'Enabled' : <span className="text-ink-400">Not enabled</span>}</Row>
              <Row label="Signed up">{sides.signupAt ? formatDate(sides.signupAt) : null}</Row>
              <Row label="Claims">
                {sides.claimHistoryAvailable === false ? (
                  <span className="text-ink-400">Not recorded — claim is not built</span>
                ) : sides.claimHistory?.length > 0 ? (
                  sides.claimHistory.map((c, i) => (
                    <span key={i} className="block">
                      {formatDate(c.at)}
                      {c.byUserId && (
                        <code className="ml-2 font-mono text-[11px] text-ink-500">{c.byUserId}</code>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-ink-400">No claims recorded</span>
                )}
              </Row>
            </dl>
          </Section>

          {/* §7.1 — what a block ACTUALLY reaches, next to the button that does
              it, so nobody blocks a company and assumes more (or less) happened. */}
          <Section title="What a block does">
            <p className="text-sm leading-relaxed text-ink-700">{blockReach?.note}</p>
            {cascade?.status === 'running' && (
              <p className="mt-2 flex items-center gap-2 text-xs font-medium text-warning-800">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-400 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-warning-500" />
                </span>
                Cascade running — taking listings down and freezing conversations…
              </p>
            )}
            {cascade?.completedAt && !cascade.failed && (
              <p className="mt-2 text-xs text-muted">
                Last cascade completed {formatDate(cascade.completedAt)}
                {cascade.products != null
                  ? ` · ${cascade.products} product${cascade.products === 1 ? '' : 's'}`
                  : ''}
                {cascade.conversations != null
                  ? ` · ${cascade.conversations} conversation${cascade.conversations === 1 ? '' : 's'}`
                  : ''}
              </p>
            )}
          </Section>

          <Section
            title="Audit trail"
            action={
              canAudit ? (
                <Link
                  to={`/admin/audit?orgId=${header.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline"
                >
                  <ListIcon className="h-4 w-4" aria-hidden="true" />
                  View in audit log
                </Link>
              ) : null
            }
          >
            {!canAudit ? (
              <p className="text-sm leading-relaxed text-muted">
                Verification decisions, takedowns, chat blocks and account changes for this company
                live in the append-only log. You don&apos;t hold the permission to read it.
              </p>
            ) : orgAudit.isLoading ? (
              <SkeletonRows rows={3} />
            ) : orgAudit.error ? (
              <p className="text-sm text-muted">{apiError(orgAudit.error).message}</p>
            ) : (orgAudit.data?.entries ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nothing recorded for this company yet.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {(orgAudit.data?.entries ?? []).map((row) => (
                  <li key={row.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${actionDot(row.action)}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink-900">
                        {actionLabel(row.action)}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {row.actor?.name ?? 'System'}
                        {row.target?.name ? ` · ${row.target.name}` : ''}
                      </span>
                    </span>
                    <time
                      dateTime={row.occurredAt ?? undefined}
                      className="shrink-0 text-[11px] tabular-nums text-ink-400"
                    >
                      {formatDate(row.occurredAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* Block / unblock. The reach is stated in the dialog itself: the console
          must never let an admin assume more (or less) happened than did. */}
      <Modal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        danger={!blocked}
        title={blocked ? `Unblock ${header.name}?` : `Block ${header.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button
              variant={blocked ? 'primary' : 'danger'}
              loading={setBlocked.isPending}
              disabled={!blocked && reason.trim().length < 3}
              onClick={() => setBlocked.mutate()}
            >
              {blocked ? 'Unblock company' : 'Block company'}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-700">
          {blocked
            ? 'Everyone here can sign in again and the catalogue returns. Accounts and products that were already inactive before the block stay that way.'
            : blockReach?.note}
        </p>

        <div className="mt-4">
          <Field
            label="Reason"
            optional={Boolean(blocked)}
            helper="Kept in the audit record. It is not shown to the company."
          >
            {(fieldId) => (
              <textarea
                id={fieldId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="block w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm text-ink-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
              />
            )}
          </Field>
        </div>
      </Modal>
    </AdminLayout>
  );
}
