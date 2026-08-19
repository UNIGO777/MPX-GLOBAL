import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { featuredApi, featuredKeys } from '../../api/featured.js';
import { catalogueApi } from '../../api/catalogue.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { FileDrop } from '../../components/ui/FileDrop.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { apiError, formatDate } from '../../lib/format.js';
import {
  BoxIcon,
  BuildingIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  TagIcon,
  TrashIcon,
} from '../../components/ui/icons.jsx';

/**
 * M6 screen 3 — the featured content manager (`/admin/featured`), FINALIZE F5b.
 *
 * Four kinds — banner · product · category · supplier — each an ordered list.
 * The landing page reads the same rows through `GET /public/featured`.
 *
 * 🔑 THE POINTER RULE shapes everything here. A featured row stores a
 * reference, never a copy:
 *  - each row shows a LIVE resolution of its target (`target` + `targetLive`
 *    from the admin view). A target that stopped qualifying — taken down,
 *    blocked, deactivated — has already left the landing page on its own; the
 *    row here just says so.
 *  - kind and target are NOT editable. The server refuses repointing, so there
 *    is no "change target" control — the affordance is delete + add.
 *
 * Verification is NOT a gate (B7): an unverified supplier may be curated with
 * no warning friction. The tick renders if they have it; absence is the only
 * other state.
 *
 * Gate: `featured:manage` (grantable). Every action writes an AuditLog row.
 */
const KINDS = [
  {
    kind: 'banner',
    title: 'Banners',
    Icon: ImageIcon,
    blurb: 'The hero strip — image, headline, destination.',
  },
  {
    kind: 'product',
    title: 'Products',
    Icon: BoxIcon,
    blurb: 'Shown with the same public card as everywhere else.',
  },
  { kind: 'category', title: 'Categories', Icon: TagIcon, blurb: 'Photo tiles, like /categories.' },
  {
    kind: 'supplier',
    title: 'Suppliers',
    Icon: BuildingIcon,
    blurb: 'Company cards with live listing counts.',
  },
];

const dtInput =
  'h-11 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20';

/** datetime-local value → ISO, or undefined when the field is empty. */
const toIso = (v) => (v ? new Date(v).toISOString() : undefined);

/** Shared curation inputs (order + schedule) for both create dialogs. */
function CurationFields({ order, setOrder, startsAt, setStartsAt, endsAt, setEndsAt }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Order" helper="0 shows first; ties break newest-first" optional>
        {(id) => (
          <input
            id={id}
            type="number"
            min="0"
            max="9999"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className={inputClasses(false)}
          />
        )}
      </Field>
      <div />
      <Field label="Starts at" optional>
        {(id) => (
          <input id={id} type="datetime-local" value={startsAt} max={endsAt || undefined} onChange={(e) => setStartsAt(e.target.value)} className={dtInput} />
        )}
      </Field>
      <Field label="Ends at" optional>
        {(id) => (
          <input id={id} type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} className={dtInput} />
        )}
      </Field>
    </div>
  );
}

