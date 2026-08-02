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
    </div>
  );
}
