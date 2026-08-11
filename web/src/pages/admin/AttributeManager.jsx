import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { CheckIcon, ChevronRightIcon, ListIcon, TrashIcon } from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';

/**
 * M2 web screen 9 — the per-sub-category field designer
 * (`/admin/categories/:id/attributes`).
 *
 * 🔴 `key` AND `inputType` ARE IMMUTABLE AFTER CREATE. Products store
 * `{ key, value }` SNAPSHOTS, so renaming a key orphans every stored value and
 * flipping a type corrupts them. The server does not even accept those fields on
 * PATCH — this screen shows them read-only, each with the reason.
 *
 * 🔴 THE TEACHING COPY ON `inputType` IS LOAD-BEARING, not decoration. §A25.2
 * seeded nearly every field as `text` (select options are never invented), so the
 * FIRST thing an admin will want is to turn one into a Select — and the only way
 * is delete + recreate under a new key. Without that sentence this gets filed as
 * a bug. It has to stay.
 */
const INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Select' },
];

const TYPE_LABEL = Object.fromEntries(INPUT_TYPES.map((t) => [t.value, t.label]));

/** ✓ / — with the word for screen readers — colour never alone. */
function YesNo({ value }) {
  return value ? (
    <span className="inline-flex items-center text-success">
      <CheckIcon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="text-ink-400">
      <span aria-hidden="true">—</span>
      <span className="sr-only">No</span>
    </span>
  );
}

const slugKey = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

