import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { config } from '../../config.js';
import { apiError } from '../../lib/format.js';
import { PERMISSION_LIST, PERMISSION_LABELS } from '../../lib/permissions.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Checkbox } from '../../components/ui/Checkbox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { MobileInput } from '../../components/ui/MobileInput.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { CheckCircleIcon, CopyIcon, InfoIcon, UsersIcon } from '../../components/ui/icons.jsx';

/**
 * Employees (superadmin-only; mockup: admin_employees_edit_permissions_drawer).
 * List = GET /admin/users?role=employee. Create = POST /admin/employees.
 * Edit = PATCH /admin/employees/:id/permissions (REPLACES the whole set).
 *
 * ✅ Permissions ARE readable now (owner-approved 2026-08-04): `GET /admin/users`
 * includes each employee's granted set **for a superadmin only** — the role is
 * re-checked in the controller, not inferred from the route, because `user:read`
 * is a grant an employee can hold. So the table shows the real set and the edit
 * drawer opens PRE-TICKED from it. `knownPerms` only carries a fresher set from
 * a create/edit response that has not been re-fetched yet.
 *
 * The "saving replaces the whole set" warning stays: PATCH is a REPLACE, not a
 * merge, so unticking is how access is removed.
 */
/**
 * 🔴 The whole TEAM (owner, 2026-08-18) — superadmins included, not only
 * employees. A staff directory that omitted the superadmins was the one list
 * where "who can reach this console?" could not be answered, which is the
 * question the screen exists for.
 *
 * A superadmin row is read-only here: its authority comes from the ROLE, there
 * is no permission set to grant or revoke, and `PATCH /admin/employees/:id/
 * permissions` refuses one anyway. Rendering an Edit button on it would be a
 * control that can only ever fail.
 */
const STAFF_ROLES = 'employee,superadmin';

const PERMISSION_COUNT = PERMISSION_LIST.length;

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

function generatePassword() {
  // Temp password the superadmin hands over; the employee must change it at
  // first sign-in (mustChangePassword). Charset avoids ambiguous glyphs.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function PermissionChecklist({ value, onToggle, disabled }) {
  return (
    <div className="space-y-1">
      {PERMISSION_LIST.map((p) => (
        <Checkbox
          key={p.value}
          plain
          label={p.label}
          help={p.help}
          checked={value.includes(p.value)}
          disabled={disabled}
          onChange={(checked) =>
            onToggle(checked ? [...value, p.value] : value.filter((v) => v !== p.value))
          }
        />
      ))}
    </div>
  );
}

const EMPTY_FORM = {
  name: '',
  email: '',
  mobile: { countryCode: '+91', number: '' },
  password: '',
  permissions: [],
};

