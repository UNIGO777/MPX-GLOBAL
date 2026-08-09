import { useState } from 'react';

import { Alert } from '../components/ui/Alert.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import { CountrySelect } from '../components/ui/CountrySelect.jsx';
import { Drawer } from '../components/ui/Drawer.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Input } from '../components/ui/Input.jsx';
import { MobileInput } from '../components/ui/MobileInput.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { OtpInput } from '../components/ui/OtpInput.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { PasswordInput } from '../components/ui/PasswordInput.jsx';
import { Select } from '../components/ui/Select.jsx';
import { SkeletonRows } from '../components/ui/Skeleton.jsx';
import { StatusChip } from '../components/ui/StatusChip.jsx';
import { VerifiedTick } from '../components/ui/VerifiedTick.jsx';
import { SearchIcon } from '../components/ui/icons.jsx';
import { AttributeFields } from '../components/catalogue/AttributeFields.jsx';
import { BlockedBanner } from '../components/catalogue/BlockedBanner.jsx';
import { CapMeter } from '../components/catalogue/CapMeter.jsx';
import { CategoryPicker } from '../components/catalogue/CategoryPicker.jsx';
import { NoImagePanel } from '../components/catalogue/NoImagePanel.jsx';
import { PriceInput } from '../components/catalogue/PriceInput.jsx';
import { PriceLine } from '../components/catalogue/PriceLine.jsx';
import { ProductCard } from '../components/catalogue/ProductCard.jsx';
import { ProductImageManager } from '../components/catalogue/ProductImageManager.jsx';
import { SpecTable } from '../components/catalogue/SpecTable.jsx';
import { PRODUCT_STATUS_META } from '../lib/productStatus.js';

/* --- M2 fixtures: real taxonomy, real seeded attribute keys --- */
const TREE = [
  { id: 't1', name: 'Textiles, Fabrics & Yarn', subs: [
    { id: 's1', name: 'Cotton fabric' }, { id: 's2', name: 'Silk fabric' }, { id: 's3', name: 'Denim' },
  ] },
  { id: 't2', name: 'Agriculture', subs: [{ id: 's4', name: 'Spices & herbs' }] },
];
// The six attributes the seed actually creates for Cotton fabric — all optional,
// none a select (§A25.2 never invents options).
const ATTR_DEFS = [
  { key: 'material', name: 'Material', inputType: 'text' },
  { key: 'gsm', name: 'GSM', inputType: 'number', unit: 'gsm' },
  { key: 'width', name: 'Width', inputType: 'number', unit: 'inches' },
  { key: 'weave', name: 'Weave', inputType: 'text' },
  { key: 'organic', name: 'Organic', inputType: 'boolean' },
  { key: 'finish', name: 'Finish', inputType: 'select', options: ['Mercerised', 'Sanforised'], required: true },
];
const CARD = (over = {}) => ({
  id: 'p1', name: 'Combed Cotton Poplin Fabric, 120 GSM', images: [],
  price: { mode: 'fixed', min: 220, currency: 'INR' }, unit: 'meter',
  seller: { name: 'Tirupur Knitwear Exports', verified: true },
  category: { name: 'Cotton fabric' }, ...over,
});

/**
 * DEV-ONLY review surface: every primitive in every state, one page. The route
 * is mounted only when import.meta.env.DEV — it never ships in a build.
 */
