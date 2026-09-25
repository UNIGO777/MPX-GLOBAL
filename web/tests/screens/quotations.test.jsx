import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * Quotations (quote Module 4). The exporter drafts (autosaved) and sends into
 * the chat; once sent it is a frozen record. The buyer can decline from the
 * document; accepting is the confirmed flow in the chat card.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const QKEY = `GET /quotations/${IDS.quote}`;
const draft = () => structuredClone(recorded.byRole.exporter[QKEY].body);
const builder = async () =>
  renderPage(await loadPage('exporter/QuotationBuilder', 'QuotationBuilder'), {
    auth,
    role: 'exporter',
    url: `/exporter/quotations/${IDS.quote}`,
    pattern: '/exporter/quotations/:id',
  });

describe('Quotation builder (exporter)', () => {
  it('says what is missing before it can be sent', async () => {
    await builder();
    const send = (await screen.findAllByRole('button', { name: 'Send to buyer' }))[0];
    expect(send.disabled).toBe(true);
    expect(screen.getByText('Needed before you can send.')).toBeTruthy();
  });

  it('autosaves an edit (there is no Save button)', async () => {
    const user = userEvent.setup();
    fakeApi.on('PATCH', `/quotations/${IDS.quote}`, draft());
    await builder();
    await user.type(await screen.findByPlaceholderText('e.g. 2 weeks'), '30 days');
    await waitFor(() => expect(writes('PATCH', `/quotations/${IDS.quote}`).length).toBeGreaterThan(0), { timeout: 4000 });
    expect(writes('PATCH', `/quotations/${IDS.quote}`).at(-1).data.leadTime).toBe('30 days');
  });

  it('send: confirms first, saves then sends, and lands in the chat thread', async () => {
    const user = userEvent.setup();
    const sent = draft();
    sent.quotation.status = 'sent';
    fakeApi.on('PATCH', `/quotations/${IDS.quote}`, draft());
    fakeApi.on('POST', `/quotations/${IDS.quote}/send`, sent);
    await builder();
    fireEvent.change(await screen.findByLabelText('Valid until'), { target: { value: '2026-12-31' } });
    const open = (await screen.findAllByRole('button', { name: 'Send to buyer' }))[0];
    await waitFor(() => expect(open.disabled).toBe(false));
    await user.click(open);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Send this quotation?')).toBeTruthy();
    expect(writes('POST', `/quotations/${IDS.quote}/send`)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Send to buyer' }));
    await waitFor(() => expect(writes('POST', `/quotations/${IDS.quote}/send`)).toHaveLength(1));
    expect(writes('PATCH', `/quotations/${IDS.quote}`).at(-1).data.validUntil).toMatch(/^2026-12-31/);
    expect(await screen.findByText(`Went to /exporter/chat/${IDS.buyerConv}`)).toBeTruthy();
  });
});

describe('Quotation document', () => {
  const sentFor = () => {
    const q = draft();
    q.quotation.status = 'sent';
    q.quotation.validUntil = '2026-12-31T00:00:00.000Z';
    q.quotation.totalMinor = 12500000;
    return q;
  };

  it('the buyer can decline an open quotation, with an optional reason', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', `/quotations/${IDS.quote}`, sentFor());
    fakeApi.on('POST', `/quotations/${IDS.quote}/decline`, { quotation: { ...sentFor().quotation, status: 'declined' } });
    await renderPage(await loadPage('QuotationView', 'QuotationView'), { auth, role: 'buyer', url: `/quotations/${IDS.quote}`, pattern: '/quotations/:id' });
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = await screen.findByRole('dialog');
    const reason = within(dialog).queryByRole('textbox');
    if (reason) await user.type(reason, 'Price too high this season.');
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(writes('POST', `/quotations/${IDS.quote}/decline`)).toHaveLength(1));
    if (reason) expect(writes('POST', `/quotations/${IDS.quote}/decline`)[0].data).toEqual({ reason: 'Price too high this season.' });
  });

  it('the exporter sees the same document with no Decline', async () => {
    fakeApi.on('GET', `/quotations/${IDS.quote}`, sentFor());
    await renderPage(await loadPage('QuotationView', 'QuotationView'), { auth, role: 'exporter', url: `/quotations/${IDS.quote}`, pattern: '/quotations/:id' });
    expect((await screen.findAllByText(/MPX-Q-2026-000001/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
  });
});
