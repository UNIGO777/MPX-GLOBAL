import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { featuredApi, featuredKeys } from '../../api/featured.js';
import { BannerSlide } from '../../components/catalogue/FeaturedStrips.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { FileDrop } from '../../components/ui/FileDrop.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { countryName } from '../../lib/countries.js';
import { LANDING_FEATURED_LIMITS } from '../../lib/featuredLimits.js';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import {
  BoxIcon,
  BuildingIcon,
  CalendarIcon,
  ClockIcon,
  ExternalIcon,
  EyeIcon,
  ImageIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
  TrashIcon,
  UploadIcon,
} from '../../components/ui/icons.jsx';

/**
 * M6 screen 3 — the featured content manager (`/admin/featured`), FINALIZE F5b.
 *
 * Four kinds — banner · product · category · supplier — each an ordered list,
 * one tab each (`?kind=`, so a link lands on the right list). The landing page
 * reads the same rows through `GET /public/featured`.
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
 * Every row states ONE status — Live · Starts … · Ended · Switched off ·
 * Hidden · Removed — computed the way the public read decides (active, the
 * date window, the target's availability), so "is this on the page?" never
 * needs working out from four separate fields. 2026-09-24 redesign.
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
    noun: 'banner',
    Icon: ImageIcon,
    where: 'A rotating strip just under the landing page’s top section — an image, a headline and where it links to. None live: no strip.',
  },
  {
    kind: 'product',
    title: 'Products',
    noun: 'product',
    Icon: BoxIcon,
    where: 'A "Featured products" row above "Recently listed" — first 10 live. None live: the row is left out.',
  },
  {
    kind: 'category',
    title: 'Categories',
    noun: 'category',
    Icon: TagIcon,
    where: 'Shown first in "Browse by category" — first 12 live; the usual categories fill the rest.',
  },
  {
    kind: 'supplier',
    title: 'Suppliers',
    noun: 'supplier',
    Icon: BuildingIcon,
    where: 'A "Highlighted suppliers" row below "Recently listed" — first 8 live. None live: the row is left out.',
  },
];
const KIND_OF = Object.fromEntries(KINDS.map((k) => [k.kind, k]));
const PUBLIC_PATH = { product: '/product/', category: '/category/', supplier: '/supplier/' };

/** datetime-local value → ISO, or undefined when the field is empty. */
const toIso = (v) => (v ? new Date(v).toISOString() : undefined);
/** ISO → the `YYYY-MM-DDTHH:mm` a datetime-local input shows, in local time. */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const when = (iso) => `${formatDate(iso)}, ${formatTime(iso)}`;

/*
 * Checked in the dialog BEFORE sending, in plain words next to the field. The
 * server enforces the same rules (featured.validators.js) and stays the
 * authority; it only ever answered "Invalid request.", which told a curator
 * nothing (owner, 2026-09-25: "test for other issues and fix").
 */
