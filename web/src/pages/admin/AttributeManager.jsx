import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import {
  ChevronRightIcon,
  FilterIcon,
  ListIcon,
  SettingsIcon,
  TrashIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { FormStack, OrderInput, PartLabel } from './categoryFormParts.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { cp } from '../../lib/consolePath.js';

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

  useEffect(() => {
    const previous = document.title;
    document.title = `${category?.name ? `${category.name} · ` : ''}Fields — MPX Global`;
    return () => { document.title = previous; };
  }, [category?.name]);

  const rowActions = (a) => [
    { label: 'Edit', Icon: SettingsIcon, onSelect: () => { setError(null); setPanel({ mode: 'edit', attr: a }); } },
    { label: 'Delete', Icon: TrashIcon, danger: true, onSelect: () => setConfirmDelete(a) },
  ];

  return (
    <AdminLayout>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link to={cp('/admin/categories')} className="hover:text-primary-700">Categories</Link>
        <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
        {parent && (
          <>
            <Link to={cp(`/admin/categories?top=${parent.id}`)} className="hover:text-primary-700">
              {parent.name}
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
          </>
        )}
        <span className="font-medium text-ink-800">{category?.name ?? '…'}</span>
      </nav>

      {/* Header in the admin language (2026-09-24): title + chips, one-line
          description, the primary action on the title row at every width. */}
      <header className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">{category?.name ?? 'Fields'}</h1>
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
          <p className="mt-1 text-sm text-muted">
            What sellers fill in when listing under {category?.name ?? 'this category'}.
          </p>
        </div>
        {canManage && (
          <Button size="sm" className="shrink-0" onClick={() => { setError(null); setPanel({ mode: 'create' }); }}>
            + Add field
          </Button>
        )}
      </header>

      {/* Page-level errors are only the ones raised OUTSIDE the panel (delete).
          A save error shows inside the panel, where the person is looking —
          it used to land here, behind the drawer, unseen. */}
      {error && !panel && <Alert tone="danger" className="mb-5">{error}</Alert>}

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
            action={canManage ? <Button onClick={() => { setError(null); setPanel({ mode: 'create' }); }}>Add field</Button> : undefined}
          >
            Sellers will only see the standard product form for this category.
          </EmptyState>
        )}

        {data.isSuccess && rows.length > 0 && (
          <>
            {/* Cards below lg — the old 8-column table scrolled sideways even on
                a laptop. */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {rows.map((a) => (
                <li key={a.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <FieldName a={a} />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <FieldType a={a} />
                      <FieldRules a={a} />
                    </div>
                  </div>
                  {canManage && <RowMenu label={`Actions for ${a.name}`} items={rowActions(a)} />}
                </li>
              ))}
            </ul>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[13rem]" />
                  <col className="w-[13rem]" />
                  <col className="w-[3.5rem]" />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Field</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Rules</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-ink-50/70">
                      <td className="px-4 py-3"><FieldName a={a} /></td>
                      <td className="px-4 py-3"><FieldType a={a} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5"><FieldRules a={a} empty /></div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && <RowMenu label={`Actions for ${a.name}`} items={rowActions(a)} />}
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
        categoryName={category?.name}
        saving={save.isPending}
        error={panel ? error : null}
        onClose={() => { setPanel(null); setError(null); }}
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

/** Name + its fixed key underneath. */
function FieldName({ a }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-ink-900">{a.name}</p>
      <code className="mt-0.5 inline-block max-w-full truncate rounded bg-ink-100 px-1.5 py-px font-mono text-[11.5px] text-ink-600">
        {a.key}
      </code>
    </div>
  );
}

/** Type chip, plus the unit or the option count that goes with it. */
function FieldType({ a }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-[12px] font-semibold text-ink-700">
        {TYPE_LABEL[a.inputType] ?? a.inputType}
      </span>
      {a.unit && (
        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11.5px] font-medium text-primary-700">{a.unit}</span>
      )}
      {a.inputType === 'select' && (
        <span className="text-[12px] text-muted">
          {a.options?.length ?? 0} option{a.options?.length === 1 ? '' : 's'}
        </span>
      )}
    </span>
  );
}

/** Required / Filterable as labelled chips — words, never a bare ✓. */
function FieldRules({ a, empty = false }) {
  if (!a.required && !a.filterable) return empty ? <span className="text-[12px] text-ink-400">Optional</span> : null;
  return (
    <>
      {a.required && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-[12px] font-semibold text-warning-800">
          Required
        </span>
      )}
      {a.filterable && (
        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-[12px] font-semibold text-success-700">
          <FilterIcon className="h-3 w-3" aria-hidden="true" />
          Filter
        </span>
      )}
    </>
  );
}

const TYPE_HINTS = {
  text: 'Free text — e.g. brand, material',
  number: 'A number, with an optional unit',
  boolean: 'A yes / no answer',
  select: 'One choice from a fixed list',
};

/**
 * Options as chips (case kept — "XL" stays "XL"; the category keyword input
 * lower-cases, which is right for search words and wrong for options). Enter
 * or a comma adds; Backspace on an empty box removes the last; a typed word is
 * added on blur so Save never drops it.
 */
