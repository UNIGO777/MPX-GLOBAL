import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { initialsOf, monogramTone } from '../../components/chat/CompanyAvatar.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ImageIcon,
  ChevronRightIcon,
  EyeIcon,
  PlusIcon,
  EyeOffIcon,
  ExternalIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { AddTopCategoryDrawer } from './AddTopCategoryDrawer.jsx';
import { AddressLine, FormStack, ImageTile, KeywordInput, OrderInput, PartLabel } from './categoryFormParts.jsx';
import { slugify } from '../../lib/slug.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { cp } from '../../lib/consolePath.js';

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

/**
 * Live / Hidden as a chip with its word (2026-09-24) — replaces the grey
 * uppercase "INACTIVE" tag, which read as a label rather than a state and
 * said nothing when the category WAS live.
 */
function LiveChip({ on, small = false }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${
        small ? 'px-2 py-px text-[10.5px]' : 'px-2.5 py-0.5 text-[11.5px]'
      } ${on ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-600'}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-success-500' : 'bg-ink-400'}`} />
      {on ? 'Live' : 'Hidden'}
    </span>
  );
}

/** One top-category row (image · name · hidden chip · sub count). */
function TopRowBody({ t, compact = false }) {
  const n = t.subs?.length ?? 0;
  // The desktop rail (2026-09-24): ONE line per category — name, a Hidden chip
  // when off, and the sub count as a small number on the right. Forty two-line
  // rows made the rail a long scroll of repeated "N sub-categories".
  if (compact) {
    return (
      <>
        <CategoryThumb name={t.name} image={t.image} sizeClasses="h-8 w-8" text="text-[11px]" rounded="rounded-lg" />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-ink-900">{t.name}</span>
          {!t.active && <LiveChip on={false} small />}
        </span>
        <span
          title={`${n} sub-categor${n === 1 ? 'y' : 'ies'}`}
          className="shrink-0 rounded-full bg-ink-100 px-2 py-px text-[11px] font-semibold tabular-nums text-ink-600"
        >
          {n}
        </span>
      </>
    );
  }
  return (
    <>
      <CategoryThumb name={t.name} image={t.image} sizeClasses="h-9 w-9" text="text-[12px]" rounded="rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-900">{t.name}</span>
          {!t.active && <LiveChip on={false} small />}
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


/**
 * Category thumbnail — its image, or a TINTED monogram (2026-09-24). Every
 * category used to get the same grey block, so the rail was a column of
 * identical "T7" squares; the tint hashes from the name (same hash as company
 * marks), stable across screens. `object-cover`: these are photos, not logos.
 */
function CategoryThumb({ name, image, sizeClasses, text = 'text-sm', rounded = 'rounded-xl' }) {
  return image ? (
    <img src={image} alt="" className={`${sizeClasses} ${rounded} shrink-0 object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${sizeClasses} ${rounded} ${text} ${monogramTone(name)} flex shrink-0 items-center justify-center font-bold ring-1 ring-inset`}
    >
      {initialsOf(name)}
    </span>
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
  const [addTopOpen, setAddTopOpen] = useState(false); // new top category (2026-09-23)
  const [addTopError, setAddTopError] = useState(null);
  const [cascade, setCascade] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState(null);
  // A notice belongs to the category it was about: it hides when the admin
  // picks another one, on its ✕, or by itself after a few seconds — it used to
  // stay until the next save, long after it stopped being true.
  const [noticeState, setNoticeState] = useState(null); // { text, topId }
  const [railQ, setRailQ] = useState(''); // desktop rail filter

  const tree = useQuery({ queryKey: adminCatalogueKeys.tree, queryFn: adminCatalogueApi.tree });

  // Memoised because `tree.data ?? []` produces a NEW array on every render
  // while the query is loading, which re-ran every downstream memo with it.
  const tops = useMemo(() => tree.data ?? [], [tree.data]);
  const selectedId = params.get('top') ?? tops[0]?.id;
  const top = useMemo(() => tops.find((t) => t.id === selectedId), [tops, selectedId]);
  const railNorm = railQ.trim().toLowerCase();
  const railTops = railNorm
    ? tops.filter((t) => `${t.name} ${(t.synonyms ?? []).join(' ')}`.toLowerCase().includes(railNorm))
    : tops;

  useEffect(() => {
    const previous = document.title;
    document.title = 'Categories — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const setNotice = (text, topId = selectedId) => setNoticeState(text ? { text, topId } : null);
  // Guard on noticeState itself: while the tree loads selectedId is undefined,
  // and `undefined === undefined` would read .text off null.
  const notice = noticeState && noticeState.topId === selectedId ? noticeState.text : null;

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
    // The settings drawer can now carry a new image too (2026-09-24) — it
    // uploads with Save, the same way a sub-category's panel does.
    mutationFn: async ({ id, body, imageFile }) => {
      const saved = body ? await adminCatalogueApi.update(id, body) : null;
      if (imageFile) await adminCatalogueApi.uploadImage(id, imageFile);
      return saved;
    },
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
  // New TOP category (owner-approved 2026-09-23). Create, then upload the
  // image if one was picked (a new category has no id until create returns),
  // then select it so the admin lands where the next step — a sub-category — is.
  const createTop = useMutation({
    mutationFn: async ({ body, imageFile }) => {
      const created = await adminCatalogueApi.createTop(body);
      if (imageFile) await adminCatalogueApi.uploadImage(created.id, imageFile);
      return created;
    },
    onMutate: () => { setAddTopError(null); setNotice(null); },
    onSuccess: (created, vars) => {
      vars.reset();
      setAddTopOpen(false);
      refresh();
      setParams({ top: created.id });
      setNotice(
        `${created.name} created at /category/${created.slug}. It's switched off — add a sub-category, then switch it on.`,
        created.id,
      );
    },
    onError: (err) => setAddTopError(err?.response?.data?.error?.message ?? 'Could not create the category.'),
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
      <header className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Categories</h1>
            {tree.isSuccess && (
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                {tops.length} categories
              </span>
            )}
          </div>
          <p className="mt-1 hidden text-sm text-muted sm:block">
            What buyers browse by. Products live in the sub-categories.
          </p>
        </div>
        {/* The ONE "New category" control, on the title row at every width
            (owner, 2026-09-24: as the rail's last row it went unnoticed). */}
        {canManage && tree.isSuccess && (
          <button
            type="button"
            onClick={() => setAddTopOpen(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20"
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New category</span>
          </button>
        )}
      </header>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {notice && (
        <FlashMessage tone="info" className="mb-5" onDismiss={() => setNoticeState(null)}>
          {notice}
        </FlashMessage>
      )}

      {tree.isPending && <SkeletonRows rows={8} />}
      {tree.isError && <ErrorState onRetry={tree.refetch} />}

      {tree.isSuccess && (
        <div className="flex flex-col gap-5 xl:flex-row">
          {/* --- Left: the 40 tops, inactive ones included. Phones: a compact
              selector that opens a SEARCHABLE SHEET (a swipe strip was
              unusable at 40 entries — owner, 2026-08-11); lg+: the vertical
              rail. --- */}
          <div className="xl:hidden">
            {/* Below xl: a labelled SELECT-style field (owner's pick,
                2026-09-24, after a switcher on the hero went unnoticed). It
                opens the searchable sheet — 40 entries don't fit a native
                select usefully. */}
            {top && (
              <>
                <p id="cat-picker-label" className="mb-1.5 text-[12px] font-semibold text-ink-600">Category</p>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  aria-haspopup="dialog"
                  aria-labelledby="cat-picker-label cat-picker-value"
                  className="flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-2.5 pr-3 text-left shadow-sm transition-colors hover:border-ink-300 focus:border-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-600/10"
                >
                  <span id="cat-picker-value" className="flex min-w-0 flex-1 items-center gap-3">
                    <TopRowBody t={top} />
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                    <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </>
            )}
            {/* No separate "add sub-category" here any more (owner, 2026-09-24):
                it was added when the inline settings card pushed the SubList
                button a viewport down (QA, 2026-08-14). Settings is a drawer
                now, so that button sits right under the header — two was noise.
                "New category" lives in the title row on these widths. */}
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

          <aside className="hidden self-start xl:sticky xl:top-4 xl:block xl:w-80 xl:shrink-0">
            {/* The rail as ONE card with its own search (2026-09-24) — the list
                grows to 40, and the phone sheet already had a search. Matches
                on names AND keywords, like the sheet. */}
            <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
              <div className="relative border-b border-surface-border p-2.5">
                <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Filter categories"
                  placeholder={`Filter ${tops.length} categories…`}
                  value={railQ}
                  onChange={(e) => setRailQ(e.target.value)}
                  className="h-9 w-full rounded-full border border-ink-200 bg-white pl-9 pr-3 text-[13px] text-ink-900 placeholder:text-ink-500 hover:border-ink-300 focus:border-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-600/10"
                />
              </div>
              <ul className="max-h-[65vh] divide-y divide-surface-border overflow-y-auto">
                {railTops.length === 0 && (
                  <li className="px-4 py-6 text-center text-[13px] text-muted">
                    No category matches &ldquo;{railQ.trim()}&rdquo;.
                  </li>
                )}
                {railTops.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setParams({ top: t.id })}
                        aria-current={active || undefined}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          active
                            ? 'bg-primary-50/70 shadow-[inset_3px_0_0_theme(colors.primary.600)]'
                            : 'hover:bg-ink-50'
                        } ${t.active ? '' : 'opacity-60'}`}
                      >
                        <TopRowBody t={t} compact />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
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
                  onSettings={() => { setError(null); setSettingsOpen(true); }}
                />

                {/* 2026-08-14 restructure: the settings form is no longer page
                    furniture. Sub-categories — the daily surface — get the full
                    width; name/order/keywords open in a DRAWER from the header,
                    the same pattern a sub-category already edits with. */}
                <SubList
                  key={`l-${top.id}`}
                  top={top}
                  canManage={canManage}
                  busyId={busyId}
                  onAdd={() => { setError(null); setPanel({ mode: 'create' }); }}
                  onEdit={(sub) => { setError(null); setPanel({ mode: 'edit', sub }); }}
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
                  error={error}
                  onSave={(body, imageFile) =>
                    saveTop.mutate(
                      { id: top.id, body, imageFile },
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
        error={error}
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
      <AddTopCategoryDrawer
        open={addTopOpen}
        onClose={() => { setAddTopOpen(false); setAddTopError(null); }}
        saving={createTop.isPending}
        error={addTopError}
        onSave={(body, imageFile, reset) => createTop.mutate({ body, imageFile, reset })}
      />
    </AdminLayout>
  );
}

/**
 * The selected category as a HERO (owner, 2026-09-24: "still not that
 * impressive"). Its own photo becomes a cover banner with the name over it —
 * the categories carry real images, and a 64px thumbnail wasted them. No image:
 * the category's tint as a soft banner. "Change image" on the banner is the
 * §A20 upload control (instant upload, as before). Below: a numbers strip and
 * the master switch with its consequence written beside it.
 */
function TopHeader({ top, canManage, uploading, busy, onUpload, onToggle, onSettings }) {
  const subs = top.subs ?? [];
  const liveSubs = subs.filter((s) => s.active).length;
  const fieldCount = subs.reduce((n, s) => n + (s.attributeCount ?? 0), 0);
  const fileRef = useRef(null);

  const stats = [
    { label: subs.length === 1 ? 'Sub-category' : 'Sub-categories', value: subs.length },
    { label: 'Live', value: liveSubs },
    { label: fieldCount === 1 ? 'Field' : 'Fields', value: fieldCount },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
      <div className={`relative h-36 sm:h-40 ${top.image ? 'bg-ink-900' : monogramTone(top.name)}`}>
        {top.image ? (
          <img
            src={top.image}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover ${top.active ? '' : 'grayscale'}`}
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute right-6 top-1/2 -translate-y-1/2 select-none text-7xl font-black opacity-20 sm:text-8xl"
          >
            {initialsOf(top.name)}
          </span>
        )}
        {/* Legibility scrim — the name sits on the photo's darkest band. */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${
            top.image ? 'bg-gradient-to-t from-black/75 via-black/25 to-black/10' : 'bg-gradient-to-t from-black/10 to-transparent'
          }`}
        />

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-semibold text-ink-800 shadow-sm backdrop-blur transition-colors hover:bg-white disabled:opacity-70"
            >
              {uploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-ink-700" />
              ) : (
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{top.image ? 'Change image' : 'Add image'}</span>
              <span className="sr-only sm:hidden">{top.image ? 'Change image' : 'Add image'}</span>
            </button>
          )}
          {/* Read-only staff get Settings too (fields render disabled there,
              keeping the keyword list browsable). */}
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-semibold text-ink-800 shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            <SettingsIcon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sr-only sm:hidden">Settings for {top.name}</span>
          </button>
        </div>
        {canManage && (
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
        )}

        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6 sm:pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`min-w-0 break-words text-xl font-bold leading-tight sm:text-2xl ${
                top.image ? 'text-white drop-shadow-sm' : 'text-ink-900'
              }`}
            >
              {top.name}
            </h2>
            <LiveChip on={top.active} />
          </div>
          {top.slug && (
            <p className="mt-1 min-w-0">
              {/* The public page exists only while the category is live —
                  a hidden one would open a 404, so it stays plain text. */}
              {top.active ? (
                <a
                  href={`/category/${top.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex max-w-full items-center gap-1 font-mono text-[12px] hover:underline ${
                    top.image ? 'text-white/85' : 'text-primary-700'
                  }`}
                >
                  <span className="truncate">/category/{top.slug}</span>
                  <ExternalIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              ) : (
                <span className={`inline-block max-w-full truncate font-mono text-[12px] ${top.image ? 'text-white/70' : 'text-ink-600'}`}>
                  /category/{top.slug}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Numbers strip + the master switch, side by side only from 2xl — at
          lg the switch squeezed the labels to "Sub-categori…". */}
      <div className="grid 2xl:grid-cols-[minmax(0,1fr)_auto]">
        <dl className="grid grid-cols-3 divide-x divide-surface-border">
          {stats.map((st) => (
            <div key={st.label} className="min-w-0 px-3.5 py-2 sm:px-5 sm:py-3">
              <dd className={`text-base font-bold sm:text-xl tabular-nums leading-tight ${st.value ? 'text-ink-900' : 'text-ink-400'}`}>
                {st.value}
              </dd>
              <dt className="truncate text-[11px] font-medium text-muted sm:text-[12px]">{st.label}</dt>
            </div>
          ))}
        </dl>
        {canManage ? (
          <div
            className={`flex items-center justify-between gap-4 border-t border-surface-border px-4 py-3 sm:px-5 2xl:border-l 2xl:border-t-0 ${
              top.active ? 'bg-success-50/40' : 'bg-ink-50/70'
            }`}
          >
            <p className="flex min-w-0 items-start gap-2.5 text-[13px] leading-snug">
              {top.active ? (
                <EyeIcon className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
              ) : (
                <EyeOffIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
              )}
              <span>
                <span className="block font-semibold text-ink-900">
                  {top.active ? 'Live in the catalogue' : 'Hidden from the catalogue'}
                </span>
                <span className="block text-xs text-muted">
                  {top.active
                    ? 'Buyers can browse it and everything inside.'
                    : 'Every sub-category and product inside is hidden too.'}
                </span>
              </span>
            </p>
            <Switch
              checked={top.active}
              busy={busy || uploading}
              onChange={onToggle}
              label={top.active ? `Turn ${top.name} off` : `Turn ${top.name} on`}
            />
          </div>
        ) : (
          <div className="flex items-center border-t border-surface-border px-4 py-3 sm:px-5 2xl:border-l 2xl:border-t-0">
            <StateDot on={top.active} onWord="Live" offWord="Hidden" />
          </div>
        )}
      </div>
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
function TopSettingsBody({ top, onClose, canManage, saving, error, onSave }) {
  const [name, setName] = useState(top.name);
  const [order, setOrder] = useState(top.order ?? '');
  const [synonyms, setSynonyms] = useState(top.synonyms ?? []);
  const [imageFile, setImageFile] = useState(null); // uploads with Save

  const fieldsDirty =
    name.trim() !== top.name ||
    String(order) !== String(top.order ?? '') ||
    JSON.stringify(synonyms) !== JSON.stringify(top.synonyms ?? []);
  const dirty = fieldsDirty || Boolean(imageFile);
  const subs = top.subs ?? [];

  return (
    <Drawer
      open
      onClose={onClose}
      icon={SettingsIcon}
      title="Category settings"
      subtitle={top.name}
      footer={
        canManage ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={!dirty || !name.trim()}
              loading={saving}
              onClick={() =>
                onSave(
                  // Only send the PATCH when a field moved — an image-only
                  // save should not write an empty update to the audit log.
                  fieldsDirty ? { name: name.trim(), synonyms, ...(order !== '' ? { order: Number(order) } : {}) } : null,
                  imageFile,
                )
              }
            >
              Save changes
            </Button>
          </>
        ) : null
      }
    >
      <FormStack>
        {error && <Alert tone="danger">{error}</Alert>}

        {/* What is being edited, at a glance (2026-09-24). */}
        <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-ink-50/60 p-3">
          <CategoryThumb name={top.name} image={top.image} sizeClasses="h-12 w-12" text="text-[15px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink-900">{top.name}</p>
            <p className="text-xs text-muted">
              {subs.length} sub-categor{subs.length === 1 ? 'y' : 'ies'} · {subs.filter((x) => x.active).length} live
            </p>
          </div>
          <LiveChip on={top.active} />
        </div>

        <div>
          <Field label="Category name">
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
          {/* A6: the slug is immutable — a rename never breaks the URL. Said up
              front, so the lock explains itself before anyone wonders. */}
          <AddressLine path={`/category/${top.slug}`} note="Stays the same when you rename, so existing links keep working." />
        </div>

        <OrderInput id="top-order" value={order} onChange={setOrder} disabled={!canManage} />

        <KeywordInput
          id="top-synonyms"
          value={synonyms}
          onChange={setSynonyms}
          disabled={!canManage}
          subject={top.name}
          placeholder="e.g. medicine, pharma, dawai"
        />

        {/* The image, here too (2026-09-24): the card's tile uploads at once;
            this uploads with Save. Same endpoint (§A20), so they cannot
            disagree — the last upload wins either way. */}
        <ImageTile file={imageFile} current={top.image} onPick={setImageFile} disabled={!canManage} />
      </FormStack>
    </Drawer>
  );
}

/** Gate: mounting only while open is what makes the body's initial state the
 *  fresh copy of `top`. */
function TopSettings({ open, ...props }) {
  if (!open) return null;
  return <TopSettingsBody {...props} />;
}


const SUB_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'off', label: 'Off' },
  { key: 'nofields', label: 'Needs fields' },
];

/**
 * The sub-categories as compact TILES (owner, 2026-09-24 — the photo-card grid
 * "not looking good": a storefront, not a manager). Two per row: a small image,
 * the name (click = edit), one line of facts, the switch and the ⋮ menu. Goods
 * is the norm and goes unmarked in a chip; only Service gets one. A filter row
 * finds what needs work — hidden subs, subs with no fields.
 *
 * While the parent is OFF the switches set RESTORE INTENT (`prevActive`), and
 * the banner above the tiles is what makes that legible — nothing visible
 * changes on a tile when the intent flips, so without it the control looks
 * broken.
 */
function SubList({ top, canManage, busyId, onAdd, onEdit, onToggle, onDelete }) {
  const subs = top.subs ?? [];
  const parentOff = !top.active;
  const [filter, setFilter] = useState('all');

  // Parent off → the switch binds to RESTORE INTENT, not visibility.
  const isOn = (sub) => (parentOff ? sub.prevActive !== false : Boolean(sub.active));
  const counts = {
    all: subs.length,
    live: subs.filter(isOn).length,
    off: subs.filter((x) => !isOn(x)).length,
    nofields: subs.filter((x) => !x.attributeCount).length,
  };
  const shown = subs.filter((x) =>
    filter === 'live' ? isOn(x) : filter === 'off' ? !isOn(x) : filter === 'nofields' ? !x.attributeCount : true,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
      {/* Title + Add on one row, the filter on its own row below — at every
          width (2026-09-24: squeezed between them on a big screen it looked
          off). The filter uses the site's segmented style; Add is a plain
          solid button — no shadow, no tint. */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-surface-border px-4 py-3 sm:px-5">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
          Sub-categories
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{subs.length}</span>
        </h3>
        {canManage && (
          <button type="button" onClick={onAdd} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20 ml-auto">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add sub-category</span>
          </button>
        )}
        {subs.length > 0 && (
          <div
            role="group"
            aria-label="Show"
            className="scrollbar-none flex w-full overflow-x-auto"
          >
            <div className="inline-flex rounded-full border border-ink-200 bg-white p-0.5">
              {SUB_FILTERS.map((f) => {
                const on = filter === f.key;
                const warn = f.key === 'nofields' && counts.nofields > 0;
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(f.key)}
                    className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold transition-colors ${
                      on ? 'bg-primary-600 text-white' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                    }`}
                  >
                    {f.label}
                    <span
                      className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                        on ? 'bg-white/20 text-white' : warn ? 'bg-warning-100 text-warning-800' : 'bg-ink-100 text-ink-500'
                      }`}
                    >
                      {counts[f.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {parentOff && (
        <div className="flex gap-3 border-b border-warning-100 bg-warning-50 px-4 py-3 sm:px-5">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-ink-900">
            <span className="font-semibold">{top.name} is switched off</span> — everything below is
            hidden right now. The switches set what comes back when you reactivate it.
          </p>
        </div>
      )}

      {subs.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink-900">No sub-categories yet</p>
          <p className="mt-1 text-[13px] text-muted">
            Products are listed inside sub-categories{canManage ? ' — add the first one to open this category up.' : '.'}
          </p>
          {canManage && (
            <Button size="sm" variant="secondary" className="mt-4" onClick={onAdd}>
              + Add sub-category
            </Button>
          )}
        </div>
      ) : shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">Nothing here — try another filter.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-surface-border md:grid-cols-2 md:gap-2.5 md:divide-y-0 md:p-4">
          {shown.map((sub) => {
            const checked = isOn(sub);
            const fields = sub.attributeCount ?? 0;
            return (
              <li
                key={sub.id}
                // Phones: plain divided rows (a bordered tile inside the bordered
                // card read as boxes-in-boxes). md+: the tiles.
                className={`flex items-center gap-3 px-4 py-3 pr-2 transition-colors md:rounded-xl md:border md:p-2.5 md:pr-2 ${
                  checked
                    ? 'bg-white md:border-surface-border md:hover:border-ink-300'
                    : 'bg-ink-50/60 md:border-dashed md:border-ink-200'
                }`}
              >
                <span className={checked ? '' : 'opacity-50 grayscale'}>
                  <CategoryThumb name={sub.name} image={sub.image} sizeClasses="h-14 w-14" text="text-[15px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => onEdit(sub)}
                        className={`line-clamp-2 min-w-0 text-left text-[14px] font-semibold leading-snug hover:text-primary-700 hover:underline ${
                          checked ? 'text-ink-900' : 'text-ink-500'
                        }`}
                      >
                        {sub.name}
                      </button>
                    ) : (
                      <p className={`line-clamp-2 min-w-0 text-[14px] font-semibold leading-snug ${checked ? 'text-ink-900' : 'text-ink-500'}`}>
                        {sub.name}
                      </p>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                    {/* No fields = sellers get only the standard form; amber so
                        it reads as a to-do, not a count. */}
                    <Link
                      to={cp(`/admin/categories/${sub.id}/attributes`)}
                      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-px font-semibold transition-colors ${
                        fields ? 'bg-ink-100 text-ink-700 hover:bg-ink-200' : 'bg-warning-50 text-warning-800 hover:bg-warning-100'
                      }`}
                    >
                      {fields ? `${fields} field${fields === 1 ? '' : 's'}` : 'Add fields'}
                      <ChevronRightIcon className="h-3 w-3" aria-hidden="true" />
                    </Link>
                    {sub.type === 'service' && <span className="font-semibold text-warning-800">Service</span>}
                    {sub.order != null && <span className="tabular-nums">#{sub.order}</span>}
                    {parentOff ? (
                      <span>{checked ? 'Returns with parent' : 'Stays off'}</span>
                    ) : (
                      !checked && <span className="font-semibold text-ink-500">Off</span>
                    )}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex shrink-0 items-center gap-0.5">
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
                        { label: 'Manage fields', Icon: ListIcon, to: cp(`/admin/categories/${sub.id}/attributes`) },
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

const SUB_TYPES = [
  { value: 'goods', label: 'Goods', desc: 'Physical products' },
  { value: 'service', label: 'Service', desc: 'Work and expertise' },
];

/** Create / edit a sub-category. Slug and type lock once they matter. */
function SubPanel({ panel, top, saving, error, onClose, onSave }) {
  const editing = panel?.mode === 'edit';
  const sub = panel?.sub;
  const [name, setName] = useState('');
  const [type, setType] = useState('goods');
  const [order, setOrder] = useState('');
  const [synonyms, setSynonyms] = useState([]);
  const [imageFile, setImageFile] = useState(null); // uploads with Save
  const [ready, setReady] = useState(null);

  // Reset the fields whenever a different row opens the panel.
  if (panel && ready !== (sub?.id ?? 'new')) {
    setReady(sub?.id ?? 'new');
    setName(sub?.name ?? '');
    setType(sub?.type ?? 'goods');
    setOrder(sub?.order ?? '');
    setSynonyms(sub?.synonyms ?? []);
    setImageFile(null);
  }
  const close = () => {
    setReady(null);
    onClose();
  };

  const submit = () => {
    const body = {
      name: name.trim(),
      ...(order !== '' ? { order: Number(order) } : {}),
      synonyms,
      ...(editing ? {} : { parentId: top.id, type }),
    };
    onSave(body, imageFile);
  };

  const slug = editing ? sub.slug : slugify(name);

  return (
    <Drawer
      open={Boolean(panel)}
      onClose={close}
      icon={ListIcon}
      title={editing ? 'Edit sub-category' : 'Add sub-category'}
      subtitle={editing ? `${sub?.name} · in ${top?.name}` : `Inside ${top?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit} disabled={!name.trim()}>
            {editing ? 'Save changes' : 'Add sub-category'}
          </Button>
        </>
      }
    >
      <FormStack>
        {error && <Alert tone="danger">{error}</Alert>}

        <div>
          <Field label="Sub-category name">
            {(id, hasError) => (
              <input
                id={id}
                className={inputClasses(hasError)}
                maxLength={120}
                placeholder="e.g. Board games"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={!editing}
              />
            )}
          </Field>
          {/* The server assigns the slug once and never changes it; a clash gets
              a short suffix (SEO §1), so a new one is a preview, not a promise. */}
          <AddressLine
            path={`/category/${slug || 'your-sub-category'}`}
            note={
              editing
                ? 'Stays the same when you rename, so existing links keep working.'
                : 'Set when you save. If the address is taken, a short code is added to the end.'
            }
          />
        </div>

        {/* 🔴 Type is set at create. The server locks it once products exist, so
            editing shows it read-only rather than offering a change that 409s. */}
        <div>
          <PartLabel>Type</PartLabel>
          {editing ? (
            <div className="rounded-xl border border-surface-border bg-ink-50 px-4 py-3">
              <span className="block text-sm font-semibold text-ink-900">
                {sub.type === 'service' ? 'Service' : 'Goods'}
              </span>
              <span className="block text-xs text-muted">Can&apos;t change once products use this category.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Category type">
                {SUB_TYPES.map((opt) => {
                  const on = type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setType(opt.value)}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                        on
                          ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                          : 'border-surface-border bg-white hover:border-primary-400'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          on ? 'border-primary-600' : 'border-ink-300'
                        }`}
                      >
                        {on && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">{opt.label}</span>
                        <span className="block text-xs text-muted">{opt.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Decides which fields sellers are asked for. Can&apos;t be changed once products use it.
              </p>
            </>
          )}
        </div>

        {/* §A11: the card image, managed HERE (owner, 2026-08-11) — the list
            rows are display-only. A picked file uploads together with Save. */}
        <ImageTile file={imageFile} current={sub?.image} onPick={setImageFile} />

        {/* Position among this top's subs — the server shifts the siblings
            (positional order semantics, 2026-08-14). */}
        <OrderInput id="sub-order" value={order} onChange={setOrder} />

        <KeywordInput
          id="sub-synonyms"
          value={synonyms}
          onChange={setSynonyms}
          subject={name.trim() || undefined}
          placeholder="e.g. chess, carrom, ludo"
        />
      </FormStack>
    </Drawer>
  );
}
