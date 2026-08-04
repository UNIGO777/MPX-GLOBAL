import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
import { Select } from '../../components/ui/Select.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { inputClasses } from '../../components/ui/Field.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { can } from '../../auth/roleHome.js';
import {
  SearchIcon,
  SearchOffIcon,
  CloudOffIcon,
  AlertIcon,
  EyeIcon,
  BadgeCheckIcon,
  FileIcon,
  CheckCircleIcon,
  SlashIcon,
} from '../../components/ui/icons.jsx';

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
const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'exporter', label: 'Exporter' },
  { value: 'employee', label: 'Employee' },
  { value: 'superadmin', label: 'Super Admin' },
];

const KYC_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Not submitted' },
  { value: 'submitted', label: 'In review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Needs attention' },
];

const ROLE_LABELS = {
  buyer: 'Buyer',
  exporter: 'Exporter',
  employee: 'Employee',
  superadmin: 'Super Admin',
};

export function Users() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const isSuperadmin = me?.role === 'superadmin';

  const [filters, setFilters] = useState({ role: '', kycStatus: '', q: '' });
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.table.pageSizes[0]);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [confirmTarget, setConfirmTarget] = useState(null); // user row awaiting deactivate confirm
  const [actionError, setActionError] = useState(null);
  const [actingId, setActingId] = useState(null);
  // The design's "View details". `GET /admin/users/:id` already returns the
  // curated view WITH the org, so this is real data — and it is the only place
  // the company name surfaces, since the list projection omits it.
  const [detail, setDetail] = useState(null); // {loading, row, data, error}

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, pageSize };
      if (filters.role) params.role = filters.role;
      if (filters.kycStatus) params.kycStatus = filters.kycStatus;
      if (filters.q) params.q = filters.q;
      setData(await adminApi.listUsers(params));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the prefix search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === qInput.trim() ? f : { ...f, q: qInput.trim() }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  const setActive = async (row, active) => {
    setActionError(null);
    setActingId(row.id);
    try {
      const updated = active
        ? await adminApi.activateUser(row.id)
        : await adminApi.deactivateUser(row.id);
      setData((d) => ({
        ...d,
        rows: d.rows.map((r) => (r.id === row.id ? { ...r, isActive: updated.isActive } : r)),
      }));
    } catch (err) {
      setActionError(apiError(err, 'Could not update this account.'));
    } finally {
      setActingId(null);
      setConfirmTarget(null);
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
    if (row.orgId && can(me, 'organisation:read', 'buyer:approve', 'exporter:verify')) {
      items.push({
        label: 'Review verification',
        Icon: BadgeCheckIcon,
        onSelect: () => navigate('/admin/verification'),
      });
    }
    if (row.orgId && can(me, 'kyc:view')) {
      items.push({
        label: 'View KYC documents',
        Icon: FileIcon,
        onSelect: () => navigate(`/admin/verification/${row.orgId}/kyc`),
      });
    }
    if (isSuperadmin) {
      items.push(
        row.isActive
          ? { label: 'Deactivate', Icon: SlashIcon, danger: true, onSelect: () => setConfirmTarget(row) }
          : { label: 'Activate', Icon: CheckCircleIcon, onSelect: () => setActive(row, true) },
      );
    }
    return items;
  };

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
      filters.role ? `${roleLabel.toLowerCase()}s` : 'accounts',
    ]
      .filter(Boolean)
      .join(' ');
    return filters.q
      ? `Nothing starts with \u201c${filters.q}\u201d among ${scope}. Remember that search matches from the start of a name, email or mobile.`
      : `No ${scope} to show. Try loosening a filter.`;
  };

  return (
    <AdminLayout>
      {/* Design: 32px title, subline, right-aligned account count */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold leading-tight text-ink-900">Users</h1>
          <p className="mt-1 text-[15px] text-muted">
            Every account on the platform — buyers, exporters and staff.
          </p>
        </div>
        <p className="text-sm text-muted">{rowsTotal.toLocaleString(config.locale.numbers)} accounts</p>
      </div>

      {/* Filter card */}
      <div className="mb-5 rounded-xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-6">
          <div className="w-full sm:w-[348px]">
            <label htmlFor="user-q" className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Starts with…
            </label>
            <div className="relative mt-2">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <input
                id="user-q"
                type="search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Name, email or mobile"
                className={inputClasses(false, 'pl-9')}
              />
            </div>
          </div>
          <div className="w-[180px]">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted">Role</span>
            <div className="mt-2">
              <Select aria-label="Filter by role" value={filters.role} onChange={setFilter('role')} options={ROLE_OPTIONS} />
            </div>
          </div>
          <div className="w-[200px]">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted">Verification</span>
            <div className="mt-2">
              <Select
                aria-label="Filter by verification"
                value={filters.kycStatus}
                onChange={setFilter('kycStatus')}
                options={KYC_OPTIONS}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="pb-3 text-sm font-medium text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-ink-400"
          >
            Clear filters
          </button>
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

      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
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
            <div className="overflow-x-auto">
              {/* Design columns: Name · Email · Mobile · Role · Verification ·
                  Active · Joined (+ actions). The design's company sub-line
                  under the name can't render — the list rows carry no company
                  (documented backend projection gap). */}
              <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-ink-50 text-xs uppercase tracking-wider text-muted [&>th]:border-b [&>th]:border-surface-border">
                    {/* NAME is pinned: the design keeps it readable while the
                        rest of the row scrolls horizontally. */}
                    <th className="sticky left-0 z-20 border-r border-surface-border bg-ink-50 px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Email</th>
                    <th className="px-6 py-3 font-semibold">Mobile</th>
                    <th className="px-6 py-3 font-semibold">Role</th>
                    <th className="px-6 py-3 font-semibold">Verification</th>
                    <th className="px-6 py-3 font-semibold">Active</th>
                    <th className="px-6 py-3 font-semibold">Joined</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:not(:first-child)>*]:border-t [&>tr>*]:border-ink-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-ink-50">
                      <td className="sticky left-0 z-10 border-r border-surface-border bg-white px-6 py-4 font-semibold text-ink-900 transition-colors group-hover:bg-ink-50">
                        {row.name}
                      </td>
                      <td className="px-6 py-4 text-muted">{row.email}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-muted">{row.mobile ?? '—'}</td>
                      <td className="px-6 py-4 text-ink-900">{ROLE_LABELS[row.role] ?? row.role}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {row.kycStatus && KYC_STATUS_META[row.kycStatus] ? (
                          <StatusChip status={row.kycStatus} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink-900">{row.isActive ? 'Yes' : 'No'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-muted">{formatDate(row.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <RowMenu
                          label={`Actions for ${row.name}`}
                          items={rowActions(row)}
                        />
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

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.row?.name ?? 'User'}
        subtitle={ROLE_LABELS[detail?.row?.role] ?? detail?.row?.role}
      >
        {detail?.loading && <SkeletonRows rows={3} />}
        {detail?.error && (
          <ErrorState message={detail.error.message} requestId={detail.error.requestId} />
        )}
        {detail?.data && (
          <dl className="space-y-5">
            {[
              ['Email', detail.data.email],
              ['Mobile', detail.data.mobile],
              ['Role', ROLE_LABELS[detail.data.role] ?? detail.data.role],
              ['Company', detail.data.org?.name],
              ['Account', detail.data.isActive ? 'Active' : 'Deactivated'],
              ['Joined', formatDate(detail.data.createdAt)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</dt>
                <dd className="mt-1 text-[15px] text-ink-900">{v || '—'}</dd>
              </div>
            ))}
            {detail.data.org && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Verification
                </dt>
                <dd className="mt-1.5">
                  <StatusChip status={detail.data.org.kycStatus} />
                </dd>
              </div>
            )}
          </dl>
        )}
      </Drawer>

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