function OptionsInput({ id, value, onChange }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const words = raw.split(',').map((w) => w.trim()).filter(Boolean);
    if (words.length) onChange([...value, ...words.filter((w) => !value.includes(w))]);
    setDraft('');
  };
  return (
    <div>
      <PartLabel htmlFor={id} count={value.length}>Options</PartLabel>
      <div
        className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-surface-border bg-white px-3 py-2 transition-colors focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/20"
        onClick={() => document.getElementById(id)?.focus()}
      >
        {value.map((o) => (
          <span key={o} className="inline-flex items-center gap-1 rounded-full bg-ink-100 py-1 pl-2.5 pr-1.5 text-xs font-medium text-ink-800">
            {o}
            <button
              type="button"
              aria-label={`Remove ${o}`}
              onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== o)); }}
              className="rounded-full p-0.5 hover:bg-ink-200"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink-500"
          placeholder={value.length ? 'Add another…' : 'e.g. Cotton, Silk, Linen'}
          value={draft}
          onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(draft); }
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">Press Enter or a comma to add one. More can be added later.</p>
    </div>
  );
}

/** A labelled on/off row. */
function SwitchRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <Switch checked={checked} onChange={() => onChange(!checked)} label={label} />
    </div>
  );
}

function AttributePanel({ panel, categoryName, saving, error, onClose, onSave }) {
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
      options: attr?.options ?? [],
      required: attr?.required ?? false,
      filterable: attr?.filterable ?? false,
      order: attr?.order ?? '',
    });
  }
  const close = () => {
    setReady(null);
    onClose();
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    const body = {
      name: form.name,
      ...(form.unit ? { unit: form.unit } : {}),
      required: Boolean(form.required),
      filterable: Boolean(form.filterable),
      ...(form.order !== '' ? { order: Number(form.order) } : {}),
      ...(form.inputType === 'select' ? { options: form.options } : {}),
      // key + inputType only on CREATE — the server rejects them on PATCH.
      ...(editing ? {} : { key: form.key || slugKey(form.name), inputType: form.inputType }),
    };
    onSave(body);
  };

  return (
    <Drawer
      open={Boolean(panel)}
      onClose={close}
      icon={ListIcon}
      title={editing ? 'Edit field' : 'Add field'}
      subtitle={editing ? `${attr?.name} · in ${categoryName ?? ''}` : `For ${categoryName ?? 'this category'}`}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
          <Button loading={saving} onClick={submit} disabled={!form.name?.trim()}>
            {editing ? 'Save changes' : 'Add field'}
          </Button>
        </>
      }
    >
      <FormStack>
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="space-y-4">
          <Field label="Display name" helper="What sellers and buyers see — safe to change later.">
            {(id, hasError) => (
              <input
                id={id}
                className={inputClasses(hasError)}
                maxLength={120}
                placeholder="e.g. Fabric weight"
                value={form.name ?? ''}
                onChange={(e) => set({ name: e.target.value })}
                autoFocus={!editing}
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
            <Field label="Key" helper="Lowercase with underscores. Set once and never changes. Left empty, it is made from the name.">
              {(id) => (
                <input
                  id={id}
                  className={inputClasses(false, 'font-mono text-xs')}
                  maxLength={60}
                  placeholder={slugKey(form.name ?? '') || 'fabric_weight'}
                  value={form.key ?? ''}
                  onChange={(e) => set({ key: e.target.value })}
                />
              )}
            </Field>
          )}
        </div>

        {/* 🔴 Type is immutable after create. */}
        <div>
          <PartLabel>Type</PartLabel>
          {editing ? (
            // 🔴 THE SENTENCE THAT PREVENTS A BUG REPORT. Nearly every seeded field
            // is a Text an admin will want as a Select; this is the only place that
            // explains why they must delete and recreate it.
            <div className="rounded-xl border border-surface-border bg-ink-50 px-4 py-3">
              <span className="block text-sm font-semibold text-ink-900">{TYPE_LABEL[form.inputType]}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Type can&apos;t change later. To convert an existing field, delete it and create a new one
                with a different key.
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Field type">
                {INPUT_TYPES.map((t) => {
                  const on = form.inputType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ inputType: t.value })}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        on
                          ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                          : 'border-surface-border bg-white hover:border-primary-400'
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${on ? 'text-primary-800' : 'text-ink-900'}`}>{t.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{TYPE_HINTS[t.value]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted">Can&apos;t be changed after the field is created — choose carefully.</p>
            </>
          )}
        </div>

        {form.inputType === 'select' && (
          <OptionsInput id="attr-options" value={form.options ?? []} onChange={(v) => set({ options: v })} />
        )}

        {form.inputType !== 'boolean' && (
          <Field label="Unit" optional helper="e.g. gsm, kg, % — shown inside the seller's field.">
            {(id) => (
              <input
                id={id}
                className={inputClasses(false)}
                maxLength={20}
                placeholder="e.g. gsm"
                value={form.unit ?? ''}
                onChange={(e) => set({ unit: e.target.value })}
              />
            )}
          </Field>
        )}

        <div className="space-y-4">
          <SwitchRow
            label="Required"
            hint="Sellers must fill this before publishing."
            checked={Boolean(form.required)}
            onChange={(v) => set({ required: v })}
          />
          <SwitchRow
            label="Buyer filter"
            hint="Offered as a filter when buyers browse this category."
            checked={Boolean(form.filterable)}
            onChange={(v) => set({ filterable: v })}
          />
        </div>

        <OrderInput id="attr-order" value={form.order ?? ''} onChange={(v) => set({ order: v })} />
      </FormStack>
    </Drawer>
  );
}