function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Styleguide() {
  const [otp, setOtp] = useState('82');
  const [country, setCountry] = useState('AE');
  const [mobile, setMobile] = useState({ countryCode: '+91', number: '98765 43210' });
  const [password, setPassword] = useState('StrongPassword123');
  const [checked, setChecked] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [cat, setCat] = useState({ topId: 't1', subId: 's1' });
  const [price, setPrice] = useState({ mode: 'fixed', min: 220, currency: 'INR' });
  const [specs, setSpecs] = useState({ material: 'Cotton', gsm: 120, organic: true });
  const [imgs, setImgs] = useState([{ url: 'https://placehold.co/200', publicId: 'demo/1' }]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink-900">MPX Global — foundation styleguide (dev only)</h1>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="dangerOutline">Reject</Button>
          <Button loading>Signing in…</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary">Small</Button>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" placeholder="John Doe" helper="As it appears on documents." />
          <Input label="Email" type="email" placeholder="john@company.com" error="An account with this email already exists." />
          <MobileInput value={mobile} onChange={setMobile} helper="We'll send a sign-in code to this number." />
          <CountrySelect value={country} onChange={setCountry} />
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} showStrength helper="At least 8 characters." />
          <Select
            label="Role"
            options={[
              { value: '', label: 'All roles' },
              { value: 'buyer', label: 'Buyer' },
              { value: 'exporter', label: 'Exporter' },
            ]}
          />
        </div>
        <Checkbox
          label="Approve buyers"
          help="Decide on buyer verification"
          checked={checked}
          onChange={setChecked}
        />
      </Section>

      <Section title="OTP input">
        <OtpInput value={otp} onChange={setOtp} />
        <OtpInput value="123456" onChange={() => {}} error />
        <OtpInput value="" onChange={() => {}} disabled />
      </Section>

      <Section title="Status vocabulary + tick">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status="pending" />
          <StatusChip status="submitted" />
          <StatusChip status="verified" />
          <StatusChip status="rejected" />
          <VerifiedTick verified verifiedAt="2026-03-18" />
        </div>
      </Section>

      <Section title="Alerts">
        <Alert tone="info">Verification is optional — your account already works in full.</Alert>
        <Alert tone="warning" title="In review">Your documents are with our team.</Alert>
        <Alert tone="danger" title="We couldn't verify your documents">
          The registration certificate you uploaded had expired in January.
        </Alert>
        <Alert tone="success" title="You're verified">Your verified tick is live on your profile.</Alert>
      </Section>

      <Section title="Loading / empty / error">
        <SkeletonRows rows={3} />
        <EmptyState icon={SearchIcon} title="No accounts match those filters">
          Remember that search matches from the start of a name, email or mobile.
        </EmptyState>
        <ErrorState requestId="REF-8F42-19C7" onRetry={() => {}} />
      </Section>

      <Section title="Overlays + pagination">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
        </div>
        <Pagination page={page} pageSize={pageSize} total={1248} onPage={setPage} onPageSize={setPageSize} />
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Deactivate Priya Nair?"
        danger
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setModalOpen(false)}>Deactivate</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          This signs them out everywhere and blocks them from logging in. Their profile and
          documents are kept, and you can reactivate them at any time.
        </p>
      </Modal>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Edit permissions"
        subtitle="Vikram Shah · vikram@mpxglobal.com"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button onClick={() => setDrawerOpen(false)}>Save changes</Button>
          </>
        }
      >
        <Checkbox label="Approve buyers" help="Decide on buyer verification" checked onChange={() => {}} />
      </Drawer>

      {/* ------------------------- M2 · catalogue ------------------------- */}
      <h2 className="pt-6 text-lg font-bold text-ink-900">M2 · Catalogue components</h2>

      <Section title="Price line — three modes, all equally normal">
        <div className="flex flex-wrap items-end gap-8">
          <PriceLine price={{ mode: 'fixed', min: 220, currency: 'INR' }} unit="meter" />
          <PriceLine price={{ mode: 'range', min: 800, max: 1400, currency: 'INR' }} />
          <PriceLine price={{ mode: 'fixed', min: 3.4, currency: 'USD' }} unit="meter" />
          <PriceLine price={{ mode: 'on_request' }} />
        </div>
        <p className="text-xs text-muted">
          &ldquo;Price on request&rdquo; is information, not an absence. Currency is the seller&apos;s
          own ISO code — no conversion exists in Phase 1.
        </p>
      </Section>

      <Section title="No-image panel — the LAUNCH look (0 of 40 categories have an image)">
        <div className="grid grid-cols-3 gap-4">
          <NoImagePanel label="Textiles" monogram />
          <NoImagePanel ratio="aspect-[4/3]" />
          <NoImagePanel label="Tirupur Knitwear" monogram ratio="aspect-square" className="rounded-lg" />
        </div>
      </Section>

      <Section title="Product card — public variant (never a status chip)">
        <ul className="grid grid-cols-3 gap-4">
          <ProductCard product={CARD()} />
          <ProductCard product={CARD({ price: { mode: 'on_request' }, name: 'Cotton Cambric Roll, 60s',
            seller: { name: 'Erode Textile House', verified: false } })} />
          <ProductCard product={CARD({ name: 'Cotton Canvas 12oz',
            price: { mode: 'range', min: 390, max: 520, currency: 'INR' } })} showSeller={false} />
        </ul>
        <p className="text-xs text-muted">
          Middle card: unverified seller — identical, minus the tick. No badge in its place.
        </p>
      </Section>

      <Section title="Spec table">
        <SpecTable
          defs={ATTR_DEFS}
          attributes={[{ key: 'material', value: 'Cotton' }, { key: 'gsm', value: 120 },
            { key: 'organic', value: true }, { key: 'orphaned_key', value: 'kept anyway' }]}
        />
      </Section>

      <Section title="Cap meter — unverified only">
        <CapMeter caps={{ verified: false, active: { used: 2, limit: 3 }, drafts: { used: 7, limit: 10 } }} />
        <p className="text-xs text-muted">
          A verified seller renders nothing at all:
          <span className="ml-1 inline-block align-middle"><CapMeter caps={{ verified: true }} /></span>
          (empty by design)
        </p>
      </Section>

      <Section title="Blocked banner — reason + date, never the admin, no appeal">
        <BlockedBanner takedown={{ reason: 'Images do not match the product described.', at: '2026-03-02' }} />
      </Section>

      <Section title="Status vocabulary — blocked is an OVERLAY, not a fifth status">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(PRODUCT_STATUS_META).map(([k, m]) => (
            <StatusChip key={k} label={m.label} tone={m.tone} />
          ))}
          <span className="flex items-center gap-2 rounded-lg border border-surface-border p-2">
            <StatusChip label="Live" tone="success" />
            <StatusChip label="Taken down" tone="danger" />
          </span>
        </div>
      </Section>

      <Section title="Category picker — the SUB is what is stored; no goods/service toggle">
        <CategoryPicker tree={TREE} topId={cat.topId} subId={cat.subId} onChange={setCat} />
      </Section>

      <Section title="Price input — on request REMOVES the fields, not disables them">
        <PriceInput value={price} onChange={setPrice} />
      </Section>

      <Section title="Attribute fields — unit inside the number field">
        <AttributeFields defs={ATTR_DEFS} values={specs} onChange={setSpecs} />
      </Section>

      <Section title="Product image manager — all three limits stated up front">
        <ProductImageManager images={imgs} onChange={setImgs} onUpload={async () => []} />
      </Section>
    </div>
  );
}
