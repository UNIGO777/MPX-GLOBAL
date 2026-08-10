import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { productKeys, productsApi } from '../../api/products.js';
import {
  AttributeFields,
  fromAttributeArray,
  toAttributeArray,
} from '../../components/catalogue/AttributeFields.jsx';
import { BlockedBanner } from '../../components/catalogue/BlockedBanner.jsx';
import { CategoryPicker } from '../../components/catalogue/CategoryPicker.jsx';
import { PriceInput } from '../../components/catalogue/PriceInput.jsx';
import { ProductImageManager } from '../../components/catalogue/ProductImageManager.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { BoxIcon, ChevronRightIcon, TrashIcon } from '../../components/ui/icons.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { PRODUCT_STATUS_META } from '../../lib/productStatus.js';

/**
 * M2 web screens 6 AND 7 — add (`/exporter/products/new`) and edit
 * (`/exporter/products/:id/edit`) are ONE component.
 *
 * The brief wants them visually identical "so the flow feels like one place";
 * two files would guarantee they drift. `id` absent = create.
 *
 * 🔴 THE SELLER NEVER PICKS GOODS VS SERVICE. The chosen leaf's `type` decides
 * which fixed-field group renders and which specs are asked for (§A14). There is
 * no toggle anywhere in this file.
 *
 * 🔴 SAVE CREATES A DRAFT. Required specifications are NOT enforced here — the
 * server only demands them at PUBLISH, so a seller can save half-finished work
 * without a fight. Publishing is a separate, deliberate act.
 *
 * 🔴 DRAFT IS ONE-WAY (§A1) — nothing here can send a published product back.
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

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-surface-border bg-white p-6 shadow-card">
      <h2 className="mb-5 text-lg font-bold text-ink-900">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  // 🔴 Design + brief: the 10-draft cap blocks BEFORE the seller fills anything
  // in — a full-page notice with no form beneath it, not an error at save. One
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

  // The leaf decides the field group AND the spec definitions.
  const leaf = useMemo(() => {
    for (const top of tree.data ?? []) {
      const sub = (top.subs ?? []).find((s) => s.id === cat.subId);
      if (sub) return sub;
    }
    return null;
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
    setForm({ ...EMPTY, ...Object.fromEntries(
      Object.keys(EMPTY).map((k) => [k, p[k] ?? EMPTY[k]]),
    ), price: p.price ?? EMPTY.price, images: [] });
    setSpecs(fromAttributeArray(p.attributes));
    for (const top of tree.data) {
      if ((top.subs ?? []).some((s) => s.id === p.categoryId)) {
        setCat({ topId: top.id, subId: p.categoryId });
        break;
      }
    }
  }, [existing.data, tree.data]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function applyCategory(next) {
    // Changing the leaf re-renders the spec fields and drops values that belong
    // to the old category — warn before discarding entered work.
    const hasSpecs = Object.keys(specs).length > 0;
    if (hasSpecs && next.subId && next.subId !== cat.subId) {
      setPendingCat(next);
      return;
    }
    setCat(next);
    if (next.subId !== cat.subId) setSpecs({});
  }

  const body = useMemo(() => {
    const isService = leaf?.type === 'service';
    const out = {
      name: form.name,
      categoryId: cat.subId,
      price: form.price,
      attributes: toAttributeArray(specs),
      ...(form.description ? { description: form.description } : {}),
      ...(form.images.length ? { images: form.images } : {}),
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
  const fixedFields = isService ? SERVICE_FIELDS : GOODS_FIELDS;
  const chosen = Boolean(cat.subId);

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

  return (
    <PortalLayout nav={EXPORTER_NAV}>
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-sm text-muted">
        <Link to="/exporter/products" className="hover:text-primary-700">Products</Link>
        <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
        <span className="font-medium text-ink-800">{isEdit ? 'Edit product' : 'Add product'}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-900">
          {isEdit ? 'Edit product' : 'Add product'}
        </h1>

        {/* Edit-only lifecycle strip. */}
        {isEdit && product && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={meta?.label} tone={meta?.tone} />
            {blocked && <StatusChip label="Taken down" tone="danger" />}
            {/* Publish/Hide are refused while taken down — the server enforces
                it too, so this is honest UI, not the control. */}
            {!blocked && product.status !== 'active' && (
              <Button size="sm" loading={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
                Publish
              </Button>
            )}
            {!blocked && product.status === 'active' && (
              <Button size="sm" variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate('inactive')}>
                Hide
              </Button>
            )}
            <Button size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Blocked banner sits at the very top; the FIELDS BELOW STAY EDITABLE so
          the seller can fix what was wrong. Only the lifecycle actions are gone. */}
      {blocked && <BlockedBanner takedown={product.takedown} className="mb-6" />}

      {error && <Alert tone="danger" className="mb-6">{error}</Alert>}
      {errorCount > 0 && (
        <Alert tone="danger" className="mb-6">
          Fix {errorCount} {errorCount === 1 ? 'field' : 'fields'} to continue.
        </Alert>
      )}

      {/* Design: a slim in-page section nav at desktop — the form is the longest
          in the product and the nav is how you get back to Pricing from the
          bottom of Specifications. Anchors only; hidden below lg. */}
      <div className="flex gap-8">
        <aside className="hidden w-40 shrink-0 lg:block" aria-label="Form sections">
          <ol className="sticky top-6 space-y-1 border-l border-surface-border text-sm">
            {[['section-category', 'Category'], ['section-details', 'Details'],
              ['section-pricing', 'Pricing'],
              ['section-trade', leaf?.type === 'service' ? 'Service details' : 'Trade details'],
              ...((attrs.data?.attributes?.length ?? 0) > 0 ? [['section-specs', 'Specifications']] : []),
            ].map(([anchor, label]) => (
              <li key={anchor}>
                <a
                  href={`#${anchor}`}
                  className="-ml-px block border-l-2 border-transparent px-3 py-1.5 text-ink-600 hover:border-primary-600 hover:text-primary-700"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <Section id="section-category" title="Category">
          <CategoryPicker
            tree={tree.data ?? []}
            topId={cat.topId}
            subId={cat.subId}
            onChange={(next) => { setFieldErrors(({ category, ...rest }) => rest); applyCategory(next); }}
            error={fieldErrors.category}
          />
        </Section>

        {/* 🔴 Zones B and C are ABSENT until a sub-category is chosen — not
            greyed out, not disabled. The field set depends entirely on the leaf,
            so there is nothing meaningful to show yet. */}
        {!chosen ? (
          <p className="rounded-lg border border-dashed border-surface-border bg-white px-6 py-10 text-center text-sm text-muted">
            Choose a category to continue.
          </p>
        ) : (
          <>
            <Section id="section-details" title="Details">
              <Field label="Product name" error={fieldErrors.name}>
                {(fid, hasError) => (
                  <input
                    id={fid}
                    className={inputClasses(hasError)}
                    maxLength={200}
                    value={form.name}
                    onChange={(e) => { set({ name: e.target.value }); setNameEdited(true); setFieldErrors(({ name, ...rest }) => rest); }}
                  />
                )}
              </Field>
              {/* 🔴 A rename never changes the public URL — the slug is immutable
                  (§A6). Without this line it gets reported as a broken link. */}
              {isEdit && nameEdited && (
                <p className="-mt-3 text-xs text-muted">Your product&apos;s web address stays the same.</p>
              )}

              <Field
                label="Description"
                optional
                helper="Details, use cases, certifications…"
                trailing={<span className="text-xs text-muted">{form.description.length}/5,000</span>}
              >
                {(fid) => (
                  <textarea
                    id={fid}
                    rows={5}
                    maxLength={5000}
                    className={inputClasses(false, 'h-auto py-3')}
                    value={form.description}
                    onChange={(e) => set({ description: e.target.value })}
                  />
                )}
              </Field>

              <ProductImageManager
                images={form.images}
                onChange={(images) => set({ images })}
                onUpload={productsApi.uploadImages}
              />
            </Section>

            <Section id="section-pricing" title="Pricing">
              <PriceInput
                value={form.price}
                onChange={(price) => { set({ price }); setFieldErrors(({ price: _p, ...rest }) => rest); }}
                errors={fieldErrors.price ? { min: fieldErrors.price } : {}}
              />
            </Section>

            <Section id="section-trade" title={isService ? 'Service details' : 'Trade details'}>
              {!isService && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Minimum order quantity" optional>
                    {(fid) => (
                      <input
                        id={fid}
                        type="number"
                        min="0"
                        className={inputClasses(false)}
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
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                {fixedFields.map(([key, label, helper]) => (
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
            </Section>

            {(attrs.data?.attributes?.length ?? 0) > 0 && (
              <Section id="section-specs" title="Specifications">
                <AttributeFields
                  defs={attrs.data.attributes}
                  values={specs}
                  onChange={setSpecs}
                />
                <p className="text-xs text-muted">
                  You can save a draft with these blank — required specifications are only checked
                  when you publish.
                </p>
              </Section>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button loading={save.isPending} onClick={trySave}>
            {isEdit ? 'Save changes' : 'Save draft'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/exporter/products')}>Cancel</Button>
        </div>
      </div>
      </div>

      <Modal
        open={Boolean(pendingCat)}
        onClose={() => setPendingCat(null)}
        centered
        title="Change category?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingCat(null)}>Cancel</Button>
            <Button
              onClick={() => { setCat(pendingCat); setSpecs({}); setPendingCat(null); }}
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