export function Employees() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.table.pageSizes[0]);

  // `GET /admin/users` now returns each employee's granted set to a superadmin
  // (owner-approved 2026-08-04), so the list IS the source of truth. This map
  // only holds fresher sets from a create/edit response, which have not been
  // re-fetched yet.
  const [knownPerms, setKnownPerms] = useState({});

  /** Freshest known set for a row, or null if the server sent none. */
  const permsFor = (row) => knownPerms[row.id] ?? row.permissions ?? null;

  const [drawer, setDrawer] = useState(null); // {mode:'add'} | {mode:'edit', row}
  const [form, setForm] = useState(EMPTY_FORM);
  const [editPerms, setEditPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState(null);

  const [createdCreds, setCreatedCreds] = useState(null); // {name, email, password}
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [permsView, setPermsView] = useState(null); // {row, perms} for the (i) popup

  // TanStack Query rather than a fetch in an effect (`web-frontend.md`).
  const list = useQuery({
    queryKey: ['admin', 'employees', { page, pageSize }],
    queryFn: () => adminApi.listUsers({ role: STAFF_ROLES, page, pageSize }),
    placeholderData: (prev) => prev,
  });
  const data = list.data ?? null;
  const loading = list.isLoading;
  const error = list.error ? apiError(list.error) : null;
  const load = list.refetch;

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setDrawerError(null);
    setDrawer({ mode: 'add' });
  };

  const openEdit = (row) => {
    // Pre-ticked from the employee's real, current set.
    setEditPerms(permsFor(row) ?? []);
    setDrawerError(null);
    setDrawer({ mode: 'edit', row });
  };

  const setField = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const create = async () => {
    setDrawerError(null);
    if (!form.name.trim() || !form.email.trim() || !form.mobile.number.trim() || form.password.length < 8) {
      setDrawerError({ message: 'Fill in name, email, mobile, and a password of at least 8 characters.' });
      return;
    }
    setSaving(true);
    try {
      const created = await adminApi.createEmployee({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: { countryCode: form.mobile.countryCode, number: form.mobile.number.replace(/[\s-]/g, '') },
        password: form.password,
        permissions: form.permissions,
      });
      setKnownPerms((k) => ({ ...k, [created.id]: created.permissions ?? [] }));
      setDrawer(null);
      setCreatedCreds({ name: created.name, email: created.email, password: form.password });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setDrawerError(apiError(err, 'Could not create the employee.'));
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async () => {
    setDrawerError(null);
    setSaving(true);
    try {
      const updated = await adminApi.setEmployeePermissions(drawer.row.id, editPerms);
      setKnownPerms((k) => ({ ...k, [updated.id]: updated.permissions ?? [] }));
      setDrawer(null);
      setToast('Permissions saved — effective immediately, no re-sign-in needed.');
    } catch (err) {
      setDrawerError(apiError(err, 'Could not save permissions.'));
    } finally {
      setSaving(false);
    }
  };

  const copyCreds = async () => {
    try {
      await navigator.clipboard.writeText(
        `MPX Global admin console — ${createdCreds.email}\nTemporary password: ${createdCreds.password}\nSign in at /signin/staff — you'll be asked to set your own password.`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const rows = data?.rows ?? [];

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold leading-tight text-ink-900">Staff</h1>
            {data && (
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                {(data.total ?? rows.length).toLocaleString()} staff
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Everyone who can reach this console. Employees hold granted permissions; super
            admins have full access by role.
          </p>
        </div>
        <Button onClick={openAdd}>
          <span aria-hidden="true" className="text-lg leading-none">+</span> Add employee
        </Button>
      </div>

      {toast && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="success">{toast}</Alert>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {loading && <SkeletonRows rows={6} />}

        {!loading && error && (
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        )}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={UsersIcon}
            title="No staff accounts yet"
            action={
              <Button size="sm" onClick={openAdd}>
                Add employee
              </Button>
            }
          >
            Create staff accounts here and grant each one only the permissions it needs.
          </EmptyState>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {/* Phones get CARDS, not a sideways-scrolling table. */}
            <ul className="divide-y divide-surface-border md:hidden">
              {rows.map((row) => {
                const perms = permsFor(row);
                return (
                  <li key={row.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          row.isActive ? 'bg-primary-50 text-primary-700' : 'bg-ink-100 text-ink-500'
                        }`}
                      >
                        {initials(row.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink-900">{row.name}</p>
                        <p className="truncate text-xs text-muted">{row.email}</p>
                        {row.mobile && <p className="truncate text-xs text-muted">{row.mobile}</p>}
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {row.role === 'superadmin' ? (
                        <span className="whitespace-nowrap rounded-md bg-primary-600 px-2 py-1 text-xs font-semibold text-white">
                          Full access
                        </span>
                      ) : !perms ? (
                        <span className="text-xs text-muted">—</span>
                      ) : perms.length === 0 ? (
                        <span className="text-xs text-muted">No access yet</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="whitespace-nowrap rounded-md bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                            {perms.length === 1
                              ? (PERMISSION_LABELS[perms[0]] ?? perms[0])
                              : `${perms.length} permissions`}
                          </span>
                          {perms.length > 1 && (
                            <button
                              type="button"
                              aria-label={`See all ${perms.length} permissions for ${row.name}`}
                              onClick={() => setPermsView({ row, perms })}
                              className="rounded-full p-1 text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                            >
                              <InfoIcon className="h-4 w-4" />
                            </button>
                          )}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-success-500' : 'bg-ink-300'}`}
                        />
                        <span className={row.isActive ? 'text-ink-800' : 'text-muted'}>
                          {row.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </span>
                      <span className="ml-auto">
                        {row.role === 'superadmin' ? (
                          <span className="text-xs text-muted">Role-based — nothing to grant</span>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
                            Edit permissions
                          </Button>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              {/* M2 redesign (2026-08-11): email stacks under the name beside a
                  monogram avatar — one identity cell, less horizontal scroll. */}
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="bg-ink-50 border-b border-surface-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Mobile</th>
                    <th className="px-5 py-3 font-semibold">Permissions</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((row) => {
                    const perms = permsFor(row);
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-surface-subtle/50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                row.isActive ? 'bg-primary-50 text-primary-700' : 'bg-ink-100 text-ink-500'
                              }`}
                            >
                              {initials(row.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink-900">{row.name}</p>
                              <p className="truncate text-xs text-muted">{row.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted">{row.mobile ?? '—'}</td>
                        {/* One grant reads fine as a chip; several would wrap
                            the row, so they collapse to a count with an (i)
                            that opens the full list. */}
                        <td className="whitespace-nowrap px-5 py-3.5">
                          {row.role === 'superadmin' ? (
                            <span className="inline-block whitespace-nowrap rounded-md bg-primary-600 px-2 py-1 text-xs font-semibold text-white">
                              Full access
                            </span>
                          ) : !perms ? (
                            <span className="text-muted" title="Not returned for this account">
                              —
                            </span>
                          ) : perms.length === 0 ? (
                            <span className="text-muted">No access yet</span>
                          ) : perms.length === 1 ? (
                            <span className="inline-block whitespace-nowrap rounded-md bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                              {PERMISSION_LABELS[perms[0]] ?? perms[0]}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="whitespace-nowrap rounded-md bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                                {perms.length} permissions
                              </span>
                              <button
                                type="button"
                                aria-label={`See all ${perms.length} permissions for ${row.name}`}
                                title="See all permissions"
                                onClick={() => setPermsView({ row, perms })}
                                className="rounded-full p-1 text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                              >
                                <InfoIcon className="h-4 w-4" />
                              </button>
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                            <span
                              aria-hidden="true"
                              className={`h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-success-500' : 'bg-ink-300'}`}
                            />
                            <span className={row.isActive ? 'text-ink-800' : 'text-muted'}>
                              {row.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {row.role === 'superadmin' ? (
                            <span className="whitespace-nowrap text-xs text-muted">
                              Role-based — nothing to grant
                            </span>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="whitespace-nowrap"
                              onClick={() => openEdit(row)}
                            >
                              Edit permissions
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Design shows a plain count; the pager only earns its place
                once the staff list outgrows one page. */}
            {data.total > pageSize ? (
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
            ) : (
              <p className="border-t border-surface-border px-6 py-3 text-sm text-muted">
                Showing {data.total} employee{data.total === 1 ? '' : 's'}
              </p>
            )}
          </>
        )}
      </div>

      {/* Add drawer */}
      {/* Full list behind the (i) — label AND what each grant actually allows */}
      <Modal
        open={Boolean(permsView)}
        onClose={() => setPermsView(null)}
        title={`${permsView?.row?.name ?? 'Employee'} · permissions`}
        footer={
          <Button variant="secondary" onClick={() => setPermsView(null)}>
            Close
          </Button>
        }
      >
        <p className="text-sm text-muted">
          {permsView?.perms?.length} of {PERMISSION_COUNT} granted.
        </p>
        <ul className="mt-4 space-y-3">
          {permsView?.perms?.map((pm) => {
            const meta = PERMISSION_LIST.find((x) => x.value === pm);
            return (
              <li key={pm} className="flex items-start gap-3">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>
                  <span className="block text-[15px] font-semibold text-ink-900">
                    {meta?.label ?? pm}
                  </span>
                  {meta?.help && <span className="block text-[13px] text-muted">{meta.help}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Drawer
        open={drawer?.mode === 'add'}
        onClose={() => !saving && setDrawer(null)}
        title="Add employee"
        subtitle="They sign in at the staff portal and must set their own password first."
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={create}>
              Create employee
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {drawerError && (
            <Alert tone="danger">
              {drawerError.message}
              {drawerError.requestId && (
                <span className="ml-2 font-mono text-xs opacity-70">{drawerError.requestId}</span>
              )}
            </Alert>
          )}
          <Input label="Full name" placeholder="e.g. John Doe" value={form.name} onChange={setField('name')} disabled={saving} />
          <Input
            label="Email"
            type="email"
            placeholder="e.g. john@mpxglobal.com"
            value={form.email}
            onChange={setField('email')}
            disabled={saving}
            helper="Staff emails are exclusive — they can't also hold a buyer or exporter account."
          />
          <MobileInput value={form.mobile} onChange={setField('mobile')} disabled={saving} />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
          <Input
            label="Temporary password"
            value={form.password}
            onChange={setField('password')}
            disabled={saving}
            helper="At least 8 characters. They'll be asked to change it at first sign-in."
          />
            </div>
            <Button
              variant="secondary"
              className="mt-[26px] shrink-0"
              disabled={saving}
              onClick={() => setField('password')(generatePassword())}
            >
              Generate
            </Button>
          </div>
          <div>
            <p className="text-sm font-medium text-ink-800">
              Permissions ({form.permissions.length}/{PERMISSION_COUNT})
            </p>
            <p className="mb-3 mt-0.5 text-xs text-muted">Grant now or later.</p>
            <PermissionChecklist
              value={form.permissions}
              onToggle={(v) => setForm((f) => ({ ...f, permissions: v }))}
              disabled={saving}
            />
          </div>
        </div>
      </Drawer>

      {/* Edit-permissions drawer — opens pre-ticked from the employee's live set */}
      <Drawer
        open={drawer?.mode === 'edit'}
        onClose={() => !saving && setDrawer(null)}
        title={`Permissions — ${drawer?.row?.name ?? ''}`}
        subtitle="Effective immediately after saving; no re-sign-in needed."
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={savePermissions}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {drawerError && (
            <Alert tone="danger">
              {drawerError.message}
              {drawerError.requestId && (
                <span className="ml-2 font-mono text-xs opacity-70">{drawerError.requestId}</span>
              )}
            </Alert>
          )}
          {/* Ticked from the live set, but saving still REPLACES it — an
              untick is a revoke, so say so rather than implying a merge. */}
          <Alert tone="info">
            Ticking grants access, unticking removes it. <strong>Saving replaces the whole
            set</strong> — untick everything for no access at all.
          </Alert>
          <PermissionChecklist value={editPerms} onToggle={setEditPerms} disabled={saving} />
        </div>
      </Drawer>

      {/* Created-once credentials modal */}
      <Modal
        open={Boolean(createdCreds)}
        onClose={() => {
          setCreatedCreds(null);
          setCopied(false);
        }}
        title="Employee created"
        footer={
          <Button
            onClick={() => {
              setCreatedCreds(null);
              setCopied(false);
            }}
          >
            Done
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Hand these over securely. <strong>This is the only time the password is shown</strong> —
          it isn&apos;t stored anywhere you can read it again. They&apos;ll be asked to set their
          own at first sign-in.
        </p>
        <dl className="mt-4 space-y-2 rounded-lg bg-ink-50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="font-medium text-ink-900">{createdCreds?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Temporary password</dt>
            <dd className="font-mono font-medium text-ink-900">{createdCreds?.password}</dd>
          </div>
        </dl>
        <Button variant="secondary" size="sm" className="mt-3" onClick={copyCreds}>
          <CopyIcon className="h-4 w-4" /> {copied ? 'Copied' : 'Copy details'}
        </Button>
      </Modal>
    </AdminLayout>
  );
}
