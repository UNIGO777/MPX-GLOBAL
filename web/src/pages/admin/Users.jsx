import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { config } from '../../config.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError, formatDate, KYC_STATUS_META } from '../../lib/format.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { can } from '../../auth/roleHome.js';
import {
  SearchOffIcon,
  CloudOffIcon,
  AlertIcon,
  EyeIcon,
  BadgeCheckIcon,
  BuildingIcon,
  CheckCircleIcon,
  SlashIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  ChevronRightIcon,
} from '../../components/ui/icons.jsx';
import { cp } from '../../lib/consolePath.js';

/**
 * User directory (`user:read`; mockup: admin_user_management_updated_data).
 * GET /admin/users — filters use the backend enums exactly; `q` is an anchored
 * PREFIX match server-side, so the search is labelled "Starts with…". Rows
 * carry no company name (the aggregation projection omits it) — noted in the
 * plan, no column for it.
 *
 * Activate/Deactivate are HARD superadmin gates: the buttons don't render for
 * employees, AND the server refusals (self, superadmin target, org-blocked)
 * surface as inline messages when they fire anyway.
 */
/**
 * 🔴 Buyers and exporters ONLY (owner, 2026-08-18). Staff — employees and
 * superadmins — are the team, not the marketplace, and they live on
 * /admin/staff. Mixing them here meant the KYC column, the company chips and
 * every org-level action were blank on a third of the rows, and a search for a
 * trading partner returned colleagues.
 *
 * "All roles" is not "no filter": it asks for `buyer,exporter` explicitly, so
 * the SERVER decides who is in this directory and the count in the header is
 * the truth rather than a page-local guess.
 */
const MARKETPLACE_ROLES = 'buyer,exporter';

const ROLE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'exporter', label: 'Exporter' },
];

const KYC_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'pending', label: 'Not submitted' },
  { value: 'submitted', label: 'In review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Needs attention' },
];

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

const ROLE_LABELS = {
  buyer: 'Buyer',
  exporter: 'Exporter',
  employee: 'Employee',
  superadmin: 'Super Admin',
};

/**
 * F1-A · "this account is dark because its COMPANY is blocked".
 *
 * Deliberately distinct from the account's own Active/Deactivated state, which
 * sits beside it: an individually deactivated user inside a healthy company and
 * a healthy user inside a blocked company look identical on the account chip,
 * and they are undone by different actions.
 */
function OrgBlockedChip({ row }) {
  if (row.orgIsActive !== false) return null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-700">
      <BuildingIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      Company blocked
    </span>
  );
}

/**
 * The account's mark: its COMPANY's uploaded logo when there is one, its
 * initials when there is not.
 *
 * 🔒 There is no personal profile photo anywhere in this product and the model
 * has never carried one — an account is shown by the company it belongs to.
 * Staff rows have no company logo, so they keep the monogram, which is the
 * honest rendering rather than a placeholder face.
 *
 * `object-contain` because a company mark is usually a WORDMARK: `cover` fills
 * the tile by cropping and eats the ends of the word.
 */
