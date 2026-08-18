import { useEffect, useMemo, useRef, useState } from 'react';
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
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';

/**
 * M2 web screen 8 — the category manager (`/admin/categories`).
 *
 * RETHOUGHT 2026-08-11 (owner: the sub table + detached toggle were wrong).
 * The right side is now a category DETAIL VIEW, not a form-plus-table:
 *
 *   header   → identity (image = the §A20 upload control, click/drop to
 *              replace) + the MASTER SWITCH with its consequence written right
 *              beside it ("Live in the catalogue" / "Hidden, and every
 *              sub-category with it").
 *   settings → the three editable pieces (name · order · synonyms) in one card.
 *   subs     → a LIST with a REAL SWITCH per row — no more "Turn off"/"Keep
 *              off" text buttons — plus a ⋮ menu (Edit · Manage fields ·
 *              Delete). While the parent is OFF, an amber banner explains that
 *              the switches now set RESTORE INTENT, and each switch binds to
 *              `prevActive` instead of `active`.
 *
 * One rendering serves desktop and phones — rows wrap, nothing is a table.
 *
 * 🔴 THIS SCREEN SHOWS INACTIVE ROWS. Every public read hides them; this one
 * must not, or an admin cannot find the category they just switched off.
 * Inactive rows render muted but fully readable.
 *
 * 🔴 TOP CATEGORIES ARE TOGGLE-ONLY — the 40 are seeded; no create, no delete,
 * no structural edit. The ONE exception is the image upload (§A20): the 40 top
 * images arrive through the header control, not a seed. Do not "tidy" it away.
 *
 * 🔴 READ-ONLY VARIANT OMITS CONTROLS, never disables them. With
 * `category:read` alone the page is a browsing view — state dots instead of
 * switches, no menus, no add, no upload.
 */
function TypeChip({ type }) {
  return (
    <StatusChip
      label={type === 'service' ? 'Service' : 'Goods'}
      tone={type === 'service' ? 'warning' : 'muted'}
    />
  );
}

