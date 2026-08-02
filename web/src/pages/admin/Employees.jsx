import { useCallback, useEffect, useState } from 'react';

import { adminApi } from '../../api/admin.js';
import { apiError, formatDate } from '../../lib/format.js';
import { PERMISSION_GROUPS, PERMISSION_LABELS } from '../../lib/permissions.js';
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
import { CopyIcon, RefreshIcon, UsersIcon } from '../../components/ui/icons.jsx';

/**
 * Employees (superadmin-only; mockup: admin_employees_edit_permissions_drawer).
 * List = GET /admin/users?role=employee. Create = POST /admin/employees.
 * Edit = PATCH /admin/employees/:id/permissions (REPLACES the whole set).
 *
 * 🔴 Honest degradation (owner decision, plan §7.2): NO endpoint returns an
 * employee's CURRENT permissions after a reload. So: the table's permission
 * column shows the set only when a create/edit response taught us it THIS
 * session, else "—"; the edit drawer opens UNTICKED with a visible warning
 * that saving replaces the whole set. The read endpoint is logged in
 * UiWebNotes as a recommended backend follow-up — NOT built unilaterally.
 */
const PERMISSION_COUNT = PERMISSION_GROUPS.reduce((n, g) => n + g.items.length, 0);

function generatePassword() {
  // Temp password the superadmin hands over; the employee must change it at
  // first sign-in (mustChangePassword). Charset avoids ambiguous glyphs.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function PermissionChecklist({ value, onToggle, disabled }) {
  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((g) => (
        <fieldset key={g.group}>
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
            {g.group}
          </legend>
          <div className="mt-2 space-y-2">
            {g.items.map((p) => (
              <Checkbox
                key={p.value}
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
        </fieldset>
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
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Permission sets learned from create/edit responses THIS session only.
  const [knownPerms, setKnownPerms] = useState({});

  const [drawer, setDrawer] = useState(null); // {mode:'add'} | {mode:'edit', row}
  const [form, setForm] = useState(EMPTY_FORM);
  const [editPerms, setEditPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState(null);

  const [createdCreds, setCreatedCreds] = useState(null); // {name, email, password}
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminApi.listUsers({ role: 'employee', page, pageSize }));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

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
    // Honest degradation: no read endpoint for current permissions — start
    // from what this session learned, else empty, with the warning visible.
    setEditPerms(knownPerms[row.id] ?? []);
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Employees</h1>
          <p className="mt-1 text-sm text-muted">
            Staff accounts and their granted permissions. Least privilege: grant only what each
            person needs.
          </p>
        </div>
        <Button onClick={openAdd}>Add employee</Button>
      </div>

      {toast && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="success">{toast}</Alert>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
        {loading && <SkeletonRows rows={6} />}

        {!loading && error && (
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        )}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={UsersIcon}
            title="No employees yet"
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
            <div className="overflow-x-auto">
              {/* Mockup columns: Name · Email · Mobile · Permissions · Active. */}
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Email</th>
                    <th className="px-6 py-3 font-semibold">Mobile</th>
                    <th className="px-6 py-3 font-semibold">Permissions</th>
                    <th className="px-6 py-3 font-semibold">Active</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((row) => {
                    const perms = knownPerms[row.id];
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-ink-50">
                        <td className="px-6 py-4 font-semibold text-ink-900">{row.name}</td>
                        <td className="px-6 py-4 text-muted">{row.email}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-muted">{row.mobile ?? '—'}</td>
                        <td className="max-w-xs px-6 py-4">
                          {perms ? (
                            perms.length === 0 ? (
                              <span className="text-muted">None granted</span>
                            ) : (
                              <span className="text-xs text-ink-800">
                                {perms.map((p) => PERMISSION_LABELS[p] ?? p).join(' · ')}
                              </span>
                            )
                          ) : (
                            <span className="text-muted" title="Not known to this session — the server has no permissions-read endpoint yet">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-ink-900">{row.isActive ? 'Yes' : 'No'}</td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
                            Edit permissions
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Add drawer */}
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
          <Input label="Full name" value={form.name} onChange={setField('name')} disabled={saving} />
          <Input
            label="Work email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            disabled={saving}
            helper="Staff emails are exclusive — they can't also hold a buyer or exporter account."
          />
          <MobileInput value={form.mobile} onChange={setField('mobile')} disabled={saving} />
          <Input
            label="Temporary password"
            value={form.password}
            onChange={setField('password')}
            disabled={saving}
            helper="At least 8 characters. They must change it at first sign-in."
            trailing={
              <button
                type="button"
                onClick={() => setField('password')(generatePassword())}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                <RefreshIcon className="h-3.5 w-3.5" /> Generate
              </button>
            }
          />
          <div>
            <p className="text-sm font-medium text-ink-800">
              Permissions ({form.permissions.length}/{PERMISSION_COUNT})
            </p>
            <p className="mb-3 mt-0.5 text-xs text-muted">
              Least privilege — grant only what this person needs. You can change this any time.
            </p>
            <PermissionChecklist
              value={form.permissions}
              onToggle={(v) => setForm((f) => ({ ...f, permissions: v }))}
              disabled={saving}
            />
          </div>
        </div>
      </Drawer>

      {/* Edit-permissions drawer — opens UNTICKED (honest degradation) */}
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
          {!knownPerms[drawer?.row?.id] && (
            <Alert tone="warning">
              The current permission set can&apos;t be shown — the server has no way to read it back
              yet. <strong>Saving replaces the whole set</strong> with exactly what you tick below,
              so tick everything this employee should keep.
            </Alert>
          )}
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