export function AttributeManager() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = can(user, 'category:manage');

  const [panel, setPanel] = useState(null); // { mode, attr? }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState(null);

  const data = useQuery({
    queryKey: adminCatalogueKeys.attributes(id),
    queryFn: () => adminCatalogueApi.attributes(id),
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: adminCatalogueKeys.attributes(id) });
  const onError = (err) => setError(err?.response?.data?.error?.message ?? 'Something went wrong.');

  const save = useMutation({
    mutationFn: ({ mode, attrId, body }) =>
      mode === 'create'
        ? adminCatalogueApi.createAttribute(id, body)
        : adminCatalogueApi.updateAttribute(id, attrId, body),
    onMutate: () => setError(null),
    onSuccess: () => { setPanel(null); refresh(); },
    onError,
  });

  const remove = useMutation({
    mutationFn: (attrId) => adminCatalogueApi.deleteAttribute(id, attrId),
    onMutate: () => setError(null),
    onSuccess: () => { setConfirmDelete(null); refresh(); },
    onError,
  });

  // The design's breadcrumb names the PARENT top category; the attributes
  // response carries only `parentId`, so the cached tree supplies the name.
  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });
  const category = data.data?.category;
  const parent = (tree.data ?? []).find((t) => t.id === category?.parentId);
  const rows = data.data?.attributes ?? [];

  return (
    <AdminLayout>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link to="/admin/categories" className="hover:text-primary-700">Categories</Link>
        <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
        {parent && (
          <>
            <Link to={`/admin/categories?top=${parent.id}`} className="hover:text-primary-700">
              {parent.name}
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
          </>
        )}
        <span className="font-medium text-ink-800">{category?.name ?? '…'}</span>
      </nav>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-ink-900">{category?.name ?? 'Fields'}</h1>
          {category && (
            <StatusChip
              label={category.type === 'service' ? 'Service' : 'Goods'}
              tone={category.type === 'service' ? 'warning' : 'muted'}
            />
          )}
          {data.isSuccess && (
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
              {rows.length} field{rows.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {canManage && <Button size="sm" onClick={() => setPanel({ mode: 'create' })}>+ Add field</Button>}
      </div>

      <p className="mb-5 text-sm text-muted">
        These fields are what sellers fill in when listing under {category?.name ?? 'this category'}.
      </p>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {data.isPending && <SkeletonRows rows={6} />}
        {data.isError && (
          <ErrorState
            title="We couldn't load these fields"
            requestId={data.error?.response?.data?.error?.requestId}
            onRetry={data.refetch}
          />
        )}

        {data.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={ListIcon}
            title="No fields yet"
            action={canManage ? <Button onClick={() => setPanel({ mode: 'create' })}>Add field</Button> : undefined}
          >
            Sellers will only see the standard product form for this category.
          </EmptyState>
        )}

        {data.isSuccess && rows.length > 0 && (
          <>
            {/* Phones get CARDS, not a sideways-scrolling table. */}
            <ul className="divide-y divide-surface-border md:hidden">
              {rows.map((a) => (
                <li key={a.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink-900">{a.name}</p>
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-700">
                      {TYPE_LABEL[a.inputType]}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-700">{a.key}</code>
                    {a.unit && (
                      <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">{a.unit}</span>
                    )}
                    {a.inputType === 'select' && <span>{a.options?.length ?? 0} options</span>}
                    {a.required && <span className="font-medium text-ink-800">Required</span>}
                    {a.filterable && <span className="font-medium text-ink-800">Filterable</span>}
                  </p>
                  {canManage && (
                    <div className="mt-2.5 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPanel({ mode: 'edit', attr: a })}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${a.name}`}
                        onClick={() => setConfirmDelete(a)}
                      >
                        <TrashIcon className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="border-b border-surface-border px-4 py-3 font-semibold">Name</th>
                  <th className="border-b border-surface-border px-4 py-3 font-semibold">Key</th>
                  <th className="border-b border-surface-border px-4 py-3 font-semibold">Type</th>
                  <th className="border-b border-surface-border px-4 py-3 font-semibold">Unit</th>
                  <th className="border-b border-surface-border px-4 py-3 font-semibold">Options</th>
                  <th className="border-b border-surface-border px-4 py-3 font-semibold">Required</th>
                  <th className="border-b border-surface-border px-4 py-3 font-semibold">Filterable</th>
                  <th className="border-b border-surface-border px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-surface-subtle/50">
                    <td className="border-b border-surface-border px-4 py-3 font-medium text-ink-900">{a.name}</td>
                    <td className="border-b border-surface-border px-4 py-3">
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-700">{a.key}</code>
                    </td>
                    <td className="border-b border-surface-border px-4 py-3">{TYPE_LABEL[a.inputType]}</td>
                    <td className="border-b border-surface-border px-4 py-3">
                      {a.unit
                        ? <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">{a.unit}</span>
                        : <span className="text-ink-600">—</span>}
                    </td>
                    <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                      {a.inputType === 'select'
                        ? <span className="rounded border border-surface-border px-1.5 py-0.5 text-xs">{a.options?.length ?? 0} options</span>
                        : '—'}
                    </td>
                    <td className="border-b border-surface-border px-4 py-3"><YesNo value={a.required} /></td>
                    <td className="border-b border-surface-border px-4 py-3"><YesNo value={a.filterable} /></td>
                    <td className="border-b border-surface-border px-4 py-3 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setPanel({ mode: 'edit', attr: a })}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${a.name}`}
                            onClick={() => setConfirmDelete(a)}
                          >
                            <TrashIcon className="h-4 w-4 text-danger" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">Changes are recorded.</p>

      <AttributePanel
        panel={panel}
        saving={save.isPending}
        onClose={() => setPanel(null)}
        onSave={(body) => save.mutate({ mode: panel.mode, attrId: panel.attr?.id, body })}
      />

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        centered
        danger
        icon={TrashIcon}
        title={`Delete ${confirmDelete?.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(confirmDelete.id)}>
              Delete field
            </Button>
          </>
        }
      >
        {/* True — values are snapshots on the product — and it makes delete feel
            as safe as it actually is. */}
        Products that already have {confirmDelete?.name} keep their saved value — it just stops
        being asked for on new listings.
      </Modal>
    </AdminLayout>
  );
}

function AttributePanel({ panel, saving, onClose, onSave }) {
  const editing = panel?.mode === 'edit';
  const attr = panel?.attr;
  const [form, setForm] = useState({});
  const [ready, setReady] = useState(null);

  if (panel && ready !== (attr?.id ?? 'new')) {
    setReady(attr?.id ?? 'new');
    setForm({
      name: attr?.name ?? '',
      key: attr?.key ?? '',
      inputType: attr?.inputType ?? 'text',
      unit: attr?.unit ?? '',
      options: (attr?.options ?? []).join(', '),
      required: attr?.required ?? false,
      filterable: attr?.filterable ?? false,
      order: attr?.order ?? '',
    });
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    const body = {
      name: form.name,
      ...(form.unit ? { unit: form.unit } : {}),
      required: Boolean(form.required),
      filterable: Boolean(form.filterable),
      ...(form.order !== '' ? { order: Number(form.order) } : {}),
      ...(form.inputType === 'select'
        ? { options: form.options.split(',').map((o) => o.trim()).filter(Boolean) }
        : {}),
      // key + inputType only on CREATE — the server rejects them on PATCH.
      ...(editing ? {} : { key: form.key || slugKey(form.name), inputType: form.inputType }),
    };
    onSave(body);
  };

  return (
    <Drawer
      open={Boolean(panel)}
      onClose={onClose}
      title={editing ? 'Edit field' : 'Add field'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={submit} disabled={!form.name?.trim()}>Save</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Display name" helper="What sellers and buyers see — safe to change later.">
          {(id, hasError) => (
            <input
              id={id}
              className={inputClasses(hasError)}
              maxLength={120}
              value={form.name ?? ''}
              onChange={(e) => set({ name: e.target.value })}
            />
          )}
        </Field>

        {editing ? (
          <Field label="Key" helper="Fixed so existing products keep working.">
            {(id) => (
              <input id={id} className={inputClasses(false, 'font-mono text-xs')} value={form.key} readOnly disabled />
            )}
          </Field>
        ) : (
          <Field label="Key" helper="Lowercase with underscores. Set once and never changes.">
            {(id) => (
              <div className="flex gap-2">
                <input
                  id={id}
                  className={inputClasses(false, 'font-mono text-xs')}
                  maxLength={60}
                  placeholder={slugKey(form.name ?? '')}
                  value={form.key ?? ''}
                  onChange={(e) => set({ key: e.target.value })}
                />
                <Button size="sm" variant="secondary" onClick={() => set({ key: slugKey(form.name ?? '') })}>
                  Generate
                </Button>
              </div>
            )}
          </Field>
        )}

        {editing ? (
          // 🔴 THE SENTENCE THAT PREVENTS A BUG REPORT. Nearly every seeded field
          // is a Text an admin will want as a Select; this is the only place that
          // explains why they must delete and recreate it.
          <Field
            label="Type"
            helper="Type can't change later. To convert an existing field, delete it and create a new one with a different key."
          >
            {(id) => (
              <input id={id} className={inputClasses(false)} value={TYPE_LABEL[form.inputType]} readOnly disabled />
            )}
          </Field>
        ) : (
          <Field label="Type" helper="Immutable after create — choose carefully.">
            {(id) => (
              <Combobox
                id={id}
                value={form.inputType}
                options={INPUT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                onChange={(v) => set({ inputType: v })}
              />
            )}
          </Field>
        )}

        {form.inputType === 'select' && (
          <Field label="Options" helper="Comma separated. Can be added to later.">
            {(id) => (
              <input
                id={id}
                className={inputClasses(false)}
                value={form.options ?? ''}
                onChange={(e) => set({ options: e.target.value })}
              />
            )}
          </Field>
        )}

        <Field label="Unit" optional helper="e.g. gsm, kg, % — shown inside the seller's field.">
          {(id) => (
            <input
              id={id}
              className={inputClasses(false)}
              maxLength={20}
              value={form.unit ?? ''}
              onChange={(e) => set({ unit: e.target.value })}
            />
          )}
        </Field>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(form.required)}
            onChange={(e) => set({ required: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="font-medium text-ink-900">Required</span>
            <span className="block text-xs text-muted">Sellers must fill this before publishing.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(form.filterable)}
            onChange={(e) => set({ filterable: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="font-medium text-ink-900">Filterable</span>
            <span className="block text-xs text-muted">Available as a buyer filter (arrives with search).</span>
          </span>
        </label>

        <Field label="Order" optional>
          {(id) => (
            <input
              id={id}
              type="number"
              className={inputClasses(false)}
              value={form.order ?? ''}
              onChange={(e) => set({ order: e.target.value })}
            />
          )}
        </Field>
      </div>
    </Drawer>
  );
}
