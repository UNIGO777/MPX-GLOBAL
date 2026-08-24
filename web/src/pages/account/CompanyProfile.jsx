import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { organisationApi, organisationKeys } from '../../api/organisation.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import {
  BuildingIcon,
  ExternalIcon,
  GlobeIcon,
  KeyIcon,
  ShieldIcon,
  TrashIcon,
  UploadIcon,
} from '../../components/ui/icons.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { BUYER_NAV } from '../buyer/buyerNav.js';
import { EXPORTER_NAV } from '../exporter/exporterNav.js';
import { countryName } from '../../lib/countries.js';
import { statesFor } from '../../lib/states.js';

/**
 * §A22 · Company profile — the owner's view and edit of their own Organisation.
 * ONE component, both portals; what differs is by SIDE, not by file:
 *
 *   buyer     → name · country · address · entityType, single column. No logo,
 *               no description, no preview — a buyer has no public page.
 *   exporter  → the same, plus LOGO + DESCRIPTION (this screen is their ONLY
 *               capture path — the public supplier page renders whatever is set
 *               here) in a workspace layout: edit column + STICKY RAIL carrying
 *               the live public preview, verification state and account.
 *
 * REDESIGNED 2026-08-11 to the M2 language (screens 5/6 set it): sticky
 * floating action bar, icon-chip section cards, hybrid Combobox, and — exporter
 * only — the editor-plus-context-rail structure, so the public consequences of
 * an edit sit beside the fields being edited.
 *
 * 🔴 THE LOCK + PENDING-CHANGE RULE IS THE HEART OF IT (A22.1/A22.2). Name,
 * country, address and entityType are what an Employee verified against the
 * documents. On a VERIFIED org they stay editable — companies genuinely rename
 * and move — but the change does NOT touch the live profile or the tick: it is
 * parked in `pendingChanges`, supported by fresh documents, and applied only on
 * a reviewer's approval.
 *
 * ⚠️ This comment used to describe the old demote-on-edit rule ("drops
 * `kycStatus` back to `submitted`"), which was retired 2026-08-19. `LOCKED_HELP`
 * below still carried that wording until 2026-08-23 — worth knowing that this
 * file's prose lagged its own behaviour once already.
 *
 * entityType is an ordinary locked field for BOTH sides (owner, 2026-08-19 —
 * the exporter "read-only in every state" rule is retired). Changing it changes
 * which KYC documents apply.
 *
 * This screen is also the fix for the PROFILE_INCOMPLETE dead end: KYC uploads
 * are refused until name + country + address(line1/city/postalCode) exist, and
 * until now the web had nowhere to complete them.
 */
/**
 * 🔴 CORRECTED 2026-08-23. This said "your company will return to review and the
 * verified tick is withheld until re-approval" — the OLD demote-on-edit model,
 * retired on 2026-08-19 when the pending-change model shipped. It contradicted
 * the pending banner rendered a few lines below it, which correctly says the
 * live profile and badge stay unchanged.
 *
 * It was not just stale, it was a deterrent: it told a verified company that
 * correcting its own registered address would cost it the tick.
 */
const LOCKED_HELP =
  'These details were checked against your documents. You can still change them — a reviewer ' +
  'approves the change first, and your live profile and verified tick stay exactly as they are ' +
  'until they do.';

const EMPTY_ADDRESS = { line1: '', line2: '', city: '', state: '', postalCode: '' };

