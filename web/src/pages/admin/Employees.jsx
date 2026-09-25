import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { config } from '../../config.js';
import { apiError, formatMobile } from '../../lib/format.js';
import { PERMISSION_GROUPS, PERMISSION_LIST, PERMISSION_REQUIRES, withDependencies } from '../../lib/permissions.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Checkbox, CheckboxBox } from '../../components/ui/Checkbox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { MobileInput } from '../../components/ui/MobileInput.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { CheckCircleIcon, CopyIcon, KeyIcon, PlusIcon, UserIcon, UsersIcon } from '../../components/ui/icons.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import { monogramTone } from '../../components/chat/CompanyAvatar.jsx';

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
const KNOWN = new Set(PERMISSION_LIST.map((p) => p.value));

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

/**
 * "Select all" for one permission area — ticks or clears every permission in
 * it. Partly ticked shows as indeterminate, so the header never claims the
 * whole area when only some of it is granted.
 *
 * Still least-privilege by construction: it only saves clicks on a choice the
 * admin makes explicitly, per area; nothing is granted they did not tick.
 */
function SelectAll({ group, keys, held, value, onToggle, disabled }) {
  const all = held === keys.length;
  return (
    <label
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        all
          ? 'border-primary-600 bg-white text-primary-700'
          : 'border-surface-border bg-white text-ink-700 hover:border-ink-400'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <CheckboxBox
        checked={all}
        indeterminate={held > 0 && !all}
        disabled={disabled}
        aria-label={`Select all ${group} permissions`}
        onChange={(checked) =>
          onToggle(
            checked
              ? [...value, ...keys.filter((k) => !value.includes(k))]
              : value.filter((v) => !keys.includes(v)),
          )
        }
      />
      Select all
    </label>
  );
}

