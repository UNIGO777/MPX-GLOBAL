import { useCallback, useEffect, useState } from 'react';

import { adminApi } from '../../api/admin.js';
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
import { SearchIcon, UsersIcon } from '../../components/ui/icons.jsx';

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
  { value: '', label: 'All verification states' },
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
  const { user: me } = useAuth();
  const isSuperadmin = me?.role === 'superadmin';

  const [filters, setFilters] = useState({ role: '', kycStatus: '', q: '' });
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [confirmTarget, setConfirmTarget] = useState(null); // user row awaiting deactivate confirm
  const [actionError, setActionError] = useState(null);
  const [actingId, setActingId] = useState(null);

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

  const activeFilterNames = [
    filters.role && `Role: ${ROLE_OPTIONS.find((o) => o.value === filters.role)?.label}`,
    filters.kycStatus && `Verification: ${KYC_OPTIONS.find((o) => o.value === filters.kycStatus)?.label}`,
    filters.q && `Starts with "${filters.q}"`,
  ].filter(Boolean);

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

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Users</h1>
          <p className="mt-1 text-sm text-muted">
            Every account on the platform — buyers, exporters and staff.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Starts with… name, email or mobile"
            aria-label="Search users (prefix match)"
            className={inputClasses(false, 'pl-9')}
          />
        </div>
        <Select aria-label="Filter by role" value={filters.role} onChange={setFilter('role')} options={ROLE_OPTIONS} />
        <Select
          aria-label="Filter by verification"
          value={filters.kycStatus}
          onChange={setFilter('kycStatus')}
          options={KYC_OPTIONS}
        />
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

      <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
        {loading && <SkeletonRows rows={8} />}

        {!loading && error && (
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        )}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={UsersIcon}
            title="No users match"
            action={
              activeFilterNames.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilters({ role: '', kycStatus: '', q: '' });
                    setQInput('');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          >
            {activeFilterNames.length > 0
              ? `Nothing matches ${activeFilterNames.join(' · ')}. Try loosening a filter.`
              : 'No users exist yet.'}
          </EmptyState>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              {/* Mockup columns: Name · Email · Mobile · Role · Verification ·
                  Active (Yes/No) · Joined (+ actions). The mockup's company
                  sub-line under the name can't render — the list rows carry no
                  company (documented backend projection gap). */}
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Email</th>
                    <th className="px-6 py-3 font-semibold">Mobile</th>
                    <th className="px-6 py-3 font-semibold">Role</th>
                    <th className="px-6 py-3 font-semibold">Verification</th>
                    <th className="px-6 py-3 font-semibold">Active</th>
                    <th className="px-6 py-3 font-semibold">Joined</th>
                    {isSuperadmin && <th className="px-6 py-3 text-right font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-ink-50">
                      <td className="px-6 py-4 font-semibold text-ink-900">{row.name}</td>
                      <td className="px-6 py-4 text-muted">{row.email}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-muted">{row.mobile ?? '—'}</td>
                      <td className="px-6 py-4 text-ink-900">{ROLE_LABELS[row.role] ?? row.role}</td>
                      <td className="px-6 py-4">
                        {row.kycStatus && KYC_STATUS_META[row.kycStatus] ? (
                          <StatusChip status={row.kycStatus} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink-900">{row.isActive ? 'Yes' : 'No'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-muted">{formatDate(row.createdAt)}</td>
                      {isSuperadmin && (
                        <td className="px-6 py-4 text-right">
                          {row.isActive ? (
                            <Button
                              variant="dangerOutline"
                              size="sm"
                              loading={actingId === row.id}
                              onClick={() => setConfirmTarget(row)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={actingId === row.id}
                              onClick={() => setActive(row, true)}
                            >
                              Activate
                            </Button>
                          )}
                        </td>
                      )}
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

      <Modal
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        title="Deactivate this account?"
        danger
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
        <p className="text-sm text-muted">
          <span className="font-medium text-ink-900">{confirmTarget?.name}</span> (
          {confirmTarget?.email}) will be signed out everywhere and unable to sign in until
          reactivated. Their data is kept.
        </p>
      </Modal>
    </AdminLayout>
  );
}