/** Section card in the M2 language: tinted icon chip · title · purpose line. */
function SectionCard({ icon: Icon, title, desc, children }) {
  return (
    <section className="rounded-2xl border border-surface-border bg-white shadow-card">
      <header className="flex items-start gap-3 border-b border-ink-100 px-6 py-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {desc && <p className="text-[13px] text-muted">{desc}</p>}
        </span>
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </section>
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

/** "old → new" for one pending field — address collapses to its one-line form. */
function PendingDiff({ field, live, values }) {
  const fmt = (v) =>
    field === 'address'
      ? Object.values(v ?? {}).filter(Boolean).join(', ') || '—'
      : field === 'entityType'
        ? (v === 'individual' ? 'Individual' : v === 'business' ? 'Business' : '—')
        : (v ?? '—');
  return (
    <>
      <span className="line-through decoration-ink-300">{fmt(field === 'address' ? live.address : live[field])}</span>
      <span aria-hidden="true" className="mx-1 text-ink-400">→</span>
      <span className="font-medium text-ink-900">{fmt(field === 'address' ? values.address : values[field])}</span>
    </>
  );
}

export function CompanyProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isExporter = user?.role === 'exporter';
  const logoRef = useRef(null);
  const coverRef = useRef(null);

  const [form, setForm] = useState(null); // null until the org loads
  const [confirmSubmit, setConfirmSubmit] = useState(false); // verified + locked change → review
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [draggingLogo, setDraggingLogo] = useState(false);
  const [draggingCover, setDraggingCover] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const org = useQuery({ queryKey: organisationKeys.mine, queryFn: organisationApi.mine });

  // The public preview IS the public endpoint — the same projection a guest
  // gets, so it cannot drift from what buyers actually see (A22).
  const preview = useQuery({
    queryKey: catalogueKeys.exporter(org.data?.slug),
    queryFn: () => catalogueApi.exporter(org.data.slug),
    enabled: isExporter && Boolean(org.data?.slug),
  });

  // Load-once into local form state.
  if (org.data && form === null) {
    // Seed from live values with any PENDING values overlaid — the form edits
    // the version under review, and setting a field back to its live value is
    // how a user backs it out (the server drops it from the pending set).
    const pv = org.data.pendingChanges?.values ?? {};
    setForm({
      name: pv.name ?? org.data.name ?? '',
      country: pv.country ?? org.data.country ?? '',
      entityType: pv.entityType ?? org.data.entityType ?? '',
      description: org.data.description ?? '',
      address: { ...EMPTY_ADDRESS, ...org.data.address, ...(pv.address ?? {}) },
    });
  }

  const verified = org.data?.kycStatus === 'verified';
  const pending = org.data?.pendingChanges ?? null;
  // Self-scoped read of the OWN org — the one place raw kycStatus is
  // legitimate (web-design.md). Only two states get a chip; rejection
  // messaging belongs to the verification screen, not a passing badge.
  const statusChip = verified
    ? { label: 'Verified', tone: 'success' }
    : org.data?.kycStatus === 'submitted'
      ? { label: 'In review', tone: 'warning' }
      : null;

  /** Which locked fields differ from the loaded org right now. */
  const lockedChanges = useMemo(() => {
    if (!org.data || !form) return [];
    const out = [];
    const same = (a, b) => (String(a ?? '').trim() === String(b ?? '').trim());
    if (!same(form.name, org.data.name)) out.push('name');
    if (!same(form.country, org.data.country)) out.push('country');
    if (!same(form.entityType, org.data.entityType)) out.push('entity type');
    if (Object.keys(EMPTY_ADDRESS).some((k) => !same(form.address[k], org.data.address?.[k]))) {
      out.push('address');
    }
    return out;
  }, [org.data, form]);

  const descriptionChanged =
    isExporter && form && (form.description ?? '') !== (org.data?.description ?? '');

  /** Pending fields the form now sets BACK to the live value — reverts. */
  const revertedFields = useMemo(() => {
    if (!pending || !form || !org.data) return [];
    const same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
    return pending.changedFields.filter((f) => {
      if (f === 'address') {
        return Object.keys(EMPTY_ADDRESS).every((k) => same(form.address[k], org.data.address?.[k]));
      }
      const key = f === 'entityType' ? 'entityType' : f;
      return same(form[key], org.data[key]);
    });
  }, [pending, form, org.data]);

  const dirty = lockedChanges.length > 0 || descriptionChanged || revertedFields.length > 0;

  const buildPatch = () => {
    const has = (f) => lockedChanges.includes(f) || revertedFields.includes(f.replace(' ', ''));
    return {
      // Reverted fields are sent ON PURPOSE, equal to live — that is the
      // server's signal to drop them from the pending set.
      ...(has('name') || revertedFields.includes('name') ? { name: form.name } : {}),
      ...(has('country') || revertedFields.includes('country') ? { country: form.country } : {}),
      ...(lockedChanges.includes('entity type') || revertedFields.includes('entityType')
        ? { entityType: form.entityType }
        : {}),
      ...(has('address') || revertedFields.includes('address') ? { address: form.address } : {}),
      ...(descriptionChanged ? { description: form.description } : {}),
    };
  };

  const save = useMutation({
    mutationFn: () => organisationApi.update(buildPatch()),
    onMutate: () => { setError(null); setNotice(null); },
    onSuccess: ({ organisation }) => {
      qc.setQueryData(organisationKeys.mine, organisation);
      // 🔴 The preview is keyed on the SLUG, and a rename never changes the slug
      // (A6) — so without an explicit invalidation the "How buyers see you"
      // panel keeps its cached copy and looks like the save didn't take. The
      // seller block inside cached product responses goes stale the same way,
      // and a demotion must drop the preview's tick immediately.
      qc.invalidateQueries({ queryKey: ['catalogue', 'exporter'] });
      qc.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      qc.invalidateQueries({ queryKey: ['catalogue', 'product'] });
      setForm(null); // re-seed from the fresh copy
      setConfirmSubmit(false);
      const pc = organisation.pendingChanges;
      setNotice(
        pc
          ? pc.state === 'awaiting_documents'
            ? 'Saved for review. Your live profile and verified badge stay unchanged — upload the supporting documents from the Verification page so our team can approve the new details.'
            : 'Your change under review was updated. The live profile and verified badge stay unchanged until our team approves it.'
          : 'Saved.',
      );
    },
    onError: (err) => {
      setConfirmSubmit(false);
      setError(err?.response?.data?.error?.message ?? 'Could not save.');
    },
  });

  const cancelChange = useMutation({
    mutationFn: organisationApi.cancelPendingChanges,
    onMutate: () => { setError(null); setNotice(null); },
    onSuccess: (organisation) => {
      qc.setQueryData(organisationKeys.mine, organisation);
      qc.invalidateQueries({ queryKey: ['kyc'] });
      setForm(null);
      setConfirmCancel(false);
      setNotice('Change cancelled. Your profile stays exactly as it was verified.');
    },
    onError: (err) => {
      setConfirmCancel(false);
      setError(err?.response?.data?.error?.message ?? 'Could not cancel the change.');
    },
  });

  const trySave = () => {
    // A verified org creating/extending a pending set gets the review explainer
    // first; pure reverts and description edits save without ceremony.
    if (verified && lockedChanges.length > 0 && !pending) {
      setConfirmSubmit(true);
      return;
    }
    save.mutate();
  };

  const acceptLogo = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Logo must be a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be 5 MB or smaller.');
      return;
    }
    logoUpload.mutate(file);
  };

  const acceptCover = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Cover image must be a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Cover image must be 8 MB or smaller.');
      return;
    }
    coverUpload.mutate(file);
  };

  const logoUpload = useMutation({
    mutationFn: (file) => organisationApi.uploadLogo(file),
    onMutate: () => setError(null),
    onSuccess: (organisation) => {
      qc.setQueryData(organisationKeys.mine, organisation);
      qc.invalidateQueries({ queryKey: catalogueKeys.exporter(organisation.slug) });
    },
    onError: (err) => setError(err?.response?.data?.error?.message ?? 'Could not upload the logo.'),
  });
  // Cover banner (2026-08-17) — same cache handling as the logo: update the
  // owner view AND invalidate the public preview so the page below refreshes.
  const coverUpload = useMutation({
    mutationFn: (file) => organisationApi.uploadCover(file),
    onMutate: () => setError(null),
    onSuccess: (organisation) => {
      qc.setQueryData(organisationKeys.mine, organisation);
      qc.invalidateQueries({ queryKey: catalogueKeys.exporter(organisation.slug) });
    },
    onError: (err) => setError(err?.response?.data?.error?.message ?? 'Could not upload the cover image.'),
  });
  const coverRemove = useMutation({
    mutationFn: organisationApi.removeCover,
    onMutate: () => setError(null),
    onSuccess: (organisation) => {
      qc.setQueryData(organisationKeys.mine, organisation);
      qc.invalidateQueries({ queryKey: catalogueKeys.exporter(organisation.slug) });
    },
    onError: (err) => setError(err?.response?.data?.error?.message ?? 'Could not remove the cover image.'),
  });

  const logoRemove = useMutation({
    mutationFn: organisationApi.removeLogo,
    onSuccess: (organisation) => {
      qc.setQueryData(organisationKeys.mine, organisation);
      qc.invalidateQueries({ queryKey: catalogueKeys.exporter(organisation.slug) });
    },
  });

  const nav = isExporter ? EXPORTER_NAV : BUYER_NAV;

  // State list for the chosen country — countries we don't have a list for
  // fall back to free text (`address.state` is an unconstrained string
  // server-side, so the dropdown is UX, not contract). A saved value that
  // isn't in the list (typed before the dropdown existed, or the country
  // changed) is kept as an extra option so it still displays.
  const stateOptions = useMemo(() => {
    const list = form ? statesFor(form.country) : null;
    if (!list) return null;
    const current = form.address.state?.trim();
    return (current && !list.includes(current) ? [current, ...list] : list).map((s) => ({
      value: s,
      label: s,
    }));
  }, [form]);

  /* ---------------- shared section blocks ---------------- */

  const registeredCard = form && (
    <SectionCard
      icon={BuildingIcon}
      title="Registered details"
      desc={verified ? 'Verified against your documents — changes go back to review.' : 'What we verify your documents against.'}
    >
      <Field label="Company name">
        {(id) => (
          <input
            id={id}
            className={inputClasses(false)}
            maxLength={200}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        )}
      </Field>
      {/* A6: the slug never changes on rename — say so or it gets reported as a
          broken public link later. */}
      {isExporter && lockedChanges.includes('name') && org.data?.slug && (
        <p className="-mt-3 text-xs text-muted">
          Your public web address (/supplier/{org.data.slug}) stays the same.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <CountrySelect
          value={form.country}
          onChange={(v) => setForm((f) => ({ ...f, country: v }))}
        />
        <Field
          label="Entity type"
          helper={
            isExporter
              ? 'Decides which KYC documents we ask for — changing it means providing the other set.'
              : "Determines which KYC documents you'd provide."
          }
        >
          {(id) => (
            <Combobox
              id={id}
              value={form.entityType || null}
              placeholder="Select"
              options={[
                { value: 'business', label: 'Business' },
                { value: 'individual', label: 'Individual' },
              ]}
              onChange={(v) => setForm((f) => ({ ...f, entityType: v }))}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Address line 1">
          {(id) => (
            <input id={id} className={inputClasses(false)} maxLength={200} value={form.address.line1}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, line1: e.target.value } }))} />
          )}
        </Field>
        <Field label="Address line 2" optional>
          {(id) => (
            <input id={id} className={inputClasses(false)} maxLength={200} value={form.address.line2}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, line2: e.target.value } }))} />
          )}
        </Field>
        <Field label="City">
          {(id) => (
            <input id={id} className={inputClasses(false)} maxLength={100} value={form.address.city}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, city: e.target.value } }))} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-5">
          <Field label="State" optional>
            {(id) =>
              stateOptions ? (
                <Combobox
                  id={id}
                  value={form.address.state || null}
                  placeholder="Choose a state"
                  options={stateOptions}
                  onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, state: v } }))}
                />
              ) : (
                <input id={id} className={inputClasses(false)} maxLength={100} value={form.address.state}
                  onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, state: e.target.value } }))} />
              )
            }
          </Field>
          <Field label="Postal code">
            {(id) => (
              <input id={id} className={inputClasses(false)} maxLength={20} value={form.address.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, postalCode: e.target.value } }))} />
            )}
          </Field>
        </div>
      </div>
    </SectionCard>
  );

  /**
   * The company ICON dropzone.
   *
   * Extracted 2026-08-17 so BOTH parties can use it. For an exporter it is
   * storefront content — the image on their public seller page. For a buyer
   * it is not public at all: it appears in their own portal and as the
   * counterparty avatar inside conversations they are already party to.
   */
  // The whole zone is a dropzone AND a click target — same interaction as the
  // product image manager, one file.
  const logoDropzone = (
      <div
        role="button"
        tabIndex={0}
        aria-label={org.data?.logo ? 'Replace logo' : 'Upload logo'}
        onClick={() => logoRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && logoRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDraggingLogo(true); }}
        onDragLeave={() => setDraggingLogo(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingLogo(false);
          acceptLogo(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 border-dashed p-4 transition-colors ${
          draggingLogo
            ? 'border-primary-600 bg-primary-50'
            : 'border-surface-border hover:bg-surface-subtle'
        }`}
      >
        {org.data?.logo ? (
          <img src={org.data.logo} alt="" className="h-20 w-20 rounded-lg border border-surface-border object-cover" />
        ) : (
          <NoImagePanel label={org.data?.name} monogram ratio="h-20 w-20" className="shrink-0 rounded-lg" />
        )}
        <div>
          <span className="text-sm font-medium text-ink-900">Logo</span>
          <p className="text-xs text-muted">
            Drag an image here, or click to browse · JPG, PNG or WEBP · 5 MB max
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={logoUpload.isPending}
              onClick={(e) => { e.stopPropagation(); logoRef.current?.click(); }}
            >
              <UploadIcon className="mr-1.5 h-4 w-4" />
              {org.data?.logo ? 'Replace' : 'Upload'}
            </Button>
            {org.data?.logo && (
              <Button
                size="sm"
                variant="ghost"
                loading={logoRemove.isPending}
                onClick={(e) => { e.stopPropagation(); logoRemove.mutate(); }}
              >
                <TrashIcon className="mr-1 h-4 w-4 text-danger" /> Remove
              </Button>
            )}
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              acceptLogo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
  );

  const storefrontCard = form && isExporter && (
    <SectionCard
      icon={GlobeIcon}
      title="Public storefront"
      desc="Shown on your public supplier page — changing these never affects your verification."
    >
      {/* COVER BANNER (2026-08-17). Sits above the logo because it is the
          wider, more prominent asset on the public page — and because it was
          previously impossible to set: the field shipped with the profile
          redesign but had no upload path, so every real exporter fell back to
          the gradient. Same dropzone interaction as the logo below. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={org.data?.coverImage ? 'Replace cover image' : 'Upload cover image'}
        onClick={() => coverRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && coverRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDraggingCover(true); }}
        onDragLeave={() => setDraggingCover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingCover(false);
          acceptCover(e.dataTransfer.files?.[0]);
        }}
        className={`mb-4 cursor-pointer rounded-xl border-2 border-dashed p-4 transition-colors ${
          draggingCover ? 'border-primary-600 bg-primary-50' : 'border-surface-border hover:bg-surface-subtle'
        }`}
      >
        {org.data?.coverImage ? (
          <img
            src={org.data.coverImage}
            alt=""
            className="aspect-[4/1] w-full rounded-lg border border-surface-border object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="aspect-[4/1] w-full rounded-lg bg-gradient-to-r from-primary-800 via-primary-700 to-primary-500"
          />
        )}
        <div className="mt-3">
          <span className="text-sm font-medium text-ink-900">Cover banner</span>
          <p className="text-xs text-muted">
            The wide image behind your name on your public page · a 4:1 landscape works best ·
            JPG, PNG or WEBP · 8 MB max
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={coverUpload.isPending}
              onClick={(e) => { e.stopPropagation(); coverRef.current?.click(); }}
            >
              <UploadIcon className="mr-1.5 h-4 w-4" />
              {org.data?.coverImage ? 'Replace' : 'Upload'}
            </Button>
            {org.data?.coverImage && (
              <Button
                size="sm"
                variant="ghost"
                loading={coverRemove.isPending}
                onClick={(e) => { e.stopPropagation(); coverRemove.mutate(); }}
              >
                <TrashIcon className="mr-1 h-4 w-4 text-danger" /> Remove
              </Button>
            )}
          </div>
          <input
            ref={coverRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              acceptCover(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {logoDropzone}

      <Field
        label="Description"
        optional
        helper="What you make, for whom, since when."
        trailing={<span className="text-xs text-muted">{form.description.length}/500</span>}
      >
        {(id) => (
          <textarea
            id={id}
            rows={4}
            maxLength={500}
            className={inputClasses(false, 'h-auto py-3')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        )}
      </Field>
    </SectionCard>
  );

  /**
   * 🔴 Buyers can set a company icon too (owner, 2026-08-17). It used to be
   * exporter-only, because the logo existed to fill the public seller page.
   *
   * A buyer's icon is NOT public — there is no public buyer page — so this card
   * says where it actually shows up, rather than implying a storefront the buyer
   * does not have. Description and cover stay exporter-only for that reason.
   */
  const buyerIconCard = form && !isExporter && (
    <SectionCard
      icon={BuildingIcon}
      title="Company icon"
      desc="Shown in your portal and to suppliers you are in conversation with. It is not published anywhere public, and changing it never affects your verification."
    >
      {logoDropzone}
    </SectionCard>
  );

  const accountBody = (
    <Link
      to="/change-password"
      className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:underline"
    >
      <KeyIcon className="h-4 w-4" /> Change password
    </Link>
  );

  return (
    <PortalLayout nav={nav} wide={isExporter}>
      {/* --- floating action bar: Save is never a scroll away --- */}
      <div className="sticky top-0 z-20 mb-5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white/95 px-4 py-2.5 shadow-lift backdrop-blur">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold leading-tight text-ink-900">Company profile</h1>
              {statusChip && <StatusChip label={statusChip.label} tone={statusChip.tone} />}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {isExporter
                ? 'What buyers see on your public page, and the registered details we verify.'
                : 'Your registered company details. We check these if you choose to get verified.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <>
                <span className="hidden text-xs text-muted md:block">Unsaved changes</span>
                <Button variant="ghost" size="sm" onClick={() => { setForm(null); setNotice(null); }}>
                  Discard
                </Button>
              </>
            )}
            <Button size="sm" loading={save.isPending} disabled={!dirty} onClick={trySave}>
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {org.isPending && <SkeletonRows rows={6} />}
      {org.isError && (
        <ErrorState
          title="We couldn't load your company profile"
          requestId={org.error?.response?.data?.error?.requestId}
          onRetry={org.refetch}
        />
      )}

      {org.data && form && (
        <div className="space-y-5">
          {notice && <Alert tone={notice === 'Saved.' ? 'success' : 'warning'}>{notice}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}

          {/* The lock rule, stated up front — not discovered at save. */}
          {verified && !pending && (
            <Alert tone="info" title="You're verified">
              {LOCKED_HELP}
            </Alert>
          )}

          {/* The change under review — live profile and tick untouched. */}
          {pending && (
            <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-warning-800">
                  {pending.state === 'awaiting_documents'
                    ? 'Profile change — documents needed'
                    : pending.state === 'rejected'
                      ? 'Profile change — not approved'
                      : 'Profile change — under review'}
                </p>
                <span className="text-xs text-warning-800/80">
                  Your live profile and verified badge stay unchanged until it is approved.
                </span>
              </div>
              <dl className="mt-2.5 space-y-1">
                {pending.changedFields.map((f) => (
                  <div key={f} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                    <dt className="font-semibold capitalize text-ink-800">
                      {f === 'entityType' ? 'Entity type' : f}:
                    </dt>
                    <dd className="text-ink-700">
                      <PendingDiff field={f} live={org.data} values={pending.values} />
                    </dd>
                  </div>
                ))}
              </dl>
              {pending.state === 'rejected' && pending.rejectionReason && (
                <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[13px] text-danger-700">
                  <span className="font-semibold">Reviewer&apos;s reason:</span>{' '}
                  {pending.rejectionReason} — edit the details below and save to resubmit, or
                  cancel the change.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {pending.state === 'awaiting_documents' && (
                  <Button
                    size="sm"
                    onClick={() => { window.location.href = isExporter ? '/exporter/kyc' : '/buyer/kyc'; }}
                  >
                    Upload supporting documents
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(true)}>
                  Cancel this change
                </Button>
              </div>
            </div>
          )}

          {isExporter ? (
            /* ---------- exporter: edit column + sticky context rail ---------- */
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-5">
                {registeredCard}
                {storefrontCard}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-[84px]">
                <RailCard label="How buyers see you">
                  {preview.data ? (
                    <>
                      <div className="rounded-lg bg-surface-subtle p-4">
                        {preview.data.logo ? (
                          <img src={preview.data.logo} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        ) : (
                          <NoImagePanel label={preview.data.name} monogram ratio="h-16 w-16" className="rounded-lg" />
                        )}
                        <span className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink-900">{preview.data.name}</span>
                          <VerifiedTick verified={preview.data.verified} />
                        </span>
                        <p className="mt-0.5 text-xs text-muted">
                          {[countryName(preview.data.country) ?? preview.data.country,
                            preview.data.entityType === 'individual' ? 'Individual' : 'Business',
                            `${preview.data.productCount} products`].join(' · ')}
                        </p>
                        {preview.data.description && (
                          <p className="mt-2 line-clamp-3 text-sm text-ink-700">{preview.data.description}</p>
                        )}
                      </div>
                      {/* Rendered from the PUBLIC endpoint — the identical
                          projection a guest receives, so it cannot lie (A22). */}
                      <Link
                        to={`/supplier/${org.data.slug}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
                      >
                        View public page <ExternalIcon className="h-4 w-4" />
                      </Link>
                    </>
                  ) : (
                    <SkeletonRows rows={3} />
                  )}
                </RailCard>

                <RailCard label="Verification">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusChip ? (
                      <StatusChip label={statusChip.label} tone={statusChip.tone} />
                    ) : (
                      <span className="text-sm text-ink-800">Not verified yet</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {verified
                      ? 'Your documents are approved — the tick shows on your public page.'
                      : org.data.kycStatus === 'submitted'
                        ? 'Our team is reviewing your documents.'
                        : 'Get the verified tick — buyers trust verified suppliers more.'}
                  </p>
                  <Link
                    to="/exporter/verification"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
                  >
                    <ShieldIcon className="h-4 w-4" /> Verification status
                  </Link>
                </RailCard>

                <RailCard label="Account">{accountBody}</RailCard>
              </aside>
            </div>
          ) : (
            /* ---------- buyer: single calm column ---------- */
            <>
              {registeredCard}
              {buyerIconCard}
              <SectionCard icon={ShieldIcon} title="Account" desc="Sign-in settings for your own user.">
                {/* The change-password screen has existed since M1 and works for
                    every role — this is its first party-side entry point. */}
                {accountBody}
              </SectionCard>
            </>
          )}
        </div>
      )}

      <Modal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        centered
        icon={ShieldIcon}
        title="This change goes for review"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSubmit(false)}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>Submit for review</Button>
          </>
        }
      >
        You&apos;re changing {lockedChanges.join(', ')} — details our team verified against your
        documents. Your live profile and verified badge stay exactly as they are; the new details
        take effect once our team approves them. You&apos;ll upload supporting documents from the
        Verification page next.
      </Modal>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        centered
        danger
        icon={ShieldIcon}
        title="Cancel this profile change?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep it</Button>
            <Button
              variant="danger"
              loading={cancelChange.isPending}
              onClick={() => cancelChange.mutate()}
            >
              Cancel the change
            </Button>
          </>
        }
      >
        The new details and any documents you uploaded for them are withdrawn. Your profile stays
        exactly as it was verified — nothing else is affected.
      </Modal>
    </PortalLayout>
  );
}
