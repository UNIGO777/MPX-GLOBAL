import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * KYC review (staff). Verify / reject / request documents / revoke — each is
 * behind a review permission on the SERVER; the screen must only offer what the
 * person holds, and every note or reason is text the company will read.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const DOCS_KEY = `GET /employee/orgs/${IDS.beta}/kyc/documents`;
const docs = (extra) => ({ ...structuredClone(recorded.byRole.superadmin[DOCS_KEY].body), ...extra });
const viewer = async (user) =>
  renderPage(await loadPage('admin/KycViewer', 'KycViewer'), {
    auth,
    role: 'superadmin',
    user,
    url: `/admin/verification/${IDS.beta}/kyc`,
    pattern: '/admin/verification/:orgId/kyc',
  });
const REVIEWER = { id: 'rev', name: 'Rita Reviewer', role: 'employee', permissions: ['organisation:read', 'kyc:view', 'exporter:verify'] };
const LOOKER = { id: 'look', name: 'Lou Looker', role: 'employee', permissions: ['organisation:read', 'kyc:view'] };

describe('KYC review — a submitted exporter', () => {
  it('Verify sends the exporter verify call', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', `/employee/orgs/${IDS.beta}/kyc/documents`, docs({ kycStatus: 'submitted' }));
    await viewer(REVIEWER);
    await user.click(await screen.findByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(writes('POST', `/employee/exporters/${IDS.beta}/verify`)).toHaveLength(1));
  });

  it('Reject needs a written reason, and sends it', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', `/employee/orgs/${IDS.beta}/kyc/documents`, docs({ kycStatus: 'submitted' }));
    await viewer(REVIEWER);
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    const send = within(dialog).getByRole('button', { name: 'Reject with reason' });
    expect(send.disabled).toBe(true);
    await user.type(within(dialog).getByPlaceholderText(/Say exactly what was wrong/), 'The GST certificate has expired.');
    expect(send.disabled).toBe(false);
    await user.click(send);
    await waitFor(() => expect(writes('POST', `/employee/exporters/${IDS.beta}/reject`)).toHaveLength(1));
    expect(writes('POST', `/employee/exporters/${IDS.beta}/reject`)[0].data).toEqual({ reason: 'The GST certificate has expired.' });
  });

  it('someone who may only VIEW documents is offered no decision', async () => {
    fakeApi.on('GET', `/employee/orgs/${IDS.beta}/kyc/documents`, docs({ kycStatus: 'submitted' }));
    await viewer(LOOKER);
    await screen.findAllByText(/Beta Traders/);
    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });
});

describe('KYC review — requests and revoke', () => {
  it('Request documents sends the ticked types and the note (the company reads it)', async () => {
    const user = userEvent.setup();
    await viewer(REVIEWER);
    await user.click(await screen.findByRole('button', { name: 'Request documents' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /GST certificate/ }));
    await user.type(within(dialog).getByPlaceholderText(/The GST certificate on file is blurry/), 'Please upload a readable GST copy.');
    await user.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(writes('POST', `/employee/exporters/${IDS.beta}/kyc/request-documents`)).toHaveLength(1));
    expect(writes('POST', `/employee/exporters/${IDS.beta}/kyc/request-documents`)[0].data).toEqual({
      docTypes: ['gst'],
      note: 'Please upload a readable GST copy.',
    });
  });

  it('Revoke is offered only on a verified company, and needs a reason', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', `/employee/orgs/${IDS.beta}/kyc/documents`, docs({ kycStatus: 'verified' }));
    await viewer(REVIEWER);
    await user.click(await screen.findByRole('button', { name: 'Revoke verification' }));
    const dialog = await screen.findByRole('dialog');
    const revoke = within(dialog).getByRole('button', { name: 'Revoke verification' });
    expect(revoke.disabled).toBe(true);
    await user.type(within(dialog).getByPlaceholderText(/Say what changed/), 'Licence withdrawn by the regulator.');
    await user.click(revoke);
    await waitFor(() => expect(writes('POST', `/employee/exporters/${IDS.beta}/revoke`)).toHaveLength(1));
    expect(writes('POST', `/employee/exporters/${IDS.beta}/revoke`)[0].data).toEqual({ reason: 'Licence withdrawn by the regulator.' });
  });
});