function AccountAvatar({ row }) {
  if (row.orgLogo) {
    return (
      <img
        src={row.orgLogo}
        alt=""
        loading="lazy"
        className={`h-9 w-9 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-inset ring-ink-200 ${
          row.isActive ? '' : 'opacity-60 grayscale'
        }`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        row.isActive ? 'bg-primary-50 text-primary-700' : 'bg-ink-100 text-ink-500'
      }`}
    >
      {initials(row.name)}
    </span>
  );
}

/**
 * The account's own state as a chip (2026-09-24), matching the Organisations
 * State chip — a dot + word; colour is never the only signal.
 */
function AccountChip({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-[12px] font-semibold text-success-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-600">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-400" />
      Deactivated
    </span>
  );
}

/** The name is a real button so keyboard users reach the details too. */
function UserName({ row, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block max-w-full truncate text-left font-semibold text-ink-900 hover:text-primary-700 hover:underline"
    >
      {row.name}
    </button>
  );
}

/**
 * Second line: role badge + email (+ mobile) — the role and mobile columns
 * were the widest thing in the old table and mostly repeated the filter.
 */
function UserMeta({ row }) {
  const contact = [row.email, row.mobile].filter(Boolean).join(' · ');
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
      <span className="inline-flex shrink-0 items-center rounded-full bg-ink-100 px-2 py-px text-[11px] font-medium text-ink-600">
        {ROLE_LABELS[row.role] ?? row.role}
      </span>
      <span className="truncate text-xs text-muted">{contact || '—'}</span>
    </div>
  );
}

const rowTone = (row) =>
  row.orgIsActive === false
    ? 'bg-danger-50/40 hover:bg-danger-50/70'
    : row.isActive
      ? 'hover:bg-ink-50/70'
      : 'bg-ink-50/40 hover:bg-ink-50/80';

/** One labelled row inside a details card. */
function DetailRow({ Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-muted">{label}</p>
        <div className="mt-0.5 break-words text-[14px] text-ink-900">{children}</div>
      </div>
    </div>
  );
}

function DetailCard({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-semibold text-ink-500">{title}</h3>
      <div className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-white">
        {children}
      </div>
    </section>
  );
}

/**
 * The body of the user details drawer. `row` is the list row (it carries the
 * org's logo and blocked state); `data` is GET /admin/users/:id (it carries the
 * org's name and verification).
 */
function UserDetail({ row, data, canOpenCompany }) {
  const org = data.org;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
          {ROLE_LABELS[data.role] ?? data.role}
        </span>
        <AccountChip active={data.isActive} />
        <OrgBlockedChip row={row} />
      </div>

      <DetailCard title="Contact">
        <DetailRow Icon={MailIcon} label="Email">
          <a href={`mailto:${data.email}`} className="hover:text-primary-700 hover:underline">{data.email}</a>
        </DetailRow>
        <DetailRow Icon={PhoneIcon} label="Mobile">
          {data.mobile ? (
            <a href={`tel:${data.mobile}`} className="tabular-nums hover:text-primary-700 hover:underline">{data.mobile}</a>
          ) : (
            <span className="text-muted">Not given</span>
          )}
        </DetailRow>
      </DetailCard>

      {org && (
        <DetailCard title="Company">
          <div className="flex items-center gap-3 px-4 py-3">
            <CompanyAvatar name={org.name} logo={row.orgLogo} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink-900">{org.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {org.kycStatus && KYC_STATUS_META[org.kycStatus] && <StatusChip status={org.kycStatus} />}
                {org.verifiedAt && org.kycStatus === 'verified' && (
                  <span className="text-xs text-muted">since {formatDate(org.verifiedAt)}</span>
                )}
              </div>
            </div>
          </div>
          {canOpenCompany && row.orgId && (
            <Link
              to={cp(`/admin/organisations/${row.orgId}`)}
              className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50/60"
            >
              Open company
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </DetailCard>
      )}

      <DetailCard title="Account">
        <DetailRow Icon={CalendarIcon} label="Joined">{formatDate(data.createdAt)}</DetailRow>
      </DetailCard>
    </div>
  );
}

export function Users() {
  const { user: me } = useAuth();
  const isSuperadmin = me?.role === 'superadmin';

  const [filters, setFilters] = useState({ role: '', kycStatus: '', q: '' });
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.table.pageSizes[0]);

  const [confirmTarget, setConfirmTarget] = useState(null); // user row awaiting deactivate confirm
  // F1-A · the company-level action. Separate state from `confirmTarget` on
  // purpose: deactivating a PERSON and taking a COMPANY offline are different
  // decisions with different blast radii, and sharing one dialog would make it
  // possible to confirm the wrong one.
  const [orgTarget, setOrgTarget] = useState(null); // { row, blocking }
  const [orgReason, setOrgReason] = useState('');
  const [actionError, setActionError] = useState(null);
  const [actingId, setActingId] = useState(null);
  // The design's "View details". `GET /admin/users/:id` already returns the
  // curated view WITH the org, so this is real data — and it is the only place
  // the company name surfaces, since the list projection omits it.
  const [detail, setDetail] = useState(null); // {loading, row, data, error}

  /**
   * TanStack Query rather than a fetch in an effect (`web-frontend.md`).
   * `placeholderData` keeps the previous page on screen while the next one
   * loads, so paging no longer blanks the table.
   */
  const params = {
    page,
    pageSize,
    role: filters.role || MARKETPLACE_ROLES,
    ...(filters.kycStatus ? { kycStatus: filters.kycStatus } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminApi.listUsers(params),
    placeholderData: (prev) => prev,
  });
  const data = list.data ?? null;
  const loading = list.isLoading;
  const error = list.error ? apiError(list.error) : null;
  const load = list.refetch;

  // Debounce the prefix search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === qInput.trim() ? f : { ...f, q: qInput.trim() }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const setActive = async (row, active) => {
    setActionError(null);
    setActingId(row.id);
    try {
      const updated = active
        ? await adminApi.activateUser(row.id)
        : await adminApi.deactivateUser(row.id);
      // Written into the query cache, which is now the single source of truth
      // for this table — a parallel `useState` copy would go stale on refetch.
      qc.setQueryData(['admin', 'users', params], (d) =>
        (d ? {
          ...d,
          rows: d.rows.map((r) => (r.id === row.id ? { ...r, isActive: updated.isActive } : r)),
        } : d));
    } catch (err) {
      setActionError(apiError(err, 'Could not update this account.'));
    } finally {
      setActingId(null);
      setConfirmTarget(null);
    }
  };

  /**
   * F1-A · block or unblock the whole ORGANISATION behind a row.
   *
   * Every row of the same company flips together, because they describe one
   * org — refetching would do it too, but rewriting the cache keeps the table
   * from blanking, and a stale "Block" on a sibling row is an invitation to
   * fire a governance action twice.
   */
  const setOrgBlocked = async (row, blocking, reason) => {
    setActionError(null);
    setActingId(row.id);
    try {
      const res = blocking
        ? await adminApi.blockOrg(row.orgId, reason)
        : await adminApi.unblockOrg(row.orgId, reason || undefined);
      const isActive = res.organisation?.isActive ?? !blocking;
      qc.setQueryData(['admin', 'users', params], (d) =>
        (d ? {
          ...d,
          rows: d.rows.map((r) => (r.orgId === row.orgId ? { ...r, orgIsActive: isActive } : r)),
        } : d));
      // The cascade also flips each user's own `isActive`, and that is NOT
      // derivable here (unblock restores each user's PRIOR state, m5-rules §122
      // — a user deactivated before the block stays deactivated). So the server
      // is asked rather than guessed at.
      await load();
    } catch (err) {
      setActionError(apiError(err, 'Could not update this company.'));
    } finally {
      setActingId(null);
      setOrgTarget(null);
      setOrgReason('');
    }
  };

  const rows = data?.rows ?? [];

  /**
   * The design's row menu. Each entry is added ONLY when the viewer can
   * actually perform it, so nothing renders dead. "View details" from the
   * design is absent — there is no user-detail screen to open (logged in
   * docs/UiWebNotes.md).
   */
  const openDetails = async (row) => {
    setDetail({ loading: true, row });
    try {
      setDetail({ row, data: await adminApi.getUser(row.id) });
    } catch (err) {
      setDetail({ row, error: apiError(err) });
    }
  };

  const rowActions = (row) => {
    const items = [
      { label: 'View details', Icon: EyeIcon, onSelect: () => openDetails(row) },
    ];
    if (row.orgId && can(me, 'organisation:read')) {
      items.push({
        label: 'Open company',
        Icon: BuildingIcon,
        to: cp(`/admin/organisations/${row.orgId}`),
      });
    }
    // One KYC entry, not two (owner, 2026-08-19): it goes straight to the
    // company's documents, so it is gated by what THAT screen needs — kyc:view,
    // the permission whose use is audited — not the broader review perms.
    if (row.orgId && can(me, 'kyc:view')) {
      items.push({
        label: 'Review KYC',
        Icon: BadgeCheckIcon,
        to: cp(`/admin/verification/${row.orgId}/kyc`),
      });
    }
    if (isSuperadmin) {
      items.push(
        row.isActive
          ? { label: 'Deactivate', Icon: SlashIcon, danger: true, onSelect: () => setConfirmTarget(row) }
          : { label: 'Activate', Icon: CheckCircleIcon, onSelect: () => setActive(row, true) },
      );
      // F1-A — company-level, and superadmin-only on the server too. Staff have
      // no org, so the entry simply does not exist on their rows.
      if (row.orgId) {
        items.push(
          row.orgIsActive === false
            ? {
                label: 'Unblock company',
                Icon: CheckCircleIcon,
                onSelect: () => { setOrgReason(''); setOrgTarget({ row, blocking: false }); },
              }
            : {
                label: 'Block company',
                Icon: BuildingIcon,
                danger: true,
                onSelect: () => { setOrgReason(''); setOrgTarget({ row, blocking: true }); },
              },
        );
      }
    }
    return items;
  };

  // Clicking anywhere on a row/card opens its details — unless the click was
  // on something interactive inside it (the name button, the ⋮ menu).
  const openRow = (e, row) => {
    if (e.target.closest('a, button, [role="menu"], [role="menuitem"]')) return;
    openDetails(row);
  };

  // The drawer's footer: only what this viewer can do. Deactivate closes the
  // drawer first so its confirm is never stacked under the panel.
  const detailActions = ({ row, data: u }) => {
    const active = u.isActive;
    const canKyc = row.orgId && can(me, 'kyc:view');
    const canToggle = isSuperadmin && u.role !== 'superadmin';
    if (!canKyc && !canToggle) return null; // no empty footer bar
    return (
      <>
        {canKyc && (
          <Link
            to={cp(`/admin/verification/${row.orgId}/kyc`)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            <BadgeCheckIcon className="h-4 w-4" aria-hidden="true" />
            Review KYC
          </Link>
        )}
        {canToggle && (
          active ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => { setDetail(null); setConfirmTarget(row); }}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              size="sm"
              // Closes the drawer: a refusal (e.g. company blocked) shows as the
              // page's inline error, which the panel would otherwise cover.
              onClick={() => { setDetail(null); setActive(row, true); }}
            >
              Activate
            </Button>
          )
        )}
      </>
    );
  };

  useEffect(() => {
    const previous = document.title;
    document.title = 'Users — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const rowsTotal = data?.total ?? 0;
  const roleLabel = ROLE_OPTIONS.find((o) => o.value === filters.role)?.label;
  const kycLabel = KYC_OPTIONS.find((o) => o.value === filters.kycStatus)?.label;
  const hasFilters = Boolean(filters.role || filters.kycStatus || filters.q);

  const clearFilters = () => {
    setFilters({ role: '', kycStatus: '', q: '' });
    setQInput('');
    setPage(1);
  };

  /** Design copy: names the filters that produced the empty result. */
  const emptyLine = () => {
    const scope = [
      filters.kycStatus ? kycLabel.toLowerCase() : null,
      filters.role ? `${roleLabel.toLowerCase()}s` : 'buyers or exporters',
    ]
      .filter(Boolean)
      .join(' ');
    return filters.q
      ? `Nothing starts with \u201c${filters.q}\u201d among ${scope}. Remember that search matches from the start of a name, email or mobile.`
      : `No ${scope} to show. Try loosening a filter.`;
  };

  return (
    <AdminLayout>
      <header className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Users</h1>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
            {rowsTotal.toLocaleString(config.locale.numbers)} accounts
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Buyers and exporters on the marketplace. Your own team is under Staff.
        </p>
      </header>

      {/* Toolbar (2026-09-24) — the same language as Organisations: a bordered
          white search and FILTER CHIPS instead of a card of form-field dropdowns.
          Chips scroll sideways on phones; an active one names its value. */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-md lg:flex-1">
          <ToolbarSearch
            id="user-q"
            label="Search — starts with name, email or mobile"
            value={qInput}
            onChange={setQInput}
            onClear={() => setQInput('')}
            placeholder="Name, email or mobile starts with…"
          />
        </div>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip
            label="Role"
            value={filters.role}
            options={ROLE_OPTIONS}
            onChange={(v) => {
              setFilters((f) => ({ ...f, role: v }));
              setPage(1);
            }}
          />
          <FilterChip
            label="Verification"
            value={filters.kycStatus}
            options={KYC_OPTIONS}
            onChange={(v) => {
              setFilters((f) => ({ ...f, kycStatus: v }));
              setPage(1);
            }}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="danger">
            {actionError.message}
            {actionError.requestId && (
              <span className="ml-2 font-mono text-xs opacity-70">{actionError.requestId}</span>
            )}
          </Alert>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {loading && <SkeletonRows rows={8} />}

        {!loading && error && (
          <ErrorState
            icon={CloudOffIcon}
            title="We couldn't load the directory"
            message={error.message}
            requestId={error.requestId}
            onRetry={load}
          />
        )}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={SearchOffIcon}
            title="No accounts match those filters"
            action={
              hasFilters && (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          >
            {emptyLine()}
          </EmptyState>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {/* Cards below lg — phones AND tablets, as on Organisations: the
                table's fixed columns crush the name between md and lg. */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {rows.map((row) => (
                <li
                  key={row.id}
                  onClick={(e) => openRow(e, row)}
                  className={`cursor-pointer p-4 transition-colors ${rowTone(row)}`}
                >
                  <div className="flex items-start gap-3">
                    <AccountAvatar row={row} />
                    <div className="min-w-0 flex-1">
                      <UserName row={row} onOpen={() => openDetails(row)} />
                      <UserMeta row={row} />
                    </div>
                    <RowMenu label={`Actions for ${row.name}`} items={rowActions(row)} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-12">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.kycStatus && KYC_STATUS_META[row.kycStatus] && <StatusChip status={row.kycStatus} />}
                      <AccountChip active={row.isActive} />
                      <OrgBlockedChip row={row} />
                    </div>
                    <span className="text-xs text-muted">Joined {formatDate(row.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-sm">
                {/* Role and mobile ride on the second line under the name instead
                    of columns of their own. Joined appears only from xl — at 1024
                    with the sidebar open it squeezed the emails to a few letters
                    (the date is in the details drawer too). */}
                <colgroup>
                  <col />
                  <col className="w-[9.5rem]" />
                  <col className="w-[9rem]" />
                  <col className="hidden w-[7rem] xl:table-column" />
                  <col className="w-[3.5rem]" />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">User</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Verification</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                    <th scope="col" className="hidden px-4 py-3 font-semibold xl:table-cell">Joined</th>
                    <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={(e) => openRow(e, row)}
                      className={`cursor-pointer transition-colors ${rowTone(row)}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AccountAvatar row={row} />
                          <div className="min-w-0">
                            <UserName row={row} onOpen={() => openDetails(row)} />
                            <UserMeta row={row} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.kycStatus && KYC_STATUS_META[row.kycStatus] ? (
                          <StatusChip status={row.kycStatus} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <AccountChip active={row.isActive} />
                          <OrgBlockedChip row={row} />
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-[13px] text-muted xl:table-cell">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <RowMenu label={`Actions for ${row.name}`} items={rowActions(row)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </div>

      {/* Details drawer (redesigned 2026-09-24): who they are at a glance —
          mark, role, account state — then contact, company and account as
          separate cards, and the actions this viewer can actually take in the
          footer. It used to be a bare list of uppercase labels. */}
      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.row?.name ?? 'User'}
        subtitle={detail?.row?.email}
        footer={detail?.data && detailActions(detail)}
      >
        {detail?.loading && <SkeletonRows rows={3} />}
        {detail?.error && (
          <ErrorState message={detail.error.message} requestId={detail.error.requestId} />
        )}
        {detail?.data && (
          <UserDetail
            row={detail.row}
            data={detail.data}
            canOpenCompany={can(me, 'organisation:read')}
          />
        )}
      </Drawer>

      {/* F1-A · company-level block. NOT the centred one-button confirm the
          person-level deactivate uses: this one takes a written reason, and the
          reason is the moderation record. The consequences are spelled out
          because they reach past this screen — the catalogue and every live
          conversation the company is in. */}
      <Modal
        open={Boolean(orgTarget)}
        onClose={() => setOrgTarget(null)}
        danger={orgTarget?.blocking}
        title={
          orgTarget?.blocking
            ? `Block ${orgTarget?.row?.orgName ?? 'this company'}?`
            : `Unblock ${orgTarget?.row?.orgName ?? 'this company'}?`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOrgTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={orgTarget?.blocking ? 'danger' : 'primary'}
              loading={actingId === orgTarget?.row?.id}
              // A reason is required to block (server: 3–500) and optional to
              // unblock. Disabling beats a round-trip to a 400 the user cannot
              // see the cause of.
              disabled={orgTarget?.blocking && orgReason.trim().length < 3}
              onClick={() => setOrgBlocked(orgTarget.row, orgTarget.blocking, orgReason.trim())}
            >
              {orgTarget?.blocking ? 'Block company' : 'Unblock company'}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-700">
          {orgTarget?.blocking ? (
            <>
              This is a company-level action, not just this account. Everyone at{' '}
              <span className="font-semibold text-ink-900">{orgTarget?.row?.orgName}</span> is signed
              out and cannot log back in, its products stop appearing anywhere public, and every
              conversation it is part of freezes — both sides keep reading, neither can reply.
            </>
          ) : (
            <>
              <span className="font-semibold text-ink-900">{orgTarget?.row?.orgName}</span> can sign
              in again and its catalogue returns. Accounts that were deactivated individually before
              the block stay deactivated. Conversations reopen unless something else is holding them
              frozen.
            </>
          )}
        </p>

        <label htmlFor="org-block-reason" className="mt-4 block text-sm font-medium text-ink-800">
          Reason {orgTarget?.blocking ? '' : <span className="font-normal text-muted">(optional)</span>}
        </label>
        <textarea
          id="org-block-reason"
          value={orgReason}
          onChange={(e) => setOrgReason(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1.5 block w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm text-ink-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
        />
        <p className="mt-1.5 text-xs text-muted">
          Kept in the audit record. It is not shown to the company.
        </p>
      </Modal>

      {/* Design confirm: medallion icon, centred copy, Cancel + Deactivate */}
      <Modal
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        centered
        danger
        icon={AlertIcon}
        title={`Deactivate ${confirmTarget?.name ?? 'this account'}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={actingId === confirmTarget?.id}
              onClick={() => setActive(confirmTarget, false)}
            >
              Deactivate
            </Button>
          </>
        }
      >
        This signs them out everywhere and blocks them from logging in. Their profile and
        documents are kept, and you can reactivate them at any time.
      </Modal>
    </AdminLayout>
  );
}