function PermissionChecklist({ value, onToggle: setValue, disabled }) {
  // Every change keeps action grants and their read grant together.
  const onToggle = (next) => setValue(withDependencies(value, next));
  // §10 — grouped by area, matching the server catalogue: 14 flat checkboxes
  // stopped being scannable when the set grew from 3. Each area is a card with
  // its own "Select all".
  return (
    <div className="space-y-3">
      {PERMISSION_GROUPS.map((g) => {
        const keys = g.items.map((p) => p.value);
        const held = keys.filter((k) => value.includes(k)).length;
        const all = held === keys.length;
        return (
          <fieldset
            key={g.group}
            className={`overflow-hidden rounded-xl border transition-colors ${
              all ? 'border-primary-200' : 'border-surface-border'
            }`}
          >
            <legend className="sr-only">{g.group}</legend>
            <div
              className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 ${
                all ? 'border-primary-200 bg-primary-50' : 'border-surface-border bg-ink-50'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">{g.group}</p>
                <p className="text-xs text-muted">
                  {held === 0 ? 'None granted' : `${held} of ${keys.length} granted`}
                </p>
              </div>
              <SelectAll
                group={g.group}
                keys={keys}
                held={held}
                value={value}
                onToggle={onToggle}
                disabled={disabled}
              />
            </div>
            <div className="divide-y divide-surface-border px-4">
              {g.items.map((p) => (
                <Checkbox
                  key={p.value}
                  plain
                  label={p.label}
                  help={PERMISSION_REQUIRES[p.value] ? `${p.help} · includes viewing` : p.help}
                  checked={value.includes(p.value)}
                  disabled={disabled}
                  onChange={(checked) =>
                    onToggle(checked ? [...value, p.value] : value.filter((v) => v !== p.value))
                  }
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/**
 * What an employee can reach, as AREA chips (2026-09-24) — "7 permissions" said
 * how many, never what. Up to two areas by name, the rest as "+N".
 */
function AccessSummary({ row, perms, onOpen }) {
  if (row.role === 'superadmin') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-600 px-2.5 py-0.5 text-[12px] font-semibold text-white">
        <KeyIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Full access
      </span>
    );
  }
  if (!perms) return <span className="text-[13px] text-muted" title="Not returned for this account">—</span>;
  if (perms.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-[12px] font-semibold text-ink-600">
        No access yet
      </span>
    );
  }
  const areas = PERMISSION_GROUPS.filter((g) => g.items.some((i) => perms.includes(i.value))).map((g) => g.group);
  const shown = areas.slice(0, 2);
  const more = areas.length - shown.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See all ${perms.length} permissions for ${row.name}`}
      title={`${perms.length} of ${PERMISSION_COUNT} permissions — click for the list`}
      className="group flex max-w-full flex-wrap items-center gap-1.5 text-left"
    >
      {shown.map((a) => (
        <span
          key={a}
          className="whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-0.5 text-[12px] font-semibold text-primary-700 group-hover:bg-primary-100"
        >
          {a}
        </span>
      ))}
      {more > 0 && (
        <span className="whitespace-nowrap rounded-full bg-ink-100 px-2 py-0.5 text-[12px] font-semibold text-ink-600 group-hover:bg-ink-200">
          +{more}
        </span>
      )}
      <span className="whitespace-nowrap text-[11.5px] text-muted group-hover:text-primary-700">
        {perms.length}/{PERMISSION_COUNT}
      </span>
    </button>
  );
}

function PersonMark({ row }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ring-1 ring-inset ${
        row.isActive ? monogramTone(row.name) : 'bg-ink-100 text-ink-400 ring-ink-200'
      }`}
    >
      {initials(row.name)}
    </span>
  );
}

function StatusChip({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-0.5 text-[12px] font-semibold text-success-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-100 px-2.5 py-0.5 text-[12px] font-semibold text-ink-600">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-400" />
      Deactivated
    </span>
  );
}

/**
 * The powers that are NEVER grantable (owner, 2026-09-24: "make sure all kinds
 * of permissions are listed"). They are hard `requireRole('superadmin')` gates
 * on the server — listed here so the full picture of access is on one screen,
 * never as checkboxes.
 */
const SUPERADMIN_ONLY = [
  'Create staff and assign permissions',
  'Activate / deactivate user accounts',
  'Block / unblock a company',
  'Platform settings',
];

function SuperadminOnlyNote() {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-800">
        <KeyIcon className="h-4 w-4 text-ink-500" aria-hidden="true" />
        Super admin only — never grantable
      </p>
      <ul className="mt-2 grid gap-x-4 gap-y-1 text-[12.5px] text-ink-600 sm:grid-cols-2">
        {SUPERADMIN_ONLY.map((x) => (
          <li key={x} className="flex items-start gap-1.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Name with a role badge — "Super admin" is the one role that changes what
 *  the row means, so it is named rather than implied by a chip colour. */
function PersonName({ row }) {
  return (
    <p className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold text-ink-900">{row.name}</span>
      {row.role === 'superadmin' && (
        <span className="shrink-0 rounded-full bg-ink-900 px-2 py-px text-[10.5px] font-bold uppercase tracking-wide text-white">
          Super admin
        </span>
      )}
    </p>
  );
}

/** A superadmin row has nothing to grant (the server refuses a set anyway),
 *  so it gets a quiet note, never a button that can only fail. */
function RowAction({ row, onEdit }) {
  if (row.role === 'superadmin') {
    return <span className="whitespace-nowrap text-[12px] text-muted">By role</span>;
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Manage access for ${row.name}`}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-200 bg-white px-2.5 text-[12.5px] font-semibold text-ink-800 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 sm:px-3"
    >
      <KeyIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {/* Icon-only on phones — the label squeezed the email to a few letters. */}
      <span className="hidden sm:inline">Manage access</span>
    </button>
  );
}

const ROLE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'employee', label: 'Employees' },
  { value: 'superadmin', label: 'Super admins' },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  mobile: { countryCode: '+91', number: '' },
  password: '',
  permissions: [],
};

/**
 * Copy text, working on plain-http origins too. `navigator.clipboard` exists
 * only in a SECURE context (https or localhost); on an http staging address it
 * is undefined, and the copy used to fail silently. The hidden-textarea route
 * is the fallback. Returns whether anything was copied.
 */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Refused (permission, focus, policy) — handled, not swallowed: the
      // legacy route below is the retry, and its result is what we report.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(area);
  }
}

export function Employees() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.table.pageSizes[0]);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');

  // Search as you type (same pause as the other admin lists). The server's
  // `q` is a prefix match on name, email or mobile.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(draft.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Staff — MPX Global';
    return () => { document.title = previous; };
  }, []);

  // `GET /admin/users` now returns each employee's granted set to a superadmin
  // (owner-approved 2026-08-04), so the list IS the source of truth. This map
  // only holds fresher sets from a create/edit response, which have not been
  // re-fetched yet.
  const [knownPerms, setKnownPerms] = useState({});

  /** Freshest known set for a row, or null if the server sent none. */
  // Only strings the catalogue still knows — a retired grant (e.g. the old
  // `support:manage`, split 2026-09-24) would otherwise ride back on save and
  // be refused by the server.
  const permsFor = (row) => {
    const raw = knownPerms[row.id] ?? row.permissions ?? null;
    return raw ? raw.filter((p) => KNOWN.has(p)) : raw;
  };

  const [drawer, setDrawer] = useState(null); // {mode:'add'} | {mode:'edit', row}
  const [form, setForm] = useState(EMPTY_FORM);
  const [editPerms, setEditPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState(null);

  const [createdCreds, setCreatedCreds] = useState(null); // {name, email, password}
  // 'idle' | 'done' | 'failed' — a failed copy must SAY so; a silent failure
  // leaves the admin pasting whatever was on the clipboard before.
  const [copied, setCopied] = useState('idle');
  const [toast, setToast] = useState(null);
  const [permsView, setPermsView] = useState(null); // {row, perms} for the (i) popup

  // TanStack Query rather than a fetch in an effect (`web-frontend.md`).
  const list = useQuery({
    queryKey: ['admin', 'employees', { page, pageSize, q, role }],
    queryFn: () => adminApi.listUsers({ role: role || STAFF_ROLES, page, pageSize, ...(q ? { q } : {}) }),
    placeholderData: (prev) => prev,
  });
  const data = list.data ?? null;
  const loading = list.isLoading;
  const error = list.error ? apiError(list.error) : null;
  const load = list.refetch;

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
    // Labelled lines and a FULL sign-in URL: this is pasted into WhatsApp or an
    // email, where a bare "/signin/staff" is not a link anyone can open.
    const text = [
      `MPX Global — staff account for ${createdCreds.name}`,
      '',
      `Sign in: ${window.location.origin}/signin/staff`,
      `Email: ${createdCreds.email}`,
      `Temporary password: ${createdCreds.password}`,
      '',
      "You'll be asked to set your own password the first time you sign in.",
    ].join('\n');
    setCopied((await copyText(text)) ? 'done' : 'failed');
  };

  const rows = data?.rows ?? [];

  return (
    <AdminLayout>
      <header className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Staff</h1>
            {data && (
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                {(data.total ?? rows.length).toLocaleString()} staff
              </span>
            )}
          </div>
          <p className="mt-1 hidden text-sm text-muted sm:block">
            Everyone who can reach this console, and what each person can do.
          </p>
        </div>
        {/* Same compact solid button as "New category" — the tall shadowed one
            outweighed the whole header. */}
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add employee</span>
        </button>
      </header>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-md lg:flex-1">
          <ToolbarSearch
            id="staff-search"
            label="Search staff — starts with name, email or mobile"
            value={draft}
            onChange={setDraft}
            onSubmit={() => { setQ(draft.trim()); setPage(1); }}
            onClear={() => setDraft('')}
            placeholder="Name, email or mobile starts with…"
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterChip
            label="Role"
            value={role}
            options={ROLE_OPTIONS}
            onChange={(v) => { setRole(v); setPage(1); }}
          />
          {(q || role) && (
            <button
              type="button"
              onClick={() => { setDraft(''); setQ(''); setRole(''); setPage(1); }}
              className="ml-1 shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {toast && (
        <FlashMessage className="mb-4 max-w-3xl" onDismiss={() => setToast(null)}>
          {toast}
        </FlashMessage>
      )}

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {loading && <SkeletonRows rows={6} />}

        {!loading && error && (
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        )}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={UsersIcon}
            title={q || role ? 'No staff match' : 'No staff accounts yet'}
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
            {/* Cards below xl (the sidebar takes 260px from lg, so the table
                only fits at xl). One person per card. */}
            <ul className="divide-y divide-surface-border xl:hidden">
              {rows.map((row) => {
                const perms = permsFor(row);
                return (
                  <li key={row.id} className={`p-4 sm:px-5 ${row.isActive ? '' : 'bg-ink-50/50'}`}>
                    <div className="flex items-start gap-3">
                      <PersonMark row={row} />
                      <div className="min-w-0 flex-1">
                        <PersonName row={row} />
                        <p className="truncate text-xs text-muted">
                          {[row.email, formatMobile(row.mobile)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <RowAction row={row} onEdit={() => openEdit(row)} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-[3.25rem]">
                      <AccessSummary row={row} perms={perms} onOpen={() => setPermsView({ row, perms })} />
                      <StatusChip active={row.isActive} />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden xl:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[20rem]" />
                  <col className="w-[8.5rem]" />
                  <col className="w-[10.5rem]" />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Person</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Access</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((row) => {
                    const perms = permsFor(row);
                    return (
                      <tr key={row.id} className={`transition-colors hover:bg-ink-50/70 ${row.isActive ? '' : 'bg-ink-50/50'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <PersonMark row={row} />
                            <div className="min-w-0">
                              <PersonName row={row} />
                              <p className="truncate text-xs text-muted">
                                {[row.email, formatMobile(row.mobile)].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <AccessSummary row={row} perms={perms} onOpen={() => setPermsView({ row, perms })} />
                        </td>
                        <td className="px-4 py-3"><StatusChip active={row.isActive} /></td>
                        <td className="px-5 py-3 text-right">
                          <RowAction row={row} onEdit={() => openEdit(row)} />
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
        subtitle="Create their staff sign-in and choose what they can access."
        icon={UserIcon}
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
          {/* "Who they are" — mirrors the Permissions section's heading below, so
              the panel reads as two clear sections instead of one long form. */}
          <section>
            <div className="mb-4">
              <h3 className="text-base font-bold text-ink-900">Account details</h3>
              <p className="mt-0.5 text-xs text-muted">
                Their staff sign-in. The email can&apos;t also hold a buyer or exporter account.
              </p>
            </div>
            <div className="space-y-4">
              <Input
                label="Full name"
                placeholder="e.g. John Doe"
                value={form.name}
                onChange={setField('name')}
                disabled={saving}
              />
              <Input
                label="Work email"
                type="email"
                placeholder="e.g. john@mpxglobal.com"
                value={form.email}
                onChange={setField('email')}
                disabled={saving}
              />
              <MobileInput value={form.mobile} onChange={setField('mobile')} disabled={saving} />
              {/* The generate action sits on the label row, not as a tall pill
                  beside the field that never lined up with the input. */}
              <div className="relative">
                <Input
                  label="Temporary password"
                  value={form.password}
                  onChange={setField('password')}
                  disabled={saving}
                  helper="At least 8 characters. They'll set their own at first sign-in."
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setField('password')(generatePassword())}
                  className="absolute right-0 top-0 text-xs font-semibold text-primary-700 hover:underline disabled:opacity-50"
                >
                  Generate strong password
                </button>
              </div>
            </div>
          </section>

          {/* Its own section: a divider and a real heading split "who they are"
              (the fields above) from "what they can do". */}
          <section className="border-t border-surface-border pt-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink-900">Permissions</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Grant only what this person needs — you can change it later.
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  form.permissions.length > 0 ? 'bg-primary-50 text-primary-700' : 'bg-ink-100 text-ink-600'
                }`}
              >
                {form.permissions.length} of {PERMISSION_COUNT} granted
              </span>
            </div>
            <PermissionChecklist
              value={form.permissions}
              onToggle={(v) => setForm((f) => ({ ...f, permissions: v }))}
              disabled={saving}
            />
            <div className="mt-3">
              <SuperadminOnlyNote />
            </div>
          </section>
        </div>
      </Drawer>

      {/* Edit-permissions drawer — opens pre-ticked from the employee's live set */}
      <Drawer
        open={drawer?.mode === 'edit'}
        onClose={() => !saving && setDrawer(null)}
        title={`Permissions — ${drawer?.row?.name ?? ''}`}
        subtitle={`${editPerms.length} of ${PERMISSION_COUNT} granted · effective immediately, no re-sign-in`}
        icon={KeyIcon}
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
          <SuperadminOnlyNote />
        </div>
      </Drawer>

      {/* Created-once credentials modal */}
      <Modal
        open={Boolean(createdCreds)}
        onClose={() => {
          setCreatedCreds(null);
          setCopied('idle');
        }}
        title="Employee created"
        footer={
          <Button
            onClick={() => {
              setCreatedCreds(null);
              setCopied('idle');
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
          <CopyIcon className="h-4 w-4" /> {copied === 'done' ? 'Copied' : 'Copy details'}
        </Button>
        {copied === 'failed' && (
          <Alert tone="warning" className="mt-3">
            Your browser blocked copying. Select the email and password above and copy them by hand.
          </Alert>
        )}
      </Modal>
    </AdminLayout>
  );
}
