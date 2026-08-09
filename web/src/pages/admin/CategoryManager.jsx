import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { ListIcon, TrashIcon, UploadIcon, XIcon } from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';

/**
 * M2 web screen 8 — the category manager (`/admin/categories`).
 *
 * 🔴 THIS SCREEN SHOWS INACTIVE ROWS. Every public read hides them; this one must
 * not, or an admin cannot find — let alone reactivate — the category they just
 * switched off. Inactive rows render muted but fully readable.
 *
 * 🔴 TOP CATEGORIES ARE TOGGLE-ONLY — the 40 are seeded, and there is no create,
 * no delete and no structural edit for them. The ONE exception is the **image
 * upload (§A20)**, which is deliberate and documented: the 40 top images arrive
 * through this control, not a seed. Do not "tidy" it away.
 *
 * 🔴 READ-ONLY VARIANT OMITS ACTIONS, never disables them. With `category:read`
 * alone the page is a browsing view — no toggles, no panels, no upload — rather
 * than a wall of greyed buttons.
 */
function TypeChip({ type }) {
  return (
    <StatusChip
      label={type === 'service' ? 'Service' : 'Goods'}
      tone={type === 'service' ? 'warning' : 'muted'}
    />
  );
}

export function CategoryManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const canManage = can(user, 'category:manage');

  const [panel, setPanel] = useState(null); // { mode: 'create'|'edit', sub? }
  const [cascade, setCascade] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const tree = useQuery({ queryKey: adminCatalogueKeys.tree, queryFn: adminCatalogueApi.tree });

  const tops = tree.data ?? [];
  const selectedId = params.get('top') ?? tops[0]?.id;
  const top = useMemo(() => tops.find((t) => t.id === selectedId), [tops, selectedId]);

  const refresh = () => qc.invalidateQueries({ queryKey: adminCatalogueKeys.tree });
  const onError = (err) => setError(err?.response?.data?.error?.message ?? 'Something went wrong.');

  const toggle = useMutation({
    mutationFn: ({ id }) => adminCatalogueApi.toggle(id),
    onMutate: () => { setError(null); setNotice(null); },
    onSuccess: (_data, vars) => { setCascade(null); if (vars.notice) setNotice(vars.notice); refresh(); },
    onError,
  });

  /**
   * 🔴 While a TOP is off, toggling one of its subs does not change visibility —
   * every sub is already hidden. It edits the RESTORE INTENT: whether that sub
   * comes back when the top does. Nothing visible changes on the row, so without
   * this message the control looks broken.
   */
  const toggleSub = (sub) => {
    const parentOff = top && !top.active;
    toggle.mutate({
      id: sub.id,
      notice: parentOff
        ? sub.prevActive === false
          ? `${sub.name} will come back on when ${top.name} is reactivated.`
          : `${sub.name} will stay off even after ${top.name} is reactivated.`
        : null,
    });
  };
  // A top category is seeded and structurally fixed, but its NAME, DISPLAY ORDER
  // and SYNONYMS are editable — the design puts all three on this panel, and the
  // synonyms input is the ONLY entry path for the top-40 keyword list (§A12).
  const saveTop = useMutation({
    mutationFn: ({ id, body }) => adminCatalogueApi.update(id, body),
    onMutate: () => { setError(null); setNotice(null); },
    onSuccess: () => { setNotice('Category updated.'); refresh(); },
    onError,
  });

  const saveSub = useMutation({
    mutationFn: ({ mode, id, body }) =>
      mode === 'create' ? adminCatalogueApi.createSub(body) : adminCatalogueApi.update(id, body),
    onMutate: () => setError(null),
    onSuccess: () => { setPanel(null); refresh(); },
    onError,
  });
  const removeSub = useMutation({
    mutationFn: (id) => adminCatalogueApi.remove(id),
    onMutate: () => setError(null),
    onSuccess: () => { setConfirmDelete(null); refresh(); },
    onError,
  });
  const uploadImage = useMutation({
    mutationFn: ({ id, file }) => adminCatalogueApi.uploadImage(id, file),
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError,
  });

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-900">Categories</h1>
        {canManage && top && (
          <Button size="sm" onClick={() => setPanel({ mode: 'create' })}>+ Add sub-category</Button>
        )}
      </div>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {notice && <Alert tone="info" className="mb-5">{notice}</Alert>}

      {tree.isPending && <SkeletonRows rows={8} />}
      {tree.isError && <ErrorState onRetry={tree.refetch} />}

      {tree.isSuccess && (
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* --- Left: the 40 tops, inactive ones included --- */}
          <aside className="lg:w-80 lg:shrink-0">
            <ul className="max-h-[70vh] divide-y divide-surface-border overflow-y-auto rounded-lg border border-surface-border bg-white shadow-card">
              {tops.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ top: t.id })}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                        active ? 'bg-primary-50' : 'hover:bg-surface-subtle'
                      } ${t.active ? '' : 'opacity-55'}`}
                    >
                      {t.image ? (
                        <img src={t.image} alt="" className="h-9 w-9 rounded object-cover" />
                      ) : (
                        <NoImagePanel label={t.name} monogram ratio="h-9 w-9" className="shrink-0 rounded" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{t.name}</span>
                        <span className="block text-xs text-muted">
                          {t.subs?.length ?? 0} sub-categories{t.active ? '' : ' · off'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* --- Right: the selected top --- */}
          <div className="min-w-0 flex-1 space-y-6">
            {top && (
              <>
                <TopPanel
                  key={top.id}
                  top={top}
                  canManage={canManage}
                  saving={saveTop.isPending}
                  uploading={uploadImage.isPending}
                  onSave={(body) => saveTop.mutate({ id: top.id, body })}
                  onUpload={(file) => uploadImage.mutate({ id: top.id, file })}
                  onToggle={() => (top.active ? setCascade(top) : toggle.mutate({ id: top.id }))}
                />

                <section className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted">
                        <th className="border-b border-surface-border px-4 py-3 font-semibold">Sub-category</th>
                        <th className="border-b border-surface-border px-4 py-3 font-semibold">Type</th>
                        <th className="border-b border-surface-border px-4 py-3 font-semibold">Fields</th>
                        <th className="border-b border-surface-border px-4 py-3 font-semibold">State</th>
                        <th className="border-b border-surface-border px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {(top.subs ?? []).map((sub) => (
                        <tr key={sub.id} className={sub.active ? '' : 'opacity-55'}>
                          <td className="border-b border-surface-border px-4 py-3 font-medium text-ink-900">
                            {sub.name}
                          </td>
                          <td className="border-b border-surface-border px-4 py-3">
                            <TypeChip type={sub.type} />
                          </td>
                          <td className="border-b border-surface-border px-4 py-3">
                            <Link
                              to={`/admin/categories/${sub.id}/attributes`}
                              className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline"
                            >
                              <ListIcon className="h-4 w-4" />
                              {sub.attributeCount ?? 0} fields
                            </Link>
                          </td>
                          <td className="border-b border-surface-border px-4 py-3 text-xs text-muted">
                            {sub.active ? 'Active' : 'Off'}
                          </td>
                          <td className="border-b border-surface-border px-4 py-3 text-right">
                            {/* Read-only staff see NO actions — not disabled ones. */}
                            {canManage && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setPanel({ mode: 'edit', sub })}>
                                  Edit
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => toggleSub(sub)}>
                                  {top.active
                                    ? (sub.active ? 'Turn off' : 'Turn on')
                                    : (sub.prevActive === false ? 'Restore with parent' : "Keep off")}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(sub)}>
                                  <TrashIcon className="h-4 w-4 text-danger" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(top.subs?.length ?? 0) === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-muted">
                      No sub-categories yet{canManage ? ' — add one above.' : '.'}
                    </p>
                  )}
                </section>

                <p className="text-xs text-muted">Changes are recorded.</p>
              </>
            )}
          </div>
        </div>
      )}

      <SubPanel
        panel={panel}
        top={top}
        saving={saveSub.isPending}
        onClose={() => setPanel(null)}
        onSave={(body) =>
          saveSub.mutate({ mode: panel.mode, id: panel.sub?.id, body })
        }
      />

      {/* The cascade modal is where an admin learns the prevActive rule — it is
          subtle enough that nowhere else would teach it. */}
      <Modal
        open={Boolean(cascade)}
        onClose={() => setCascade(null)}
        centered
        danger
        title={`Turn off ${cascade?.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCascade(null)}>Cancel</Button>
            <Button variant="danger" loading={toggle.isPending} onClick={() => toggle.mutate({ id: cascade.id })}>
              Turn off category
            </Button>
          </>
        }
      >
        This hides {cascade?.name} and all {cascade?.subs?.length ?? 0} of its sub-categories from
        the catalogue. Every product in them disappears from public view until you reactivate.
        Sub-categories you had already switched off individually will stay off when you reactivate.
      </Modal>

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
            <Button variant="danger" loading={removeSub.isPending} onClick={() => removeSub.mutate(confirmDelete.id)}>
              Delete sub-category
            </Button>
          </>
        }
      >
        {/* The server refuses this when products or children exist and returns a
            specific message — surfaced verbatim in the alert above. */}
        This can only be deleted while no products use it. If any do, deactivate it instead.
      </Modal>
    </AdminLayout>
  );
}