const LINK_MSG = 'Use a page on this site starting with / (like /categories) or a full address starting with https://';
const DATES_MSG = '"Show until" must be after "Show from".';
// Same two shapes the server accepts — anything else (javascript:, mailto:,
// //evil.com) is refused, since this lands in an href on the landing page.
const linkProblem = (v) => {
  const t = v.trim();
  if (!t) return null;
  return /^\/(?!\/)[\w\-./?=&%#]*$/.test(t) || /^https?:\/\/[^\s]+$/i.test(t) ? null : LINK_MSG;
};
const datesProblem = (from, until) => (from && until && new Date(from) > new Date(until) ? DATES_MSG : null);

/** A server rejection in the curator's words, per field when the server named one. */
function saveError(err) {
  const e = apiError(err, 'Could not save. Please try again.');
  const fields = (e.fields ?? []).map((f) => String(f.field ?? ''));
  if (fields.some((f) => f.endsWith('linkUrl'))) return LINK_MSG;
  if (fields.some((f) => f.endsWith('startsAt') || f.endsWith('endsAt')) || (e.code === 'VALIDATION_ERROR' && /date/i.test(e.message))) return DATES_MSG;
  return e.message;
}

/**
 * The one status a slot is in, decided in the SAME order the public read
 * filters: a vanished target, then switched off, then outside its window, then
 * a target that no longer qualifies.
 */
function slotStatus(row, now, overLimit = false) {
  const isBanner = row.kind === 'banner';
  if (!isBanner && !row.target) {
    return { label: 'Removed', tone: 'danger', note: `This ${row.kind} no longer exists, so nothing shows. Remove the slot.` };
  }
  if (!row.active) return { label: 'Switched off', tone: 'neutral' };
  if (row.startsAt && new Date(row.startsAt).getTime() > now) {
    return { label: `Starts ${formatDate(row.startsAt)}`, tone: 'scheduled' };
  }
  if (row.endsAt && new Date(row.endsAt).getTime() < now) return { label: 'Ended', tone: 'neutral' };
  if (!isBanner && !row.targetLive) {
    return {
      label: 'Hidden',
      tone: 'warning',
      note: `Taken down, blocked or deactivated, so it isn't shown. It comes back by itself if the ${row.kind} returns.`,
    };
  }
  if (overLimit) {
    return {
      label: 'Not shown',
      tone: 'neutral',
      note: `Only the first ${LANDING_FEATURED_LIMITS[row.kind]} live ${row.kind === 'category' ? 'categories' : `${row.kind}s`} appear. Give it a lower position number to show it.`,
    };
  }
  return { label: 'Live', tone: 'success' };
}

const TONE = {
  success: 'bg-success-50 text-success-700 ring-success-200',
  scheduled: 'bg-white text-ink-700 ring-ink-300',
  warning: 'bg-warning-50 text-warning-800 ring-warning-200',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200',
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${TONE[status.tone]}`}>
      {status.tone === 'success' && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success-600" />}
      {status.tone === 'scheduled' && <ClockIcon className="h-3 w-3" aria-hidden="true" />}
      {status.label}
    </span>
  );
}

/**
 * Position + schedule — shared by every add and edit dialog. `collapsible` (the
 * Add dialogs) folds them away: both are optional, and open they pushed the
 * search results off the screen.
 */
function CurationFields({ collapsible = false, ...props }) {
  if (!collapsible) return <CurationBody {...props} />;
  const set = Boolean(props.order || props.startsAt || props.endsAt);
  const bad = Boolean(datesProblem(props.startsAt, props.endsAt));
  return (
    <details className={`group rounded-xl border ${bad ? 'border-danger-300' : 'border-surface-border'}`} open={set || bad}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[13.5px] font-semibold text-ink-800 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
          Position &amp; schedule
          <span className="font-normal text-muted">{set ? '· set' : '· optional'}</span>
        </span>
        <span aria-hidden="true" className="text-ink-400 transition-transform group-open:rotate-180 motion-reduce:transition-none">▾</span>
      </summary>
      <div className="border-t border-surface-border"><CurationBody {...props} bare /></div>
    </details>
  );
}

function CurationBody({ order, setOrder, startsAt, setStartsAt, endsAt, setEndsAt, bare = false }) {
  return (
    <div className={`space-y-4 p-4 ${bare ? 'bg-surface-subtle/40' : 'rounded-xl border border-surface-border bg-surface-subtle/50'}`}>
      <Field label="Position" helper="Lower numbers show first. Equal numbers show the newest first." optional>
        {(id) => (
          <input
            id={id}
            type="number"
            min="0"
            max="9999"
            inputMode="numeric"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="0"
            className={inputClasses(false, 'sm:w-40')}
          />
        )}
      </Field>
      <div className="grid gap-4">
        <DateField label="Show from" empty="Leave empty to show right away" value={startsAt} max={endsAt} onChange={setStartsAt} />
        <DateField label="Show until" empty="Leave empty to keep it until removed" value={endsAt} min={startsAt} onChange={setEndsAt} error={datesProblem(startsAt, endsAt)} />
      </div>
    </div>
  );
}

function DateField({ label, empty, value, min, max, onChange, error }) {
  return (
    <Field
      label={label}
      optional
      helper={empty}
      error={error ?? undefined}
      trailing={value ? (
        <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-primary-700 hover:underline">
          Clear
        </button>
      ) : null}
    >
      {(id) => (
        <input
          id={id}
          type="datetime-local"
          value={value}
          min={min || undefined}
          max={max || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses(Boolean(error))}
          aria-invalid={error ? true : undefined}
        />
      )}
    </Field>
  );
}

function BannerTextFields({ title, setTitle, subtitle, setSubtitle, linkUrl, setLinkUrl }) {
  return (
    <>
      <Field label="Headline" optional trailing={<span className="text-xs text-muted">{120 - title.length} left</span>}>
        {(id) => <input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClasses(false)} />}
      </Field>
      <Field label="Subtitle" optional trailing={<span className="text-xs text-muted">{240 - subtitle.length} left</span>}>
        {(id) => <input id={id} value={subtitle} maxLength={240} onChange={(e) => setSubtitle(e.target.value)} className={inputClasses(false)} />}
      </Field>
      <Field
        label="Links to"
        helper="A page on this site (/category/textiles) or a full https:// address."
        error={linkProblem(linkUrl) ?? undefined}
        optional
      >
        {(id) => (
          <input
            id={id}
            value={linkUrl}
            maxLength={500}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="/search?q=cotton"
            aria-invalid={linkProblem(linkUrl) ? true : undefined}
            className={inputClasses(Boolean(linkProblem(linkUrl)), 'font-mono text-[13px]')}
          />
        )}
      </Field>
    </>
  );
}

function DialogActions({ onCancel, busy, disabled, onConfirm, children }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
      <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button loading={busy} disabled={disabled} onClick={onConfirm}>{children}</Button>
    </div>
  );
}

/** Create a banner — multipart, the image rides with the create. */
function AddBannerModal({ onClose, onDone }) {
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
    <Modal open onClose={onClose} title="Add a banner" icon={ImageIcon}>
      <div className="space-y-4">
        {create.error && <Alert tone="danger">{saveError(create.error)}</Alert>}
        <Field label="Image" helper="Use a wide image, ideally 1800 × 400 px. Keep text and faces near the middle — the edges are cropped on smaller screens. A screenshot of a page won't crop well.">
          {() => <FileDrop file={file} accept="image/*" onPick={setFile} />}
        </Field>
        <BannerTextFields {...{ title, setTitle, subtitle, setSubtitle, linkUrl, setLinkUrl }} />
        <CurationFields collapsible {...{ order, setOrder, startsAt, setStartsAt, endsAt, setEndsAt }} />
        <DialogActions onCancel={onClose} busy={create.isPending} disabled={!file || Boolean(linkProblem(linkUrl) || datesProblem(startsAt, endsAt))} onConfirm={() => create.mutate()}>
          Add banner
        </DialogActions>
      </div>
    </Modal>
  );
}

/**
 * Edit a slot: position and schedule for every kind, plus the text and link
 * for a banner. What it points at is not editable (the pointer rule), and the
 * banner image has its own action. A cleared date is sent as `null`, which the
 * server reads as "remove the date".
 */
function EditSlotModal({ row, name, onClose, onDone }) {
  const isBanner = row.kind === 'banner';
  const [title, setTitle] = useState(row.title ?? '');
  const [subtitle, setSubtitle] = useState(row.subtitle ?? '');
  const [linkUrl, setLinkUrl] = useState(row.linkUrl ?? '');
  const [order, setOrder] = useState(String(row.order ?? 0));
  const [startsAt, setStartsAt] = useState(toLocalInput(row.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(row.endsAt));

  const save = useMutation({
    mutationFn: () =>
      featuredApi.update(row.id, {
        ...(isBanner
          ? { title: title.trim() || null, subtitle: subtitle.trim() || null, linkUrl: linkUrl.trim() || null }
          : {}),
        order: order === '' ? 0 : Number(order),
        startsAt: startsAt ? toIso(startsAt) : null,
        endsAt: endsAt ? toIso(endsAt) : null,
      }),
    onSuccess: onDone,
  });

  return (
    <Modal open onClose={onClose} title={isBanner ? 'Edit banner' : `Edit “${name}”`} icon={SettingsIcon}>
      <div className="space-y-4">
        {save.error && <Alert tone="danger">{saveError(save.error)}</Alert>}
        {isBanner ? (
          <BannerTextFields {...{ title, setTitle, subtitle, setSubtitle, linkUrl, setLinkUrl }} />
        ) : (
          <p className="text-[13px] text-muted">
            A slot always points at the same {row.kind}. To feature a different one, remove this slot and add a new one.
          </p>
        )}
        <CurationFields {...{ order, setOrder, startsAt, setStartsAt, endsAt, setEndsAt }} />
        <DialogActions onCancel={onClose} busy={save.isPending} disabled={Boolean((isBanner && linkProblem(linkUrl)) || datesProblem(startsAt, endsAt))} onConfirm={() => save.mutate()}>
          Save changes
        </DialogActions>
      </div>
    </Modal>
  );
}

/**
 * Pick an existing product / category / supplier, searching as you type
 * (`GET /admin/featured/candidates`, featured:manage): word-prefix on the name,
 * and only what the landing could actually show — the same availability rules
 * as the public read. Empty → the newest.
 */
function AddTargetModal({ kind, existing, onClose, onDone }) {
  const [q, setQ] = useState('');
  // Search as you type (owner, 2026-09-25 — it used to need Enter), 300 ms
  // after the last keystroke so each letter isn't its own request.
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const [picked, setPicked] = useState(null);
  const [order, setOrder] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const isCategory = kind === 'category';
  const { noun, Icon } = KIND_OF[kind];
  // Staff-only word-prefix search: "twi" finds "Twill" while still typing. The
  // public search is whole-word `$text`, which found nothing mid-word.
  const search = useQuery({
    queryKey: ['admin', 'featured-pick', kind, term],
    queryFn: () => featuredApi.candidates(kind, term),
    placeholderData: (prev) => prev,
  });
  const candidates = useMemo(
    () => (search.data ?? []).map((c) => ({
      ...c,
      meta: kind === 'supplier' ? (countryName(c.meta) ?? c.meta) : c.meta,
    })),
    [search.data, kind],
  );

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

  return (
    <Modal open onClose={onClose} title={`Feature a ${noun}`} icon={Icon}>
      <div className="space-y-4">
        {create.error && <Alert tone="danger">{saveError(create.error)}</Alert>}

        {picked ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/50 p-3">
            <Thumb image={picked.image} name={picked.name} />
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
            {/* Enter does nothing extra — results follow the typing — but the
                form stops it from submitting anything. */}
            <form onSubmit={(e) => e.preventDefault()} className="relative" role="search">
              <label htmlFor="feat-pick" className="sr-only">Search {noun === 'category' ? 'categories' : `${noun}s`}</label>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input
                id="feat-pick"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Type a ${noun} name`}
                className={inputClasses(false, 'pl-9 pr-9')}
                autoComplete="off"
                autoFocus
              />
              {search.isFetching && !search.isLoading && (
                <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              )}
            </form>

            <div className="space-y-2">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted" aria-live="polite">
                {term
                  ? `Results for “${term}”`
                  : isCategory ? 'Categories' : `Newest ${noun === 'supplier' ? 'suppliers' : 'products'}`}
              </p>
              {search.isLoading ? (
                <SkeletonRows rows={3} />
              ) : candidates.length > 0 ? (
                <ul className="max-h-72 divide-y divide-surface-border overflow-y-auto rounded-xl border border-surface-border">
                  {candidates.map((c) => {
                    const already = existing.has(String(c.id));
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={already}
                          onClick={() => setPicked(c)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary-50/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                        >
                          <Thumb image={c.image} name={c.name} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink-900">
                              {c.name}
                              {c.verified && <VerifiedTick verified compact />}
                            </span>
                            {c.meta && <span className="block truncate text-xs text-muted">{c.meta}</span>}
                          </span>
                          {already && <span className="shrink-0 text-[11.5px] font-semibold text-muted">Already featured</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-center text-sm text-muted">
                  {term ? 'Nothing matches that. Try fewer letters.' : `No public ${noun === 'category' ? 'categories' : `${noun}s`} yet.`}
                </p>
              )}
              <p className="text-xs text-muted">Only what the public can already see is listed.</p>
            </div>
          </>
        )}

        <CurationFields collapsible {...{ order, setOrder, startsAt, setStartsAt, endsAt, setEndsAt }} />
        <DialogActions onCancel={onClose} busy={create.isPending} disabled={!picked || Boolean(datesProblem(startsAt, endsAt))} onConfirm={() => create.mutate()}>
          Feature it
        </DialogActions>
      </div>
    </Modal>
  );
}

function Thumb({ image, name, size = 'md' }) {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  return image ? (
    <img src={image} alt="" className={`${box} shrink-0 rounded-lg object-cover`} />
  ) : (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-lg bg-ink-100 text-sm font-bold text-ink-500`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/**
 * The landing banner at its REAL size, scaled down to fit. Drawn by the same
 * `BannerSlide` the landing uses, inside a frame the size the landing gives it:
 * desktop = a 1440-wide screen (1312 × 224), phone = a 390-wide screen
 * (358 wide at 16:7). Scaling the whole frame keeps the crop AND the text size
 * honest — a miniature, not a re-layout. (Owner, 2026-09-25: "the preview is
 * wrong" — it showed the whole image, uncropped, with its own text styling.)
 */
const PREVIEW_FRAMES = {
  desktop: { width: 1312, height: 224, label: 'Desktop' },
  phone: { width: 358, height: Math.round((358 * 7) / 16), label: 'Phone' },
};

function BannerPreview({ banner }) {
  const [frame, setFrame] = useState('desktop');
  const [scale, setScale] = useState(1);
  const boxRef = useRef(null);
  const f = PREVIEW_FRAMES[frame];

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / f.width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [f.width]);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Preview size" className="inline-flex rounded-lg bg-ink-100 p-1">
        {Object.entries(PREVIEW_FRAMES).map(([key, v]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={frame === key}
            onClick={() => setFrame(key)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              frame === key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div ref={boxRef} className="w-full rounded-xl bg-surface-canvas p-0">
        <div className={frame === 'phone' ? 'mx-auto' : ''} style={{ width: f.width * scale, height: f.height * scale }}>
          <div
            className="relative origin-top-left overflow-hidden rounded-2xl bg-ink-100 shadow-card"
            style={{ width: f.width, height: f.height, transform: `scale(${scale})` }}
          >
            <BannerSlide banner={banner} size={frame} />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted">
        Exactly how the landing page crops it{scale < 1 ? `, shown at ${Math.round(scale * 100)}%` : ''}.{' '}
        {banner.linkUrl ? (
          <>Clicking it opens <code className="font-mono text-[11px] text-ink-600">{banner.linkUrl}</code>.</>
        ) : 'No link set — clicking it does nothing.'}
      </p>
    </div>
  );
}

/** One curation slot. */
function FeaturedRow({ row, position, now, overLimit, patching, replacing, onPatch, onEdit, onDelete, onReplaceImage, onPreview }) {
  const isBanner = row.kind === 'banner';
  const status = slotStatus(row, now, overLimit);
  const name = isBanner ? (row.title || 'Untitled banner') : (row.target?.name ?? `Deleted ${row.kind}`);
  const image = isBanner ? row.image : row.target?.image;
  const fileRef = useRef(null);

  const menu = [
    { label: isBanner ? 'Edit banner' : 'Position & schedule', Icon: SettingsIcon, onSelect: () => onEdit(row, name) },
    ...(isBanner && row.image ? [{ label: 'Preview', Icon: EyeIcon, onSelect: () => onPreview(row) }] : []),
    ...(isBanner ? [{ label: 'Replace image', Icon: UploadIcon, onSelect: () => fileRef.current?.click() }] : []),
    ...(!isBanner && row.target?.slug && row.targetLive
      ? [{ label: 'Open public page', Icon: ExternalIcon, to: `${PUBLIC_PATH[row.kind]}${row.target.slug}` }]
      : []),
    { label: 'Remove from landing page', Icon: TrashIcon, danger: true, onSelect: () => onDelete(row, name) },
  ];

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:items-center sm:gap-4 sm:px-5">
      <span
        className="mt-3 w-6 shrink-0 text-center text-[12px] font-bold tabular-nums text-ink-400 sm:mt-0"
        title={`Position value ${row.order}`}
      >
        {position}
      </span>

      {isBanner ? (
        <button
          type="button"
          onClick={() => row.image && onPreview(row)}
          aria-label={`Preview ${name}`}
          className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 sm:h-16 sm:w-28"
        >
          {row.image && <img src={row.image} alt="" className="h-full w-full object-cover" />}
          {replacing && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Spinner className="h-5 w-5" />
            </span>
          )}
        </button>
      ) : (
        <span className={status.tone === 'danger' ? 'opacity-50' : ''}><Thumb image={image} name={name} /></span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 truncate text-[14px] font-semibold text-ink-900">{name}</p>
          <StatusPill status={status} />
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
          {isBanner && row.subtitle && <span className="min-w-0 max-w-full truncate">{row.subtitle}</span>}
          {isBanner && (
            row.linkUrl
              ? <span className="min-w-0 max-w-full truncate">→ <code className="font-mono text-[11.5px] text-ink-600">{row.linkUrl}</code></span>
              : <span>No link</span>
          )}
          {!isBanner && row.target?.context && (
            <span className="min-w-0 max-w-full truncate">{row.kind === 'supplier' ? (countryName(row.target.context) ?? row.target.context) : row.target.context}</span>
          )}
          {(row.startsAt || row.endsAt) && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {row.startsAt ? `From ${when(row.startsAt)}` : 'Now'}
              {' – '}
              {row.endsAt ? when(row.endsAt) : 'until removed'}
            </span>
          )}
        </div>
        {status.note && (
          <p className={`mt-1 text-[12px] font-medium ${status.tone === 'danger' ? 'text-danger-700' : status.tone === 'warning' ? 'text-warning-800' : 'text-ink-600'}`}>
            {status.note}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <span className="hidden text-[12px] font-medium text-ink-500 md:inline">{row.active ? 'On' : 'Off'}</span>
        <Switch
          checked={row.active}
          busy={patching}
          // Switch hands back the click event, not a boolean — flip from the row.
          onChange={() => onPatch(row.id, { active: !row.active })}
          label={`${row.active ? 'Switch off' : 'Switch on'} ${name}`}
        />
        <RowMenu items={menu} label={`Actions for ${name}`} />
        {isBanner && (
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onReplaceImage(row.id, f);
            }}
          />
        )}
      </div>
    </li>
  );
}

export function Featured() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const active = KIND_OF[params.get('kind')] ? params.get('kind') : 'banner';
  const list = useQuery({ queryKey: featuredKeys.admin, queryFn: featuredApi.list });
  const [adding, setAdding] = useState(null); // kind being added
  const [editing, setEditing] = useState(null); // { row, name }
  const [deleting, setDeleting] = useState(null); // { row, name }
  const [preview, setPreview] = useState(null); // banner row shown full-size
  const [actionError, setActionError] = useState(null);
  // Status is relative to "now"; read once per render pass of the query data.
  const [now, setNow] = useState(() => Date.now());

  const refresh = () => {
    qc.invalidateQueries({ queryKey: featuredKeys.admin });
    qc.invalidateQueries({ queryKey: featuredKeys.landing });
    setNow(Date.now());
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

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => {
    const out = {};
    for (const { kind } of KINDS) {
      const items = rows.filter((r) => r.kind === kind);
      const live = items.filter((r) => slotStatus(r, now).tone === 'success').length;
      out[kind] = { total: items.length, live: Math.min(live, LANDING_FEATURED_LIMITS[kind]) };
    }
    return out;
  }, [rows, now]);
  const items = useMemo(
    // The landing page's order: position, then newest.
    () => rows
      .filter((r) => r.kind === active)
      .sort((a, b) => (a.order - b.order) || (new Date(b.createdAt) - new Date(a.createdAt))),
    [rows, active],
  );
  // Which live slots fall past what the landing shows — counted in the landing's
  // own order, among live slots only (the server drops the rest before display).
  const overLimitIds = useMemo(() => {
    const ids = new Set();
    let live = 0;
    for (const r of items) {
      if (slotStatus(r, now).tone !== 'success') continue;
      live += 1;
      if (live > LANDING_FEATURED_LIMITS[active]) ids.add(r.id);
    }
    return ids;
  }, [items, now, active]);
  const existing = useMemo(() => new Set(items.map((r) => String(r.targetId))), [items]);
  const meta = KIND_OF[active];

  const selectKind = (kind) => {
    const next = new URLSearchParams(params);
    if (kind === 'banner') next.delete('kind');
    else next.set('kind', kind);
    setParams(next, { replace: true });
    setActionError(null);
  };

  return (
    <AdminLayout>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Featured content</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Choose what the landing page shows. Anything taken down or blocked drops off the page by itself.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-surface-border bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-800 shadow-sm hover:border-primary-300 hover:text-primary-700 sm:self-auto"
        >
          View landing page
          <ExternalIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </header>

      <div
        role="tablist"
        aria-label="Featured sections"
        className="scrollbar-none -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-0.5"
        // WAI-ARIA tabs: arrows / Home / End move between sections; Tab leaves.
        onKeyDown={(e) => {
          const i = KINDS.findIndex((k) => k.kind === active);
          const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: KINDS.length - 1 }[e.key];
          if (next === undefined) return;
          e.preventDefault();
          const k = KINDS[(next + KINDS.length) % KINDS.length].kind;
          selectKind(k);
          e.currentTarget.querySelector(`[data-kind="${k}"]`)?.focus();
        }}
      >
        {KINDS.map(({ kind, title, Icon }) => {
          const selected = kind === active;
          const c = counts[kind];
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              data-kind={kind}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectKind(kind)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
                selected
                  ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
                  : 'border-surface-border bg-white text-ink-700 hover:border-primary-300'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {title}
              {!list.isLoading && (
                <span
                  className={`rounded-full px-1.5 text-[11.5px] tabular-nums ${selected ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'}`}
                  title={`${c.live} live of ${c.total}`}
                >
                  {c.live}/{c.total}
                  <span className="sr-only"> live</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="danger">{actionError.message}</Alert>
        </div>
      )}

      <section role="tabpanel" aria-label={meta.title} className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-surface-border px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <p className="min-w-0 flex-1 text-[13px] text-ink-600">{meta.where}</p>
          <Button size="sm" onClick={() => setAdding(active)} className="self-start sm:self-auto">
            <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add {meta.noun}
          </Button>
        </div>

        {list.isLoading ? (
          <SkeletonRows rows={4} />
        ) : list.error ? (
          <ErrorState title="We couldn't load featured content" message={apiError(list.error).message} onRetry={list.refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={meta.Icon}
            title={`No ${meta.title.toLowerCase()} featured`}
            action={(
              <Button variant="secondary" size="sm" onClick={() => setAdding(active)}>
                <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add {meta.noun}
              </Button>
            )}
          >
            The landing page hides this section until something is added.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-surface-border">
            {items.map((row, i) => (
              <FeaturedRow
                key={row.id}
                row={row}
                position={i + 1}
                now={now}
                overLimit={overLimitIds.has(row.id)}
                patching={patch.isPending && patch.variables?.id === row.id}
                replacing={replaceImage.isPending && replaceImage.variables?.id === row.id}
                onPatch={(id, body) => patch.mutate({ id, body })}
                onEdit={(r, name) => setEditing({ row: r, name })}
                onDelete={(r, name) => setDeleting({ row: r, name })}
                onReplaceImage={(id, file) => replaceImage.mutate({ id, file })}
                onPreview={setPreview}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-3 flex items-start gap-2 text-[12px] text-muted">
        <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Switched-off, scheduled and unavailable slots don’t use up the limit. A slot always points at the same
        item — to feature something else, remove it and add a new one.
      </p>

      {adding === 'banner' && <AddBannerModal onClose={() => setAdding(null)} onDone={done} />}
      {adding && adding !== 'banner' && (
        <AddTargetModal kind={adding} existing={existing} onClose={() => setAdding(null)} onDone={done} />
      )}
      {editing && (
        <EditSlotModal key={editing.row.id} row={editing.row} name={editing.name} onClose={() => setEditing(null)} onDone={done} />
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Banner preview" icon={EyeIcon} wide>
        {preview && <BannerPreview banner={preview} />}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        centered
        danger
        title={`Remove “${deleting?.name ?? ''}”?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(deleting.row.id)}>
              Remove
            </Button>
          </>
        }
      >
        It leaves the landing page straight away.{' '}
        {deleting?.row.kind === 'banner'
          ? 'The banner and its image are deleted.'
          : `The ${deleting?.row.kind} itself is not affected.`}
      </Modal>
    </AdminLayout>
  );
}
