import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { organisationApi, organisationKeys } from '../../api/organisation.js';
import { productKeys, productsApi } from '../../api/products.js';
import {
  AttributeFields,
  fromAttributeArray,
  toAttributeArray,
} from '../../components/catalogue/AttributeFields.jsx';
import { BlockedBanner } from '../../components/catalogue/BlockedBanner.jsx';
import { CategoryPicker } from '../../components/catalogue/CategoryPicker.jsx';
import { PriceInput } from '../../components/catalogue/PriceInput.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { ProductImageManager } from '../../components/catalogue/ProductImageManager.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import {
  BoxIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  SearchIcon,
  SearchOffIcon,
  TrashIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { PRODUCT_STATUS_META } from '../../lib/productStatus.js';

/**
 * M2 web screens 6 + 7 — add and edit are ONE component (`id` absent = create).
 *
 * REDESIGNED 2026-08-10 (owner: full authority, "best possible design"; the
 * m2-webscreens Stitch export for this screen is superseded). Structure:
 *
 *   entry   → a full-width VISUAL CATEGORY CHOOSER — top categories as monogram
 *             tiles, specialisations as pills. No dropdowns, no dead form below.
 *   editor  → one continuous guided card: four NUMBERED SECTIONS joined by a
 *             connector line, each number flipping to a green tick as the
 *             section is satisfied. Fields sit in dense 2–3 column grids so the
 *             canvas width is USED (owner: "too much space is being wasted").
 *   rail    → 300px sticky context: category summary with in-place change,
 *             lifecycle Status card (edit), the LIVE BUYER PREVIEW inside a
 *             browser-chrome frame showing the future /product/… URL, and a
 *             LISTING-STRENGTH meter with the remaining checklist.
 *   actions → a floating sticky bar: Save is never a scroll away.
 *
 * Every locked rule survives the redesign:
 * 🔴 the seller NEVER picks goods vs service — the leaf decides (§A14) ·
 * 🔴 save creates a DRAFT; required specs are enforced at PUBLISH only ·
 * 🔴 draft is one-way (§A1) · category change warns before clearing specs ·
 * 🔴 the 10-draft cap blocks BEFORE the form renders (create) ·
 * 🔴 a rename never changes the slug (§A6) — the note appears on edit ·
 * 🔴 blocked keeps fields EDITABLE, only Publish/Hide disappear ·
 * 🔴 archived never opens the form.
 */
const GOODS_FIELDS = [
  ['hsCode', 'HS code', 'Harmonised System code, if you know it'],
  ['supplyAbility', 'Supply ability', 'e.g. 10,000 units per month'],
  ['leadTime', 'Lead time', 'e.g. 2–3 weeks'],
  ['packaging', 'Packaging', ''],
  ['terms', 'Payment terms', 'e.g. 30% advance, 70% on shipment'],
];
const SERVICE_FIELDS = [
  ['engagementType', 'Engagement type', 'Project / hourly / dedicated team'],
  ['deliveryModel', 'Delivery model', 'Remote / onsite / hybrid'],
  ['teamSize', 'Team size', ''],
  ['pricingModel', 'Pricing model', ''],
  ['timeline', 'Timeline', ''],
];

const EMPTY = {
  name: '',
  description: '',
  images: [],
  price: { mode: 'fixed', currency: 'INR' },
  moq: '',
  unit: '',
  hsCode: '',
  countryOfOrigin: '',
  supplyAbility: '',
  leadTime: '',
  packaging: '',
  terms: '',
  engagementType: '',
  deliveryModel: '',
  teamSize: '',
  pricingModel: '',
  timeline: '',
};

function initials(label = '') {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Guided section: numbered marker (→ tick when satisfied) + connector line. */
function FormSection({ step, done, last = false, title, desc, aside, children }) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 px-5 pt-6 sm:px-6">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
            done ? 'bg-success-500 text-white' : 'bg-primary-600 text-white'
          }`}
          aria-hidden="true"
        >
          {done ? <CheckIcon className="h-4 w-4" /> : step}
        </span>
        {!last && <span className="mt-2 w-px flex-1 bg-ink-200" aria-hidden="true" />}
      </div>
      <div className={`min-w-0 ${last ? 'pb-6' : 'pb-8'}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {aside}
        </div>
        {desc && <p className="mt-0.5 text-[13px] text-muted">{desc}</p>}
        <div className="mt-4 space-y-5">{children}</div>
      </div>
    </div>
  );
}

