import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * KYC upload and the company profile. The server re-checks every file by its
 * bytes and every edit against the lock rules; these pin what the screens send
 * — and that a buyer whose company has a seller account cannot edit.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const pdf = (name = 'registration.pdf') => new File(['%PDF-1.4 test'], name, { type: 'application/pdf' });
const org = (role) => structuredClone(recorded.byRole[role]['GET /me/organisation'].body);

describe('KYC upload (exporter, India, business)', () => {
  it('offers India\'s business documents; Submit stays off until a file is added; uploads it WITHOUT an entity type', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/me/kyc/documents', { kyc: { kycStatus: 'submitted' } });
    await renderPage(await loadPage('exporter/KycUpload', 'KycUpload'), { auth, role: 'exporter', url: '/exporter/kyc' });
    const submit = await screen.findByRole('button', { name: 'Submit for review' });
    expect(submit.disabled).toBe(true);
    expect(screen.getAllByText('Add at least one document to continue.').length).toBeGreaterThan(0);
    expect(screen.getByText('GST certificate')).toBeTruthy();
    expect(screen.getByText('Import Export Code (IEC)')).toBeTruthy();

    await user.upload(screen.getByLabelText('Choose Company registration certificate file'), pdf());
    expect(submit.disabled).toBe(false);
    await user.click(submit);
    await waitFor(() => expect(writes('POST', '/me/kyc/documents')).toHaveLength(1));
    const form = writes('POST', '/me/kyc/documents')[0].data;
    expect(form.get('docType')).toBe('registration');
    expect(form.get('document').name).toBe('registration.pdf');
    expect(form.has('entityType')).toBe(false);
  });

  it('a file of the wrong type is refused on the spot and never uploaded', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderPage(await loadPage('exporter/KycUpload', 'KycUpload'), { auth, role: 'exporter', url: '/exporter/kyc' });
    await screen.findByRole('button', { name: 'Submit for review' });
    const word = new File(['x'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await user.upload(screen.getByLabelText('Choose Company registration certificate file'), word);
    expect(await screen.findByText(/isn't supported/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit for review' }).disabled).toBe(true);
    expect(writes('POST', '/me/kyc/documents')).toHaveLength(0);
  });
});

describe('Company profile', () => {
  it('an unverified company edits live: Save sends the changed field', async () => {
    const user = userEvent.setup();
    fakeApi.on('PATCH', '/me/organisation', org('exporter'));
    await renderPage(await loadPage('account/CompanyProfile', 'CompanyProfile'), { auth, role: 'exporter', url: '/exporter/company' });
    const city = await screen.findByRole('textbox', { name: 'City' });
    await user.clear(city);
    await user.type(city, 'Ahmedabad');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(writes('PATCH', '/me/organisation')).toHaveLength(1));
    expect(JSON.stringify(writes('PATCH', '/me/organisation')[0].data)).toContain('Ahmedabad');
  });

  it('D7 rule 7: a buyer whose company has a seller account sees it read-only', async () => {
    const managed = org('buyer');
    managed.organisation.canEdit = false;
    managed.organisation.exporterSide = true;
    fakeApi.on('GET', '/me/organisation', managed);
    await renderPage(await loadPage('account/CompanyProfile', 'CompanyProfile'), { auth, role: 'buyer', url: '/buyer/company' });
    expect(await screen.findByText('Managed by your seller account')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Company name' })).toBeNull();
  });
});

describe('Verification status', () => {
  it('an open document request shows the staff note and where to upload', async () => {
    const v = structuredClone(recorded.byRole.exporter['GET /me/verification'].body);
    v.verification.kycStatus = 'submitted';
    v.verification.documentRequests = [
      { docTypes: ['gst'], note: 'The GST copy is blurred — please re-upload.', requestedAt: '2026-09-24T10:00:00Z', fulfilledAt: null },
    ];
    fakeApi.on('GET', '/me/verification', v);
    await renderPage(await loadPage('exporter/VerificationStatus', 'VerificationStatus'), { auth, role: 'exporter', url: '/exporter/verification' });
    expect(await screen.findByText('Our team asked for documents')).toBeTruthy();
    expect(screen.getByText(/The GST copy is blurred/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Upload them here' }).getAttribute('href')).toBe('/exporter/kyc');
  });
});