/**
 * The selected top category: image, active toggle, and the three editable
 * fields the design puts here — Name, Display order and Synonyms.
 *
 * 🔴 §A20: the image upload is allowed on a TOP category even though tops are
 * otherwise activate/deactivate-only. Deliberate and documented — the 40 top
 * images arrive through this control, not a seed. Do not "tidy" it away.
 *
 * 🔴 The synonyms tag input is the ONLY entry path for the top-40 keyword list
 * (§A12). It is empty for all 40 today — that is owner content, not a bug — and
 * without it keyword→category search (M3) stays half-blind.
 */
function TopPanel({ top, canManage, saving, uploading, onSave, onUpload, onToggle }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(top.name);
  const [order, setOrder] = useState(top.order ?? '');
  const [synonyms, setSynonyms] = useState(top.synonyms ?? []);
  const [draft, setDraft] = useState('');

  const dirty =
    name !== top.name ||
    String(order) !== String(top.order ?? '') ||
    synonyms.join('|') !== (top.synonyms ?? []).join('|');

  const addSynonym = (value) => {
    const v = value.trim().replace(/,$/, '');
    if (v && !synonyms.includes(v)) setSynonyms((list) => [...list, v]);
    setDraft('');
  };

  return (
    <section className="rounded-lg border border-surface-border bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-ink-900">{top.name}</h2>
        {canManage && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink-800">Active</span>
            <button
              type="button"
              role="switch"
              aria-checked={top.active}
              aria-label={top.active ? 'Turn category off' : 'Turn category on'}
              onClick={onToggle}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                top.active ? 'bg-primary-600' : 'bg-ink-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  top.active ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="sm:w-44 sm:shrink-0">
          {top.image ? (
            <img src={top.image} alt="" className="aspect-square w-full rounded-lg object-cover" />
          ) : (
            <NoImagePanel label={top.name} monogram ratio="aspect-square" className="w-full rounded-lg" />
          )}
          <p className="mt-2 text-center text-xs text-muted">1 image · 5 MB max<br />JPG, PNG or WEBP</p>
          {canManage && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 w-full"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <UploadIcon className="mr-1.5 h-4 w-4" />
                {top.image ? 'Replace' : 'Add image'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
            <Field label="Name">
              {(id) => (
                <input
                  id={id}
                  className={inputClasses(false)}
                  maxLength={120}
                  value={name}
                  disabled={!canManage}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Field label="Display order">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  className={inputClasses(false)}
                  value={order}
                  disabled={!canManage}
                  onChange={(e) => setOrder(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field
            label="Synonyms"
            helper="Keywords buyers might type — e.g. medicine, pharma, dawai. Never shown publicly."
          >
            {(id) => (
              <div className={`${inputClasses(false, 'h-auto min-h-[44px] py-2')} flex flex-wrap items-center gap-2`}>
                {synonyms.map((syn) => (
                  <span key={syn} className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2 py-1 text-xs text-ink-800">
                    {syn}
                    {canManage && (
                      <button
                        type="button"
                        aria-label={`Remove ${syn}`}
                        onClick={() => setSynonyms((l) => l.filter((x) => x !== syn))}
                        className="text-ink-500 hover:text-danger"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {canManage && (
                  <input
                    id={id}
                    className="min-w-[140px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink-500"
                    placeholder={synonyms.length ? 'Add synonym…' : 'No keywords yet — add one'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSynonym(draft); }
                      if (e.key === 'Backspace' && !draft) setSynonyms((l) => l.slice(0, -1));
                    }}
                    onBlur={() => addSynonym(draft)}
                  />
                )}
              </div>
            )}
          </Field>

          {canManage && dirty && (
            <div className="flex gap-3">
              <Button
                size="sm"
                loading={saving}
                onClick={() => onSave({ name, synonyms, ...(order !== '' ? { order: Number(order) } : {}) })}
              >
                Save changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setName(top.name); setOrder(top.order ?? ''); setSynonyms(top.synonyms ?? []); }}
              >
                Discard
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Create / edit a sub-category. Slug and type lock once they matter. */
function SubPanel({ panel, top, saving, onClose, onSave }) {
  const editing = panel?.mode === 'edit';
  const sub = panel?.sub;
  const [name, setName] = useState('');
  const [type, setType] = useState('goods');
  const [order, setOrder] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [ready, setReady] = useState(null);

  // Reset the fields whenever a different row opens the panel.
  if (panel && ready !== (sub?.id ?? 'new')) {
    setReady(sub?.id ?? 'new');
    setName(sub?.name ?? '');
    setType(sub?.type ?? 'goods');
    setOrder(sub?.order ?? '');
    setSynonyms((sub?.synonyms ?? []).join(', '));
  }

  const submit = () => {
    const body = {
      name,
      ...(order !== '' ? { order: Number(order) } : {}),
      synonyms: synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      ...(editing ? {} : { parentId: top.id, type }),
    };
    onSave(body);
  };

  return (
    <Drawer
      open={Boolean(panel)}
      onClose={onClose}
      title={editing ? 'Edit sub-category' : 'Add sub-category'}
      subtitle={top?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={submit} disabled={!name.trim()}>Save</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Parent category">
          {(id) => <input id={id} className={inputClasses(false)} value={top?.name ?? ''} readOnly disabled />}
        </Field>

        <Field label="Name">
          {(id, hasError) => (
            <input
              id={id}
              className={inputClasses(hasError)}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        {editing && (
          <Field label="Web address" helper="Fixed once created, so existing links keep working.">
            {(id) => (
              <input id={id} className={inputClasses(false, 'font-mono text-xs')} value={sub.slug} readOnly disabled />
            )}
          </Field>
        )}

        {/* 🔴 Type is set at create. The server locks it once products exist, so
            editing shows it read-only rather than offering a change that 409s. */}
        {editing ? (
          <Field label="Type" helper="Can't change once products use this category.">
            {(id) => (
              <input
                id={id}
                className={inputClasses(false)}
                value={sub.type === 'service' ? 'Service' : 'Goods'}
                readOnly
                disabled
              />
            )}
          </Field>
        ) : (
          <Field label="Type" helper="Decides which fields sellers are asked for.">
            {(id) => (
              <select id={id} className={inputClasses(false)} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="goods">Goods</option>
                <option value="service">Service</option>
              </select>
            )}
          </Field>
        )}

        <Field
          label="Synonyms"
          optional
          helper="Keywords buyers might type — e.g. medicine, pharma, dawai. Comma separated. Never shown publicly."
        >
          {(id) => (
            <input
              id={id}
              className={inputClasses(false)}
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
            />
          )}
        </Field>

        <Field label="Order" optional>
          {(id) => (
            <input
              id={id}
              type="number"
              className={inputClasses(false)}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Drawer>
  );
}