/** Create a banner — multipart, the image rides with the create. */
function AddBannerModal({ open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [order, setOrder] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const create = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('image', file);
      if (title.trim()) fd.append('title', title.trim());
      if (subtitle.trim()) fd.append('subtitle', subtitle.trim());
      if (linkUrl.trim()) fd.append('linkUrl', linkUrl.trim());
      if (order !== '') fd.append('order', order);
      if (startsAt) fd.append('startsAt', toIso(startsAt));
      if (endsAt) fd.append('endsAt', toIso(endsAt));
      return featuredApi.createBanner(fd);
    },
    onSuccess: onDone,
  });

  return (
    <Modal open={open} onClose={onClose} title="Add a banner">
      <div className="space-y-4">
        {create.error && <Alert tone="danger">{apiError(create.error).message}</Alert>}

        <Field label="Image">
          {() => <FileDrop file={file} accept="image/*" onPick={setFile} />}
        </Field>
        <Field label="Title" optional trailing={<span className="text-xs text-muted">{120 - title.length} left</span>}>
          {(id) => (
            <input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClasses(false)} />
          )}
        </Field>
        <Field label="Subtitle" optional trailing={<span className="text-xs text-muted">{240 - subtitle.length} left</span>}>
          {(id) => (
            <input id={id} value={subtitle} maxLength={240} onChange={(e) => setSubtitle(e.target.value)} className={inputClasses(false)} />
          )}
        </Field>
        <Field label="Link" helper="A relative path (/category/textiles) or a full http(s) URL — nothing else is accepted" optional>
          {(id) => (
            <input id={id} value={linkUrl} maxLength={500} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/search?q=cotton" className={inputClasses(false, 'font-mono text-[13px]')} />
          )}
        </Field>
        <CurationFields {...{ order, setOrder, startsAt, setStartsAt, endsAt, setEndsAt }} />

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button loading={create.isPending} disabled={!file} onClick={() => create.mutate()}>
            Add banner
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Edit a banner's text/link (curation PATCH — the image has its own action). */
function EditBannerModal({ row, onClose, onDone }) {
  const [title, setTitle] = useState(row?.title ?? '');
  const [subtitle, setSubtitle] = useState(row?.subtitle ?? '');
  const [linkUrl, setLinkUrl] = useState(row?.linkUrl ?? '');

  const save = useMutation({
    mutationFn: () =>
      featuredApi.update(row.id, {
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        linkUrl: linkUrl.trim() || null,
      }),
    onSuccess: onDone,
  });

  return (
    <Modal open={Boolean(row)} onClose={onClose} title="Edit banner">
      <div className="space-y-4">
        {save.error && <Alert tone="danger">{apiError(save.error).message}</Alert>}
        <Field label="Title" optional trailing={<span className="text-xs text-muted">{120 - title.length} left</span>}>
          {(id) => <input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClasses(false)} />}
        </Field>
        <Field label="Subtitle" optional trailing={<span className="text-xs text-muted">{240 - subtitle.length} left</span>}>
          {(id) => <input id={id} value={subtitle} maxLength={240} onChange={(e) => setSubtitle(e.target.value)} className={inputClasses(false)} />}
        </Field>
        <Field label="Link" helper="A relative path or a full http(s) URL" optional>
          {(id) => <input id={id} value={linkUrl} maxLength={500} onChange={(e) => setLinkUrl(e.target.value)} className={inputClasses(false, 'font-mono text-[13px]')} />}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Pick an existing product / category / supplier. Products and suppliers come
 * from the PUBLIC search (the same corpus the landing page resolves against);
 * categories from the public tree. No admin permission beyond featured:manage
 * is needed to curate, so no admin list is queried here.
 */
function AddTargetModal({ kind, onClose, onDone }) {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [picked, setPicked] = useState(null);
  const [order, setOrder] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const isCategory = kind === 'category';
  const search = useQuery({
    queryKey: ['admin', 'featured-pick', kind, submitted],
    queryFn: () =>
      catalogueApi.search({ q: submitted, type: kind === 'supplier' ? 'supplier' : 'product', pageSize: 8 }),
    enabled: !isCategory && submitted.length > 0,
  });
  const tree = useQuery({
    queryKey: ['catalogue', 'tree'],
    queryFn: catalogueApi.tree,
    enabled: isCategory,
  });

  const candidates = useMemo(() => {
    if (isCategory) {
      const flat = (tree.data ?? []).flatMap((top) => [top, ...(top.subs ?? [])]);
      const needle = q.trim().toLowerCase();
      return flat
        .filter((c) => !needle || c.name.toLowerCase().includes(needle))
        .slice(0, 12)
        .map((c) => ({ id: c.id, name: c.name, image: c.image ?? null, meta: c.parentId ? 'sub-category' : 'top category' }));
    }
    if (kind === 'supplier') {
      return (search.data?.suppliers ?? []).map((s) => ({
        id: s.id, name: s.name, image: s.logo ?? null, verified: s.verified, meta: s.country ?? '',
      }));
    }
    return (search.data?.products ?? []).map((p) => ({
      id: p.id, name: p.name, image: p.images?.[0] ?? null, meta: p.seller?.name ?? '',
    }));
  }, [isCategory, kind, q, tree.data, search.data]);

  const create = useMutation({
    mutationFn: () =>
      featuredApi.create({
        kind,
        targetId: picked.id,
        ...(order !== '' ? { order: Number(order) } : {}),
        ...(startsAt ? { startsAt: toIso(startsAt) } : {}),
        ...(endsAt ? { endsAt: toIso(endsAt) } : {}),
      }),
    onSuccess: onDone,
  });

  const noun = kind === 'supplier' ? 'supplier' : kind;

  return (
    <Modal open onClose={onClose} title={`Feature a ${noun}`}>
      <div className="space-y-4">
        {create.error && <Alert tone="danger">{apiError(create.error).message}</Alert>}

        {picked ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/50 p-3">
            {picked.image ? (
              <img src={picked.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-sm font-bold text-ink-500">
                {picked.name?.[0] ?? '?'}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate font-semibold text-ink-900">
                {picked.name}
                {picked.verified && <VerifiedTick verified compact />}
              </span>
              {picked.meta && <span className="block truncate text-xs text-muted">{picked.meta}</span>}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
          </div>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(q.trim());
              }}
              className="relative"
            >
              <label htmlFor="feat-pick" className="sr-only">Search</label>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input
                id="feat-pick"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={isCategory ? 'Filter categories' : `Search ${noun}s by name`}
                className="h-11 w-full rounded-lg border border-surface-border bg-white pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                autoFocus
              />
            </form>

            {(isCategory ? tree.isLoading : search.isFetching) && <SkeletonRows rows={3} />}
            {!isCategory && !submitted && (
              <p className="text-sm text-muted">Search the public catalogue, then pick a result.</p>
            )}
            {candidates.length > 0 && (
              <ul className="max-h-64 divide-y divide-surface-border overflow-y-auto rounded-xl border border-surface-border">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(c)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary-50/50"
                    >
                      {c.image ? (
                        <img src={c.image} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-sm font-bold text-ink-500">
                          {c.name?.[0] ?? '?'}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink-900">
                          {c.name}
                          {c.verified && <VerifiedTick verified compact />}
                        </span>
                        {c.meta && <span className="block truncate text-xs text-muted">{c.meta}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!isCategory && submitted && !search.isFetching && candidates.length === 0 && (
              <p className="text-sm text-muted">Nothing found for “{submitted}”.</p>
            )}
          </>
        )}

        <CurationFields {...{ order, setOrder, startsAt, setStartsAt, endsAt, setEndsAt }} />

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button loading={create.isPending} disabled={!picked} onClick={() => create.mutate()}>
            Feature it
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** One curation slot. */
function FeaturedRow({ row, onPatch, patching, onDelete, onEditBanner, onReplaceImage, onPreview }) {
  const isBanner = row.kind === 'banner';
  const gone = !isBanner && !row.target;
  const offLanding = !isBanner && row.target && !row.targetLive;
  const name = isBanner ? (row.title || 'Untitled banner') : (row.target?.name ?? 'Deleted target');
  const image = isBanner ? row.image : row.target?.image;

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap ${gone ? 'opacity-60' : ''}`}>
      {image && isBanner ? (
        <button
          type="button"
          onClick={() => onPreview(row)}
          aria-label={`Preview ${name}`}
          title="Click to preview"
          className="group/thumb relative shrink-0 overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <img src={image} alt="" className="h-12 w-20 object-cover transition-transform group-hover/thumb:scale-105 motion-reduce:transition-none" />
          <span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/thumb:bg-ink-900/45 group-hover/thumb:opacity-100">
            View
          </span>
        </button>
      ) : image ? (
        <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-sm font-bold text-ink-500">
          {name?.[0] ?? '?'}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {isBanner && row.subtitle && <span className="truncate">{row.subtitle}</span>}
          {isBanner && row.linkUrl && <code className="truncate font-mono text-[11px] text-ink-500">{row.linkUrl}</code>}
          {!isBanner && row.target?.slug && <code className="font-mono text-[11px] text-ink-500">{row.target.slug}</code>}
          {(row.startsAt || row.endsAt) && (
            <span>
              {row.startsAt ? `from ${formatDate(row.startsAt)}` : ''}
              {row.startsAt && row.endsAt ? ' ' : ''}
              {row.endsAt ? `until ${formatDate(row.endsAt)}` : ''}
            </span>
          )}
        </p>
        {gone && (
          <p className="mt-1 text-xs font-medium text-danger-700">
            This {row.kind} no longer exists — it left the landing page on its own. Remove the slot.
          </p>
        )}
        {offLanding && (
          <p className="mt-1 text-xs font-medium text-warning-800">
            Not shown on the landing page right now — taken down, blocked or deactivated. It returns
            by itself if the {row.kind} comes back.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          <span className="sr-only sm:not-sr-only">Order</span>
          <input
            type="number"
            min="0"
            max="9999"
            defaultValue={row.order}
            key={`${row.id}-${row.order}`}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 0 && v !== row.order) onPatch(row.id, { order: v });
            }}
            className="h-9 w-16 rounded-lg border border-surface-border bg-white px-2 text-center text-sm tabular-nums text-ink-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            aria-label={`Order for ${name}`}
          />
        </label>
        <Switch
          checked={row.active}
          busy={patching === row.id}
          onChange={(checked) => onPatch(row.id, { active: checked })}
          label={`${row.active ? 'Deactivate' : 'Activate'} ${name}`}
        />
        {isBanner && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onEditBanner(row)}>Edit</Button>
            <label className="cursor-pointer text-[13px] font-semibold text-primary-700 hover:underline">
              Replace image
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && onReplaceImage(row.id, e.target.files[0])}
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() => onDelete(row)}
          aria-label={`Remove ${name}`}
          className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-700"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export function Featured() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: featuredKeys.admin, queryFn: featuredApi.list });
  const [adding, setAdding] = useState(null); // kind being added
  const [editing, setEditing] = useState(null); // banner row being edited
  const [deleting, setDeleting] = useState(null); // row pending delete confirm
  const [preview, setPreview] = useState(null); // banner row shown full-size
  const [actionError, setActionError] = useState(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: featuredKeys.admin });
    qc.invalidateQueries({ queryKey: featuredKeys.landing });
  };
  const done = () => {
    setAdding(null);
    setEditing(null);
    refresh();
  };

  const patch = useMutation({
    mutationFn: ({ id, body }) => featuredApi.update(id, body),
    onMutate: () => setActionError(null),
    onSuccess: refresh,
    onError: (err) => setActionError(apiError(err, 'Could not update this slot.')),
  });
  const replaceImage = useMutation({
    mutationFn: ({ id, file }) => {
      const fd = new FormData();
      fd.append('image', file);
      return featuredApi.replaceImage(id, fd);
    },
    onMutate: () => setActionError(null),
    onSuccess: refresh,
    onError: (err) => setActionError(apiError(err, 'Could not replace the image.')),
  });
  const remove = useMutation({
    mutationFn: (id) => featuredApi.remove(id),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setDeleting(null);
      refresh();
    },
    onError: (err) => setActionError(apiError(err, 'Could not remove this slot.')),
  });

  useEffect(() => {
    const previous = document.title;
    document.title = 'Featured content — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const rows = list.data ?? [];
  const byKind = (kind) => rows.filter((r) => r.kind === kind);

  return (
    <AdminLayout>
      <header className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Featured content</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          What the landing page shows. A slot points at the real record — anything taken down or
          blocked disappears from the page by itself.
        </p>
      </header>

      {actionError && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="danger">{actionError.message}</Alert>
        </div>
      )}

      {list.isLoading ? (
        <div className="rounded-2xl border border-surface-border bg-white shadow-card">
          <SkeletonRows rows={8} />
        </div>
      ) : list.error ? (
        <ErrorState
          title="We couldn't load featured content"
          message={apiError(list.error).message}
          onRetry={list.refetch}
        />
      ) : (
        <div className="grid gap-5">
          {KINDS.map(({ kind, title, Icon, blurb }) => {
            const items = byKind(kind);
            return (
              <section key={kind} className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
                <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-bold text-ink-900">
                      {title}
                      {items.length > 0 && (
                        <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                          {items.length}
                        </span>
                      )}
                    </h2>
                    <p className="truncate text-xs text-muted">{blurb}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setAdding(kind)}>
                    <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Add
                  </Button>
                </div>

                {items.length === 0 ? (
                  <p className="px-5 py-5 text-sm text-muted">
                    Nothing featured yet — the landing page simply hides this section.
                  </p>
                ) : (
                  <ul className="divide-y divide-surface-border">
                    {items.map((row) => (
                      <FeaturedRow
                        key={row.id}
                        row={row}
                        patching={patch.isPending ? patch.variables?.id : null}
                        onPatch={(id, body) => patch.mutate({ id, body })}
                        onDelete={setDeleting}
                        onEditBanner={setEditing}
                        onReplaceImage={(id, file) => replaceImage.mutate({ id, file })}
                        onPreview={setPreview}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <p className="flex items-center gap-2 text-xs text-muted">
            <SparkleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            A slot cannot be repointed — to feature something else, remove it and add a new one.
          </p>
        </div>
      )}

      {adding === 'banner' && (
        <AddBannerModal open onClose={() => setAdding(null)} onDone={done} />
      )}
      {adding && adding !== 'banner' && (
        <AddTargetModal kind={adding} onClose={() => setAdding(null)} onDone={done} />
      )}
      {editing && (
        <EditBannerModal key={editing.id} row={editing} onClose={() => setEditing(null)} onDone={done} />
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title || 'Banner preview'}>
        {preview && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-surface-border">
              <img src={preview.image} alt={preview.title ?? ''} className="w-full object-cover" />
              {(preview.title || preview.subtitle) && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/75 via-ink-900/35 to-transparent p-4 pt-10">
                  {preview.title && <span className="block text-base font-bold leading-tight text-white">{preview.title}</span>}
                  {preview.subtitle && <span className="mt-0.5 block text-[13px] text-white/85">{preview.subtitle}</span>}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              Shown as the landing page renders it{preview.linkUrl ? (
                <> — links to <code className="font-mono text-[11px] text-ink-600">{preview.linkUrl}</code></>
              ) : ' — no link set'}.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        centered
        danger
        title={`Remove ${deleting?.kind === 'banner' ? (deleting?.title || 'this banner') : (deleting?.target?.name ?? 'this slot')}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(deleting.id)}>
              Remove
            </Button>
          </>
        }
      >
        This removes it from the landing page immediately. The {deleting?.kind === 'banner' ? 'banner' : deleting?.kind} itself is not affected.
      </Modal>
    </AdminLayout>
  );
}