/** Right-rail card: small-caps label + body. Quieter than the main surface. */
function RailCard({ label, children }) {
  return (
    <section className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </h3>
      {children}
    </section>
  );
}

function ChecklistRow({ done, quiet = false, children }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px]">
      {done ? (
        <CheckCircleIcon className="mt-px h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <span
          aria-hidden="true"
          className="mt-px h-4 w-4 shrink-0 rounded-full border-[1.5px] border-ink-300"
        />
      )}
      <span className={done ? 'text-ink-800' : quiet ? 'text-muted' : 'text-ink-600'}>
        {children}
      </span>
    </li>
  );
}

export function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState(EMPTY);
  const [cat, setCat] = useState({ topId: null, subId: null });
  const [specs, setSpecs] = useState({});
  const [error, setError] = useState(null);
  const [pendingCat, setPendingCat] = useState(null); // category change awaiting confirmation
  const [changingCat, setChangingCat] = useState(false); // rail "Change" picker open
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [catQuery, setCatQuery] = useState(''); // entry-state category search

  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  // Own organisation — the preview card's SELLER ROW (2026-08-11): buyers see
  // name + tick + country on every catalogue card, so the preview must too.
  // Self-scoped owner read; verified derives from own kycStatus, which is
  // legitimate here (never on public surfaces).
  const org = useQuery({ queryKey: organisationKeys.mine, queryFn: organisationApi.mine });

  // 🔴 The 10-draft cap blocks BEFORE the seller invests any effort (create
  // mode) — a full page with no form beneath it, not an error at save. One
  // cheap list call carries `caps`; verified sellers return {verified:true}.
  const capCheck = useQuery({
    queryKey: productKeys.minePage({ page: 1, pageSize: 1 }),
    queryFn: () => productsApi.mine({ page: 1, pageSize: 1 }),
    enabled: !isEdit,
  });

  const existing = useQuery({
    queryKey: ['products', 'one', id],
    queryFn: () => productsApi.one(id),
    enabled: isEdit,
    retry: false,
  });

  // The leaf decides the field group AND the spec definitions (§A14). The top
  // is kept alongside for the rail's "Top → Leaf" summary.
  const { leaf, top } = useMemo(() => {
    for (const t of tree.data ?? []) {
      const sub = (t.subs ?? []).find((s) => s.id === cat.subId);
      if (sub) return { leaf: sub, top: t };
    }
    return { leaf: null, top: null };
  }, [tree.data, cat.subId]);

  const attrs = useQuery({
    queryKey: catalogueKeys.attributes(leaf?.slug),
    queryFn: () => catalogueApi.attributes(leaf.slug),
    enabled: Boolean(leaf?.slug),
  });

  // Load an existing product into the form once.
  useEffect(() => {
    const p = existing.data;
    if (!p || !tree.data) return;
    // The owner view pads absent price values with NULLS; the validator's
    // z.coerce.number() coerces null → 0, so a null `max` shipped back on save
    // reads as "fixed price carries max" → 400. Absent means ABSENT here.
    const pr = p.price ?? {};
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p[k] ?? EMPTY[k]])),
      price: {
        mode: pr.mode ?? 'fixed',
        currency: pr.currency ?? 'INR',
        ...(pr.min != null ? { min: pr.min } : {}),
        ...(pr.max != null ? { max: pr.max } : {}),
      },
      // Full {url, publicId} refs (owner view, 2026-08-11) — existing images
      // show in the manager and survive a save unchanged.
      images: p.images ?? [],
    });
    setSpecs(fromAttributeArray(p.attributes));
    for (const t of tree.data) {
      if ((t.subs ?? []).some((s) => s.id === p.categoryId)) {
        setCat({ topId: t.id, subId: p.categoryId });
        break;
      }
    }
  }, [existing.data, tree.data]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Entry state: picking a top category reveals its specialisations below the
  // fold on smaller screens — bring them into view so the next step is never
  // hidden. The ref only exists in the entry state, so this is a no-op later.
  const subsRef = useRef(null);
  useEffect(() => {
    if (cat.topId && !cat.subId) {
      subsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [cat.topId, cat.subId]);

  // …and picking the specialisation swaps in the editor, which must be read
  // from the top — without this the editor appears mid-scroll, wherever the
  // chooser left off. The shell's <main> is the scroll container, not window.
  const editorTopRef = useRef(null);
  useEffect(() => {
    if (cat.subId) {
      editorTopRef.current?.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [cat.subId]);

  function applyCategory(next) {
    setFieldErrors(({ category, ...rest }) => rest);
    // Changing the leaf re-renders the spec fields and drops values that belong
    // to the old category — warn before discarding entered work.
    const hasSpecs = Object.keys(specs).length > 0;
    if (hasSpecs && next.subId && next.subId !== cat.subId) {
      setPendingCat(next);
      return;
    }
    setCat(next);
    if (next.subId !== cat.subId) setSpecs({});
    if (next.subId) setChangingCat(false);
  }

  const body = useMemo(() => {
    const isService = leaf?.type === 'service';
    const out = {
      name: form.name,
      categoryId: cat.subId,
      price: form.price,
      attributes: toAttributeArray(specs),
      ...(form.description ? { description: form.description } : {}),
      // Always sent: PATCH replaces the array, so an emptied list must reach
      // the server as [] — omitting it would silently keep deleted images.
      images: form.images,
    };
    // Only the applicable group is ever sent — the server rejects a goods field
    // on a service leaf and vice versa.
    const group = isService ? SERVICE_FIELDS : GOODS_FIELDS;
    for (const [key] of group) if (form[key]) out[key] = form[key];
    if (!isService) {
      if (form.moq !== '') out.moq = Number(form.moq);
      if (form.unit) out.unit = form.unit;
      if (form.countryOfOrigin) out.countryOfOrigin = form.countryOfOrigin;
    }
    return out;
  }, [form, cat.subId, specs, leaf]);

  const save = useMutation({
    mutationFn: () => (isEdit ? productsApi.update(id, body) : productsApi.create(body)),
    onMutate: () => setError(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.mine });
      navigate('/exporter/products');
    },
    onError: (err) => setError(err?.response?.data?.error?.message ?? 'Could not save.'),
  });

  const setStatus = useMutation({
    mutationFn: (status) => productsApi.setStatus(id, status),
    onMutate: () => setError(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.mine });
      navigate('/exporter/products');
    },
    onError: (err) => setError(err?.response?.data?.error?.message ?? 'Could not change status.'),
  });

  const archive = useMutation({
    mutationFn: () => productsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.mine });
      navigate('/exporter/products');
    },
  });

  // Design: Save stays ENABLED and a failed attempt explains itself — a red
  // "Fix N fields to continue." banner plus inline field errors. A disabled
  // button that never says why is the pattern the design deliberately avoids.
  function trySave() {
    const errs = {};
    if (!cat.subId) errs.category = 'Sub-category is required.';
    if (!form.name.trim()) errs.name = 'Product name is required.';
    const pr = form.price;
    if (pr.mode === 'range' && pr.min != null && pr.max != null && Number(pr.min) >= Number(pr.max)) {
      errs.price = 'Minimum must be less than maximum.';
    }
    if (pr.mode !== 'on_request' && pr.min == null) errs.price = 'A price is required.';
    setFieldErrors(errs);
    if (Object.keys(errs).length === 0) save.mutate();
  }
  const errorCount = Object.keys(fieldErrors).length;

  /* ---------------- full-page states (unchanged rules) ---------------- */

  const caps = capCheck.data?.caps;
  if (!isEdit && caps && caps.verified === false && caps.drafts.used >= caps.drafts.limit) {
    return (
      <PortalLayout nav={EXPORTER_NAV}>
        <EmptyState
          icon={BoxIcon}
          title={`Draft limit reached (${caps.drafts.limit})`}
          action={
            <Link
              to="/exporter/products"
              className="inline-flex min-h-[44px] items-center rounded-full bg-primary-600 px-6 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Back to products
            </Link>
          }
        >
          Publish or delete a draft, or get verified.
        </EmptyState>
      </PortalLayout>
    );
  }

  if (isEdit && existing.isError) {
    return (
      <PortalLayout nav={EXPORTER_NAV}>
        <EmptyState icon={BoxIcon} title="Not found">
          This product doesn&apos;t exist, or it isn&apos;t yours.
        </EmptyState>
      </PortalLayout>
    );
  }

  if (isEdit && existing.isPending) {
    return <PortalLayout nav={EXPORTER_NAV}><SkeletonRows rows={8} /></PortalLayout>;
  }

  const product = existing.data;

  // 🔴 Archived is TERMINAL — the form never opens for one. The recovery path is
  // a new listing, and the copy says exactly that.
  if (product?.status === 'archived') {
    return (
      <PortalLayout nav={EXPORTER_NAV}>
        <EmptyState
          icon={BoxIcon}
          title="This product is archived"
          action={
            <Link
              to="/exporter/products/new"
              className="inline-flex min-h-[44px] items-center rounded-full bg-primary-600 px-6 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Create a new listing
            </Link>
          }
        >
          Archived products can&apos;t be edited or restored. To sell this again, list it as a new
          product — its name and web address are free to reuse.
        </EmptyState>
      </PortalLayout>
    );
  }

  const blocked = Boolean(product?.takedown);
  const meta = product ? PRODUCT_STATUS_META[product.status] : null;
  const isService = leaf?.type === 'service';
  const chosen = Boolean(cat.subId);

  /* ---------------- entry state: full-width category chooser ---------------- */
  // 🔴 The form is ABSENT until a leaf is chosen — not greyed out. The field set
  // depends entirely on the leaf, so there is nothing meaningful to show yet.

  if (!chosen && !isEdit) {
    const tops = tree.data ?? [];
    const selTop = tops.find((t) => t.id === cat.topId) ?? null;

    // Search flattens the tree to matching SPECIALISATIONS (a matching top
    // surfaces all of its subs) — one click on a result lands on the leaf.
    const norm = catQuery.trim().toLowerCase();
    const results = norm
      ? tops.flatMap((t) =>
          (t.subs ?? [])
            .filter(
              (s) =>
                s.name.toLowerCase().includes(norm) || t.name.toLowerCase().includes(norm),
            )
            .map((s) => ({ top: t, sub: s })),
        )
      : [];

    return (
      <PortalLayout nav={EXPORTER_NAV} wide>
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-sm text-muted">
          <Link to="/exporter/products" className="hover:text-primary-700">Products</Link>
          <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
          <span className="font-medium text-ink-800">Add product</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink-900">What are you listing?</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Pick the closest category — it decides which details we ask for. Goods get trade fields,
          services get engagement fields, and each specialisation has its own specifications.
        </p>

        {tree.isPending ? (
          <div className="mt-6"><SkeletonRows rows={4} /></div>
        ) : (
          <div className="mt-6 rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
            <div className="relative mb-5 max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                aria-label="Search categories"
                placeholder="Search categories — e.g. cotton, software, spices…"
                className={inputClasses(false, 'pl-10 pr-10')}
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
              />
              {catQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setCatQuery('')}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {norm ? (
              results.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-surface-border px-4 py-6 text-sm text-muted">
                  <SearchOffIcon className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
                  No category matches &ldquo;{catQuery.trim()}&rdquo; — try another word, or browse
                  below. &ldquo;Other&rdquo; is at the end of the list.
                </div>
              ) : (
                <>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {results.length} match{results.length === 1 ? '' : 'es'}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {results.map(({ top: t, sub: s }) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => applyCategory({ topId: t.id, subId: s.id })}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-surface-border bg-white px-4 text-sm font-medium text-ink-800 transition-all hover:border-primary-600 hover:bg-primary-50 hover:text-primary-700"
                      >
                        <span className="text-xs text-muted">{t.name}</span>
                        <ChevronRightIcon className="h-3 w-3 text-ink-400" aria-hidden="true" />
                        {s.name}
                        {s.type === 'service' && (
                          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
                            Service
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )
            ) : null}

            <h2
              className={`text-[11px] font-semibold uppercase tracking-wider text-muted ${norm ? 'mt-6 border-t border-ink-100 pt-5' : ''}`}
            >
              {norm ? 'Or browse all categories' : 'Category'}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {tops.map((t) => {
                const selected = t.id === cat.topId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => applyCategory({ topId: t.id, subId: null })}
                    className={`flex min-h-[64px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? 'border-primary-600 bg-primary-50 shadow-card ring-1 ring-primary-600'
                        : 'border-surface-border bg-white hover:border-primary-400 hover:shadow-card'
                    }`}
                  >
                    {t.image ? (
                      <img
                        src={t.image}
                        alt=""
                        loading="lazy"
                        width={36}
                        height={36}
                        className={`h-9 w-9 shrink-0 rounded-lg object-cover ${
                          selected ? 'ring-2 ring-primary-600' : ''
                        }`}
                      />
                    ) : (
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          selected ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-700'
                        }`}
                        aria-hidden="true"
                      >
                        {initials(t.name)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {t.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {(t.subs ?? []).length} specialisations
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selTop && (
              <div ref={subsRef} className="mt-6 scroll-mt-4 border-t border-ink-100 pt-5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Specialisation in {selTop.name}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selTop.subs ?? []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applyCategory({ topId: selTop.id, subId: s.id })}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-surface-border bg-white px-4 text-sm font-medium text-ink-800 transition-all hover:border-primary-600 hover:bg-primary-50 hover:text-primary-700"
                    >
                      {s.name}
                      {s.type === 'service' && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
                          Service
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {fieldErrors.category && (
              <p className="mt-4 text-sm text-danger">{fieldErrors.category}</p>
            )}
          </div>
        )}
      </PortalLayout>
    );
  }

  /* ---------------- editor state ---------------- */

  const defs = attrs.data?.attributes ?? [];
  const specFilled = defs.filter((d) => {
    const v = specs[d.key];
    return v !== undefined && v !== null && v !== '';
  }).length;
  const requiredMissing = defs
    .filter((d) => {
      const v = specs[d.key];
      return d.required && (v === undefined || v === null || v === '');
    })
    .map((d) => d.name);
  const priceReady =
    form.price.mode === 'on_request' ||
    (form.price.min != null && (form.price.mode !== 'range' || form.price.max != null));

  const detailsDone = Boolean(form.name.trim()) && form.images.length > 0;
  const infoFields = isService ? SERVICE_FIELDS : GOODS_FIELDS;
  const infoDone = isService
    ? infoFields.some(([k]) => form[k])
    : Boolean(form.moq || form.unit || form.countryOfOrigin || infoFields.some(([k]) => form[k]));
  const specsDone = defs.length > 0 && specFilled === defs.length;

  // Listing strength — weighted, honest, capped at 100.
  const strength = Math.round(
    (form.name.trim() ? 25 : 0) +
      (form.images.length > 0 ? 20 : 0) +
      (priceReady ? 20 : 0) +
      (form.description.trim().length >= 60 ? 15 : 0) +
      (defs.length > 0 ? (specFilled / defs.length) * 20 : 20),
  );

  const previewSlug =
    product?.slug ??
    (form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
      'your-product');

  return (
    <PortalLayout nav={EXPORTER_NAV} wide>
      {/* --- floating action bar: Save is never a scroll away --- */}
      <div ref={editorTopRef} className="sticky top-0 z-20 mb-5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white/95 px-4 py-2.5 shadow-lift backdrop-blur">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted">
              <Link to="/exporter/products" className="hover:text-primary-700">Products</Link>
              <ChevronRightIcon className="h-3 w-3 text-ink-400" aria-hidden="true" />
              <span>{isEdit ? 'Edit product' : 'Add product'}</span>
            </nav>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="max-w-[48ch] truncate text-lg font-bold leading-tight text-ink-900">
                {form.name.trim() || (isEdit ? 'Edit product' : 'New product')}
              </h1>
              {isEdit && meta && <StatusChip label={meta.label} tone={meta.tone} />}
              {blocked && <StatusChip label="Taken down" tone="danger" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted md:block">
              {isEdit ? 'Changes save to this listing' : 'Saves as a draft — publish when ready'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/exporter/products')}>
              Cancel
            </Button>
            <Button size="sm" loading={save.isPending} onClick={trySave}>
              {isEdit ? 'Save changes' : 'Save draft'}
            </Button>
          </div>
        </div>
      </div>

      {/* Blocked banner up top; the FIELDS BELOW STAY EDITABLE so the seller can
          fix what was wrong. Only the lifecycle actions are gone (rail). */}
      {blocked && <BlockedBanner takedown={product.takedown} className="mb-5" />}
      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {errorCount > 0 && (
        <Alert tone="danger" className="mb-5">
          Fix {errorCount} {errorCount === 1 ? 'field' : 'fields'} to continue.
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ============ main column: ONE continuous guided card ============ */}
        <div className="min-w-0 rounded-2xl border border-surface-border bg-white pt-1 shadow-card">
          <FormSection
            step={1}
            done={detailsDone}
            title="Product details"
            desc="The name, story and photos buyers see first."
          >
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="space-y-5">
                <Field label="Product name" error={fieldErrors.name}>
                  {(fid, hasError) => (
                    <input
                      id={fid}
                      className={inputClasses(hasError)}
                      maxLength={200}
                      placeholder={
                        isService
                          ? 'e.g. Custom AI/ML Model Development'
                          : 'e.g. Combed Cotton Poplin Fabric, 120 GSM'
                      }
                      value={form.name}
                      onChange={(e) => {
                        set({ name: e.target.value });
                        setNameEdited(true);
                        setFieldErrors(({ name, ...rest }) => rest);
                      }}
                    />
                  )}
                </Field>
                {/* 🔴 A rename never changes the public URL — the slug is
                    immutable (§A6). Without this line it gets reported as a
                    broken link. */}
                {isEdit && nameEdited && (
                  <p className="-mt-3 text-xs text-muted">
                    Your product&apos;s web address stays the same.
                  </p>
                )}

                <Field
                  label="Description"
                  optional
                  helper="Details, use cases, certifications…"
                  trailing={
                    <span className="text-xs text-muted">{form.description.length}/5,000</span>
                  }
                >
                  {(fid) => (
                    <textarea
                      id={fid}
                      rows={6}
                      maxLength={5000}
                      className={inputClasses(false, 'h-auto py-3')}
                      value={form.description}
                      onChange={(e) => set({ description: e.target.value })}
                    />
                  )}
                </Field>
              </div>

              <ProductImageManager
                images={form.images}
                onChange={(images) => set({ images })}
                onUpload={productsApi.uploadImages}
              />
            </div>
          </FormSection>

          <FormSection
            step={2}
            done={priceReady}
            title="Pricing"
            desc="Fixed, a range, or on request — all read as normal to buyers."
          >
            <PriceInput
              value={form.price}
              onChange={(price) => {
                set({ price });
                setFieldErrors(({ price: _p, ...rest }) => rest);
              }}
              errors={fieldErrors.price ? { min: fieldErrors.price } : {}}
            />
          </FormSection>

          <FormSection
            step={3}
            done={infoDone}
            title={isService ? 'Service details' : 'Trade information'}
            desc="All optional — fill what helps a buyer decide."
            aside={
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                Optional
              </span>
            }
            last={defs.length === 0}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {!isService && (
                <>
                  <Field label="Minimum order quantity" optional>
                    {(fid) => (
                      <input
                        id={fid}
                        type="number"
                        min="0"
                        className={inputClasses(false)}
                        placeholder="e.g. 500"
                        value={form.moq}
                        onChange={(e) => set({ moq: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Unit" optional helper="e.g. pieces, kg, meters">
                    {(fid) => (
                      <input
                        id={fid}
                        className={inputClasses(false)}
                        value={form.unit}
                        onChange={(e) => set({ unit: e.target.value })}
                      />
                    )}
                  </Field>
                  <CountrySelect
                    label="Country of origin"
                    value={form.countryOfOrigin}
                    onChange={(v) => set({ countryOfOrigin: v })}
                  />
                </>
              )}
              {infoFields.map(([key, label, helper]) => (
                <Field key={key} label={label} optional helper={helper || undefined}>
                  {(fid) => (
                    <input
                      id={fid}
                      className={inputClasses(false)}
                      value={form[key]}
                      onChange={(e) => set({ [key]: e.target.value })}
                    />
                  )}
                </Field>
              ))}
            </div>
          </FormSection>

          {defs.length > 0 && (
            <FormSection
              step={4}
              done={specsDone}
              last
              title="Specifications"
              desc={`What buyers filter and compare on for ${leaf?.name ?? 'this category'}.`}
              aside={
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                  {specFilled}/{defs.length} filled
                </span>
              }
            >
              <AttributeFields defs={defs} values={specs} onChange={setSpecs} />
              <p className="text-xs text-muted">
                You can save a draft with these blank — required specifications are only checked
                when you publish.
              </p>
            </FormSection>
          )}
        </div>

        {/* ================= sticky context rail ================= */}
        <aside className="space-y-4 lg:sticky lg:top-[84px]">
          <RailCard label="Category">
            {changingCat ? (
              <div className="space-y-3">
                <CategoryPicker
                  tree={tree.data ?? []}
                  topId={cat.topId}
                  subId={cat.subId}
                  onChange={applyCategory}
                />
                <Button size="sm" variant="ghost" onClick={() => setChangingCat(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted">{top?.name}</p>
                  <p className="truncate text-sm font-semibold text-ink-900">{leaf?.name}</p>
                  <span className="mt-1.5 inline-block rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
                    {isService ? 'Service' : 'Goods'}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setChangingCat(true)}>
                  Change
                </Button>
              </div>
            )}
          </RailCard>

          {isEdit && (
            <RailCard label="Status">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip label={meta?.label} tone={meta?.tone} />
                {blocked && <StatusChip label="Taken down" tone="danger" />}
              </div>
              {/* Publish/Hide are refused while taken down — the server enforces
                  it too, so hiding them is honest UI, not the control. */}
              {blocked ? (
                <p className="mt-3 text-xs text-muted">
                  Removed by the MPX team — it can&apos;t be published or hidden until it&apos;s
                  restored. You can still edit and save.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.status !== 'active' && (
                    <Button
                      size="sm"
                      loading={setStatus.isPending}
                      onClick={() => setStatus.mutate('active')}
                    >
                      Publish
                    </Button>
                  )}
                  {product.status === 'active' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={setStatus.isPending}
                      onClick={() => setStatus.mutate('inactive')}
                    >
                      Hide
                    </Button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-danger"
              >
                <TrashIcon className="h-4 w-4" aria-hidden="true" /> Delete product
              </button>
            </RailCard>
          )}

          <RailCard label="Buyer preview">
            {/* The real public card inside a browser-chrome frame, showing the
                page it will become. No `to` → static, never a dead link. */}
            <div className="overflow-hidden rounded-lg border border-ink-200">
              <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-50 px-2.5 py-2">
                <span className="h-2 w-2 rounded-full bg-ink-200" aria-hidden="true" />
                <span className="h-2 w-2 rounded-full bg-ink-200" aria-hidden="true" />
                <span className="h-2 w-2 rounded-full bg-ink-200" aria-hidden="true" />
                <span className="ml-1 min-w-0 flex-1 truncate rounded-full bg-white px-2.5 py-0.5 text-[10px] text-muted">
                  /product/{previewSlug}
                </span>
              </div>
              <ul className="bg-surface-subtle p-3">
                <ProductCard
                  product={{
                    name: form.name.trim() || 'Untitled product',
                    images: form.images.map((i) => i.url),
                    price: form.price,
                    unit: form.unit || undefined,
                    moq: form.moq !== '' ? Number(form.moq) : undefined,
                    // Live specs → the card's chips, same as buyers will see.
                    attributes: toAttributeArray(specs),
                    category: { name: leaf?.name },
                    // The seller row buyers see on every catalogue card — own
                    // org, self-scoped; tick derives from own kycStatus.
                    seller: org.data
                      ? {
                          name: org.data.name,
                          verified: org.data.kycStatus === 'verified',
                          country: org.data.country,
                        }
                      : undefined,
                  }}
                />
              </ul>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
              <EyeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Updates live as you type.
            </p>
          </RailCard>

          <RailCard label="Listing strength">
            <div className="flex items-center gap-3">
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    strength >= 80 ? 'bg-success-500' : 'bg-primary-600'
                  }`}
                  style={{ width: `${strength}%` }}
                />
              </div>
              <span className="text-sm font-bold text-ink-900">{strength}%</span>
            </div>
            <ul className="mt-3 space-y-2">
              <ChecklistRow done={Boolean(form.name.trim())}>Name</ChecklistRow>
              <ChecklistRow done={form.images.length > 0}>
                {form.images.length > 0
                  ? `${form.images.length} photo${form.images.length === 1 ? '' : 's'}`
                  : 'Photos — listings with photos get more enquiries'}
              </ChecklistRow>
              <ChecklistRow done={priceReady}>Price</ChecklistRow>
              <ChecklistRow done={form.description.trim().length >= 60} quiet>
                Description (60+ characters)
              </ChecklistRow>
              {defs.length > 0 && (
                <ChecklistRow done={specsDone} quiet>
                  Specifications ({specFilled}/{defs.length})
                </ChecklistRow>
              )}
              {requiredMissing.length > 0 && (
                <li className="mt-1 rounded-lg bg-warning-50 px-3 py-2 text-[12px] text-warning-800">
                  Needed before publishing: {requiredMissing.join(', ')}
                </li>
              )}
            </ul>
          </RailCard>
        </aside>
      </div>

      {/* --- dialogs (unchanged behaviour) --- */}
      <Modal
        open={Boolean(pendingCat)}
        onClose={() => setPendingCat(null)}
        centered
        title="Change category?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingCat(null)}>Cancel</Button>
            <Button
              onClick={() => {
                setCat(pendingCat);
                setSpecs({});
                setPendingCat(null);
                setChangingCat(false);
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        Changing category clears the specifications you&apos;ve filled in.
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        centered
        danger
        icon={TrashIcon}
        title="Delete this product?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" loading={archive.isPending} onClick={() => archive.mutate()}>
              Archive product
            </Button>
          </>
        }
      >
        This archives the product. It disappears from the catalogue and can&apos;t be edited or
        restored — to sell it again later, create a new listing. Your product name and web address
        become free to reuse.
      </Modal>
    </PortalLayout>
  );
}