/** One top-category row (image · name · inactive chip · sub count). */
function TopRowBody({ t }) {
  return (
    <>
      {t.image ? (
        <img src={t.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      ) : (
        <NoImagePanel label={t.name} monogram ratio="h-9 w-9" className="shrink-0 rounded" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-900">{t.name}</span>
          {!t.active && (
            <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Inactive
            </span>
          )}
        </span>
        <span className="block text-xs text-muted">{t.subs?.length ?? 0} sub-categories</span>
      </span>
    </>
  );
}

/**
 * Phone category picker (2026-08-11): 40 categories don't fit a swipe strip.
 * A full-height SHEET with search — type-to-filter on names AND synonyms —
 * replaces it; the page shows only a compact "current category" selector.
 */
/**
 * Mounted only while open (wrapper below), so the search box starts empty each
 * time without an effect clearing it — remounting is React's own answer to
 * "reset state when this reopens".
 */
function CategorySheetBody({ tops, selectedId, onPick, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const norm = q.trim().toLowerCase();
  const list = norm
    ? tops.filter((t) =>
        `${t.name} ${(t.synonyms ?? []).join(' ')}`.toLowerCase().includes(norm),
      )
    : tops;

  return (
    <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Choose a category">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-900/40" />
      <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-2xl bg-white shadow-lift">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
          <h2 className="text-[15px] font-bold text-ink-900">Choose a category</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="relative border-b border-ink-100 px-4 py-2.5">
          <SearchIcon className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            ref={inputRef}
            type="search"
            aria-label="Search categories"
            placeholder="Search 40 categories…"
            className="h-10 w-full rounded-lg border border-surface-border bg-white pl-9 pr-3 text-sm outline-none placeholder:text-ink-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-surface-border overflow-y-auto overscroll-contain">
          {list.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted">
              No category matches &ldquo;{q.trim()}&rdquo;.
            </li>
          )}
          {list.map((t) => {
            const on = t.id === selectedId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onPick(t.id)}
                  aria-current={on || undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                    on ? 'bg-primary-50' : 'hover:bg-surface-subtle'
                  } ${t.active ? '' : 'opacity-55'}`}
                >
                  <TopRowBody t={t} />
                  {on && <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Gate: mounting only while open is what gives the body fresh state. */
function CategorySheet({ open, ...props }) {
  if (!open) return null;
  return <CategorySheetBody {...props} />;
}


/** Plain category thumbnail — image or neutral monogram. Never a control. */
function CategoryThumb({ name, image, sizeClasses, monogram = true }) {
  return image ? (
    <img src={image} alt="" className={`${sizeClasses} shrink-0 rounded-xl object-cover`} />
  ) : (
    <NoImagePanel label={name} monogram={monogram} ratio={sizeClasses} className="shrink-0 rounded-xl" />
  );
}

/** Read-only state: dot + word, colour never alone. */
function StateDot({ on, onWord = 'Active', offWord = 'Off' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-success-500' : 'bg-ink-300'}`}
      />
      <span className={on ? 'text-ink-800' : 'text-muted'}>{on ? onWord : offWord}</span>
    </span>
  );
}

export function CategoryManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const canManage = can(user, 'category:manage');

  const [panel, setPanel] = useState(null); // { mode: 'create'|'edit', sub? }
  const [pickerOpen, setPickerOpen] = useState(false); // phone category sheet
  const [settingsOpen, setSettingsOpen] = useState(false); // top-category settings drawer
  const [cascade, setCascade] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const tree = useQuery({ queryKey: adminCatalogueKeys.tree, queryFn: adminCatalogueApi.tree });

  // Memoised because `tree.data ?? []` produces a NEW array on every render
  // while the query is loading, which re-ran every downstream memo with it.
  const tops = useMemo(() => tree.data ?? [], [tree.data]);
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
  const busyId = toggle.isPending ? toggle.variables?.id : null;

  /**
   * 🔴 While a TOP is off, toggling one of its subs does not change visibility —
   * every sub is already hidden. It edits the RESTORE INTENT: whether that sub
   * comes back when the top does. The banner above the list carries the rule;
   * the notice confirms what each flip meant.
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

  // A top category is seeded and structurally fixed, but its NAME, DISPLAY
  // ORDER and SYNONYMS are editable — and the synonyms input is the ONLY entry
  // path for the top-40 keyword list (§A12).
  const saveTop = useMutation({
    mutationFn: ({ id, body }) => adminCatalogueApi.update(id, body),
    onMutate: () => { setError(null); setNotice(null); },
    onSuccess: () => { setNotice('Category updated.'); refresh(); },
    onError,
  });

  const saveSub = useMutation({
    // The image rides WITH the save (owner, 2026-08-11): the drawer is the one
    // place a sub's picture is set, so create-then-upload chains here — a new
    // sub has no id until the create returns.
    mutationFn: async ({ mode, id, body, imageFile }) => {
      const saved =
        mode === 'create' ? await adminCatalogueApi.createSub(body) : await adminCatalogueApi.update(id, body);
      if (imageFile) await adminCatalogueApi.uploadImage(saved?.id ?? id, imageFile);
      return saved;
    },
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-ink-900">Categories</h1>
          {tree.isSuccess && (
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
              {tops.length} categories
            </span>
          )}
        </div>
      </div>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {notice && <Alert tone="info" className="mb-5">{notice}</Alert>}

      {tree.isPending && <SkeletonRows rows={8} />}
      {tree.isError && <ErrorState onRetry={tree.refetch} />}

      {tree.isSuccess && (
        <div className="flex flex-col gap-5 xl:flex-row">
          {/* --- Left: the 40 tops, inactive ones included. Phones: a compact
              selector that opens a SEARCHABLE SHEET (a swipe strip was
              unusable at 40 entries — owner, 2026-08-11); lg+: the vertical
              rail. --- */}
          <div className="xl:hidden">
            {top && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-haspopup="dialog"
                className="flex w-full items-center gap-3 rounded-2xl border border-surface-border bg-white p-3 text-left shadow-card active:bg-surface-subtle"
              >
                <TopRowBody t={top} />
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary-700">
                  Change
                  <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            )}
            {/* Phone-reachable create: the SubList header's own button sits
                ~one viewport below the fold behind TopHeader + TopSettings, so
                testers reported "create category not shown" (QA, 2026-08-14). */}
            {top && canManage && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => setPanel({ mode: 'create' })}
              >
                + Add sub-category in “{top.name}”
              </Button>
            )}
            <CategorySheet
              open={pickerOpen}
              tops={tops}
              selectedId={selectedId}
              onPick={(id) => {
                setParams({ top: id });
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </div>

          <aside className="hidden xl:block xl:w-80 xl:shrink-0">
            <ul className="max-h-[70vh] divide-y divide-surface-border overflow-y-auto rounded-2xl border border-surface-border bg-white shadow-card">
              {tops.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ top: t.id })}
                      aria-current={active || undefined}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                        active ? 'bg-primary-50' : 'hover:bg-surface-subtle'
                      } ${t.active ? '' : 'opacity-55'}`}
                    >
                      <TopRowBody t={t} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* --- Right: the selected category as a DETAIL VIEW --- */}
          <div className="min-w-0 flex-1 space-y-5">
            {top && (
              <>
                <TopHeader
                  key={`h-${top.id}`}
                  top={top}
                  canManage={canManage}
                  uploading={uploadImage.isPending}
                  busy={busyId === top.id}
                  onUpload={(file) => uploadImage.mutate({ id: top.id, file })}
                  onToggle={() => (top.active ? setCascade(top) : toggle.mutate({ id: top.id }))}
                  onSettings={() => setSettingsOpen(true)}
                />

                {/* 2026-08-14 restructure: the settings form is no longer page
                    furniture. Sub-categories — the daily surface — get the full
                    width; name/order/keywords open in a DRAWER from the header,
                    the same pattern a sub-category already edits with. */}
                <SubList
                  top={top}
                  canManage={canManage}
                  busyId={busyId}
                  onAdd={() => setPanel({ mode: 'create' })}
                  onEdit={(sub) => setPanel({ mode: 'edit', sub })}
                  onToggle={toggleSub}
                  onDelete={(sub) => setConfirmDelete(sub)}
                />

                <p className="text-xs text-muted">Changes are recorded.</p>

                <TopSettings
                  key={`s-${top.id}`}
                  top={top}
                  open={settingsOpen}
                  onClose={() => setSettingsOpen(false)}
                  canManage={canManage}
                  saving={saveTop.isPending}
                  onSave={(body) =>
                    saveTop.mutate(
                      { id: top.id, body },
                      { onSuccess: () => setSettingsOpen(false) },
                    )
                  }
                />
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
        onSave={(body, imageFile) => saveSub.mutate({ mode: panel.mode, id: panel.sub?.id, body, imageFile })}
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
 * Identity + the master switch, together. The image IS the §A20 upload
 * control — click or drop a file on it (the 40 top images arrive through this,
 * not a seed). The switch's consequence is written beside it, not implied.
 */
function TopHeader({ top, canManage, uploading, busy, onUpload, onToggle, onSettings }) {
  const liveSubs = (top.subs ?? []).filter((s) => s.active).length;
  const fileRef = useRef(null);

  return (
    <section className="rounded-2xl border border-surface-border bg-white shadow-card">
      {/* Identity row — the name owns the width; nothing competes with it. */}
      <div className="flex items-center gap-4 p-5">
        <CategoryThumb name={top.name} image={top.image} sizeClasses="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold text-ink-900">{top.name}</h2>
            {!top.active && (
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {(top.subs ?? []).length} sub-categories · {liveSubs} live
          </p>
          {canManage && (
            <div className="mt-2">
              <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                <UploadIcon className="mr-1.5 h-4 w-4" />
                {top.image ? 'Replace image' : 'Add image'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label={`Choose ${top.name} image`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}
        </div>
        {!canManage && <StateDot on={top.active} onWord="Live" offWord="Hidden" />}
        {/* Card-level action in the card's corner, where every other card puts
            its actions (⋮ menus). Gear icon only (owner, 2026-08-14) — the
            drawer title says the rest. Read-only staff get it too (fields
            render disabled there, keeping the keyword list browsable). */}
        <button
          type="button"
          aria-label={`Settings for ${top.name}`}
          title="Category settings"
          onClick={onSettings}
          className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <SettingsIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* The master switch gets its OWN row — at no width does it fight the
          name for space (owner screenshot, 2026-08-11: the title truncated to
          "Tex…" beside empty space). */}
      {canManage && (
        <div className="flex items-center justify-between gap-4 border-t border-ink-100 px-5 py-3">
          <p className="min-w-0 text-[13px] leading-snug">
            <span className="block font-semibold text-ink-900">
              {top.active ? 'Live in the catalogue' : 'Hidden from the catalogue'}
            </span>
            <span className="block text-xs text-muted">
              {top.active
                ? 'Buyers can browse it and everything inside.'
                : 'Every sub-category and product inside is hidden too.'}
            </span>
          </p>
          <Switch
            checked={top.active}
            busy={busy || uploading}
            onChange={onToggle}
            label={top.active ? `Turn ${top.name} off` : `Turn ${top.name} on`}
          />
        </div>
      )}
    </section>
  );
}

/**
 * Name · order · synonyms — the only editable pieces of a seeded top (§A12).
 * A DRAWER since 2026-08-14 (owner rejected every on-page form placement):
 * the page keeps header + full-width sub list; this opens from the header's
 * Settings button, exactly like a sub-category's own edit panel.
 */
/**
 * Fresh copy on every opening — closing without saving discards edits, so a
 * reopen must not resurrect them.
 *
 * That reset used to be an effect. It is now achieved by MOUNTING this only
 * while the drawer is open (wrapper below), so the initial state IS the fresh
 * copy: no cascading render, and no window in which the drawer shows last
 * time's values before the effect corrects them.
 */
function TopSettingsBody({ top, onClose, canManage, saving, onSave }) {
  const [name, setName] = useState(top.name);
  const [order, setOrder] = useState(top.order ?? '');
  const [synonyms, setSynonyms] = useState(top.synonyms ?? []);
  const [draft, setDraft] = useState('');

  const addSynonym = (raw) => {
    const v = raw.trim().toLowerCase();
    if (!v) return;
    setSynonyms((l) => (l.includes(v) ? l : [...l, v]));
    setDraft('');
  };

  const dirty =
    name !== top.name ||
    String(order) !== String(top.order ?? '') ||
    JSON.stringify(synonyms) !== JSON.stringify(top.synonyms ?? []);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Category settings"
      subtitle={`${top.name} — the editable pieces of a seeded category.`}
      footer={
        canManage ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!dirty}
              loading={saving}
              onClick={() => onSave({ name, synonyms, ...(order !== '' ? { order: Number(order) } : {}) })}
            >
              Save changes
            </Button>
          </>
        ) : null
      }
    >
      <div className="space-y-5">
        <div>
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
          {/* A6: the slug is immutable — a rename never breaks the URL. Always
              visible, so the lock explains itself before anyone wonders. */}
          <p className="mt-1.5 truncate text-xs text-muted">
            /category/{top.slug} — never changes
          </p>
        </div>

        {/* A rank, not a paragraph: label left, tiny input right. The input
            sits in a fixed-width WRAPPER — inputClasses bakes in `w-full`, so
            a `w-20` on the input itself loses and the field swallowed the row
            (owner screenshot, 2026-08-14). */}
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="top-order" className="min-w-0 flex-1 text-sm font-medium text-ink-900">
            Display order
            <span className="block text-xs font-normal text-muted">
              Lower shows first — the others shift around it.
            </span>
          </label>
          <div className="w-20 shrink-0">
            <input
              id="top-order"
              type="number"
              inputMode="numeric"
              className={inputClasses(false, 'text-center')}
              value={order}
              disabled={!canManage}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
        </div>

        {/* 🔴 §A12: this tag input is the ONLY entry path for the top-40
            keyword list. Never shown publicly; search-matching only. Not built
            on inputClasses — its h-11 fights the growing tag box. */}
        <div>
          <label
            htmlFor="top-synonyms"
            className="flex items-center gap-2 text-sm font-medium text-ink-900"
          >
            Search keywords
            {synonyms.length > 0 && (
              <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-800">
                {synonyms.length}
              </span>
            )}
          </label>
          <div
            className="mt-1.5 flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-surface-border bg-white px-3 py-2 transition-all focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/20"
            onClick={() => document.getElementById('top-synonyms')?.focus()}
          >
            {synonyms.map((syn) => (
              <span
                key={syn}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-800"
              >
                {syn}
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Remove ${syn}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSynonyms((l) => l.filter((x) => x !== syn));
                    }}
                    className="text-primary-400 hover:text-danger"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {canManage && (
              <input
                id="top-synonyms"
                className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink-500"
                placeholder={synonyms.length ? 'Add keyword…' : 'e.g. medicine, pharma, dawai'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSynonym(draft); }
                  if (e.key === 'Backspace' && !draft) setSynonyms((l) => l.slice(0, -1));
                }}
                onBlur={() => addSynonym(draft)}
              />
            )}
            {!canManage && synonyms.length === 0 && (
              <span className="text-sm text-muted">No keywords yet.</span>
            )}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            What buyers might type so search finds “{top.name}”. Enter adds one. Never shown
            publicly.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

/** Gate: mounting only while open is what makes the body's initial state the
 *  fresh copy of `top`. */
function TopSettings({ open, ...props }) {
  if (!open) return null;
  return <TopSettingsBody {...props} />;
}


/**
 * The sub-categories as a LIST with a real switch per row. While the parent is
 * OFF the switches set RESTORE INTENT (`prevActive`), and the banner above the
 * list is what makes that legible — nothing visible changes on a row when the
 * intent flips, so without the banner the control looks broken.
 */
function SubList({ top, canManage, busyId, onAdd, onEdit, onToggle, onDelete }) {
  const subs = top.subs ?? [];
  const parentOff = !top.active;

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <ListIcon className="h-[18px] w-[18px]" />
          </span>
          <span>
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
              Sub-categories
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                {subs.length}
              </span>
            </h3>
            <p className="text-[13px] text-muted">
              Where products actually live — each carries its own fields.
            </p>
          </span>
        </div>
        {canManage && <Button size="sm" onClick={onAdd}>+ Add sub-category</Button>}
      </header>

      {parentOff && (
        <div className="flex gap-3 border-b border-warning-100 bg-warning-50 px-5 py-3">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-ink-900">
            <span className="font-semibold">{top.name} is switched off</span> — everything below is
            hidden right now. The switches set what comes back when you reactivate it.
          </p>
        </div>
      )}

      {subs.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          No sub-categories yet{canManage ? ' — add one above.' : '.'}
        </p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {subs.map((sub) => {
            // Parent off → the switch binds to RESTORE INTENT, not visibility.
            const checked = parentOff ? sub.prevActive !== false : Boolean(sub.active);
            const muted = parentOff ? !checked : !sub.active;
            return (
              <li
                key={sub.id}
                className={`flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 ${muted ? 'opacity-55' : ''}`}
              >
                <CategoryThumb name={sub.name} image={sub.image} sizeClasses="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-ink-900">{sub.name}</p>
                    <TypeChip type={sub.type} />
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <Link
                      to={`/admin/categories/${sub.id}/attributes`}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {sub.attributeCount ?? 0} fields
                    </Link>
                    {sub.order != null && (
                      <>
                        <span aria-hidden="true" className="text-ink-300">·</span>
                        <span>Order {sub.order}</span>
                      </>
                    )}
                    {parentOff && (
                      <>
                        <span aria-hidden="true" className="text-ink-300">·</span>
                        <span>{checked ? 'Comes back with parent' : 'Stays off'}</span>
                      </>
                    )}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <Switch
                      checked={checked}
                      busy={busyId === sub.id}
                      onChange={() => onToggle(sub)}
                      label={
                        parentOff
                          ? `${sub.name}: come back when ${top.name} is reactivated`
                          : `${sub.name} visible in the catalogue`
                      }
                    />
                    <RowMenu
                      label={`Actions for ${sub.name}`}
                      items={[
                        { label: 'Edit', Icon: SettingsIcon, onSelect: () => onEdit(sub) },
                        {
                          label: 'Manage fields',
                          Icon: ListIcon,
                          to: `/admin/categories/${sub.id}/attributes`,
                        },
                        { label: 'Delete', Icon: TrashIcon, danger: true, onSelect: () => onDelete(sub) },
                      ]}
                    />
                  </div>
                ) : (
                  <StateDot on={Boolean(sub.active)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
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
  const [imageFile, setImageFile] = useState(null); // uploads with Save
  const [ready, setReady] = useState(null);
  const imageRef = useRef(null);

  // Reset the fields whenever a different row opens the panel.
  if (panel && ready !== (sub?.id ?? 'new')) {
    setReady(sub?.id ?? 'new');
    setName(sub?.name ?? '');
    setType(sub?.type ?? 'goods');
    setOrder(sub?.order ?? '');
    setSynonyms((sub?.synonyms ?? []).join(', '));
    setImageFile(null);
  }

  const submit = () => {
    const body = {
      name,
      ...(order !== '' ? { order: Number(order) } : {}),
      synonyms: synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      ...(editing ? {} : { parentId: top.id, type }),
    };
    onSave(body, imageFile);
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

        {/* §A11: the card image, managed HERE (owner, 2026-08-11) — the list
            rows are display-only. A picked file uploads together with Save. */}
        <Field label="Image" optional helper="Shown on the category card · 5 MB · JPG, PNG or WEBP.">
          {() => (
            <div className="flex items-center gap-3">
              {imageFile ? (
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : sub?.image ? (
                <img src={sub.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <NoImagePanel label={name || 'New'} monogram ratio="h-14 w-14" className="shrink-0 rounded-xl" />
              )}
              <div className="min-w-0">
                <Button size="sm" variant="secondary" onClick={() => imageRef.current?.click()}>
                  <UploadIcon className="mr-1.5 h-4 w-4" />
                  {imageFile || sub?.image ? 'Replace image' : 'Add image'}
                </Button>
                {imageFile && (
                  <p className="mt-1 truncate text-xs text-muted">
                    {imageFile.name} — uploads when you save
                  </p>
                )}
              </div>
              <input
                ref={imageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose category image"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setImageFile(f);
                  e.target.value = '';
                }}
              />
            </div>
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
            {() => (
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Category type">
                {[
                  { value: 'goods', label: 'Goods', desc: 'Physical products' },
                  { value: 'service', label: 'Service', desc: 'Work and expertise' },
                ].map((opt) => {
                  const on = type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setType(opt.value)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        on
                          ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                          : 'border-surface-border bg-white hover:border-primary-400'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-ink-900">{opt.label}</span>
                      <span className="block text-xs text-muted">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        )}

        {/* Position among this top's subs — the server shifts the siblings
            (positional order semantics, 2026-08-14). */}
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="sub-order" className="min-w-0 flex-1 text-sm font-medium text-ink-900">
            Display order
            <span className="block text-xs font-normal text-muted">
              Lower shows first — the others shift around it.
            </span>
          </label>
          <div className="w-20 shrink-0">
            <input
              id="sub-order"
              type="number"
              inputMode="numeric"
              className={inputClasses(false, 'text-center')}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
        </div>

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
