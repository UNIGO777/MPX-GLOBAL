import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * What a company does for itself: support tickets, supplier requests, saved
 * items and notifications. Each test pins what the screen SENDS.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const load = loadPage;
const buyerFixture = (key) => structuredClone(recorded.byRole.buyer[key].body);

describe('Support tickets (company side)', () => {
  it('raise a ticket: topic + subject + message are required; sends exactly those', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/support/tickets', { ticket: { id: 'new', ref: 'T-NEW' } });
    await renderPage(await load('support/MySupport', 'MySupport'), { auth, role: 'buyer', url: '/buyer/support' });
    await user.click(screen.getAllByRole('button', { name: /raise a ticket|new ticket/i })[0]);
    const send = await screen.findByRole('button', { name: 'Send ticket' });
    expect(send.disabled).toBe(true);
    await user.click(screen.getByRole('radio', { name: /Verification/ }));
    await user.type(screen.getByLabelText('Subject'), '  GST upload fails  ');
    await user.type(screen.getByLabelText('Message'), 'The upload stops at 90%.');
    expect(send.disabled).toBe(false);
    await user.click(send);
    await waitFor(() => expect(writes('POST', '/support/tickets')).toHaveLength(1));
    expect(writes('POST', '/support/tickets')[0].data).toEqual({ subject: 'GST upload fails', category: 'verification', body: 'The upload stops at 90%.' });
  });

  it('an open ticket: reply, then mark it solved after a confirm', async () => {
    const user = userEvent.setup();
    const open = buyerFixture(`GET /support/tickets/${IDS.buyerTicket}`);
    open.ticket.status = 'in_progress';
    fakeApi.on('GET', `/support/tickets/${IDS.buyerTicket}`, open);
    // Like the server, a reply answers with the whole ticket.
    fakeApi.on('POST', `/support/tickets/${IDS.buyerTicket}/messages`, open);
    await renderPage(await load('support/MyTicket', 'MyTicket'), {
      auth,
      role: 'buyer',
      url: `/buyer/support/${IDS.buyerTicket}`,
      pattern: '/buyer/support/:id',
    });
    await user.type(await screen.findByPlaceholderText(/Write a reply/), 'Tried again, same error.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(writes('POST', `/support/tickets/${IDS.buyerTicket}/messages`)).toHaveLength(1));
    expect(writes('POST', `/support/tickets/${IDS.buyerTicket}/messages`)[0].data).toEqual({ body: 'Tried again, same error.' });

    await user.click(screen.getAllByRole('button', { name: /mark as solved|solved/i })[0]);
    await user.click(await screen.findByRole('button', { name: "Yes, it's solved" }));
    await waitFor(() => expect(writes('POST', `/support/tickets/${IDS.buyerTicket}/close`)).toHaveLength(1));
  });

  it('a resolved ticket has no reply box', async () => {
    await renderPage(await load('support/MyTicket', 'MyTicket'), {
      auth,
      role: 'buyer',
      url: `/buyer/support/${IDS.buyerTicket}`,
      pattern: '/buyer/support/:id',
    });
    expect(await screen.findByText(/Cannot upload my GST certificate/)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Write a reply/)).toBeNull();
  });
});

describe('Find a supplier (supplier requests)', () => {
  it('needs the product (3+ characters); sends only what was filled in', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/leads', { lead: { id: 'L', ref: 'R-NEW' } });
    await renderPage(await load('support/FindSupplier', 'FindSupplier'), { auth, role: 'buyer', url: '/buyer/find-supplier' });
    await user.click(screen.getAllByRole('button', { name: /new request|make a request/i })[0]);
    const send = await screen.findByRole('button', { name: 'Send request' });
    await user.type(screen.getByLabelText('Product'), 'ab');
    expect(send.disabled).toBe(true);
    await user.type(screen.getByLabelText('Product'), 'c cotton yarn, 30s combed');
    await user.type(screen.getByLabelText('Quantity'), '5000');
    await user.click(send);
    await waitFor(() => expect(writes('POST', '/leads')).toHaveLength(1));
    expect(writes('POST', '/leads')[0].data).toEqual({ what: 'abc cotton yarn, 30s combed', quantity: 5000 });
  });
});

describe('Saved items', () => {
  it('removing an item deletes that saved row', async () => {
    const user = userEvent.setup();
    const product = recorded.byRole.guest['GET /public/products/organic-cotton-twill'].body.product;
    fakeApi.on('GET', '/saved', {
      items: [{ id: 'sv1', targetType: 'product', available: true, savedAt: '2026-09-20T10:00:00Z', product }],
      total: 1,
      page: 1,
      pageSize: 12,
    });
    await renderPage(await load('buyer/SavedItems', 'SavedItems'), { auth, role: 'buyer', url: '/saved' });
    await user.click(await screen.findByRole('button', { name: `Remove ${product.name} from saved` }));
    await waitFor(() => expect(writes('DELETE', '/saved/sv1')).toHaveLength(1));
  });
});

describe('Notifications page', () => {
  it('opening one marks it read and goes to its link; "Mark all as read" marks everything', async () => {
    const user = userEvent.setup();
    const list = buyerFixture('GET /notifications');
    list.items = list.items.map((n, i) => ({ ...n, read: i > 0 ? n.read : false }));
    fakeApi.on('GET', '/notifications', list);
    await renderPage(await load('notifications/Notifications', 'Notifications'), { auth, role: 'buyer', url: '/buyer/notifications' });
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(writes('POST', '/notifications/read-all')).toHaveLength(1));

    const first = list.items[0];
    await user.click(screen.getAllByText(first.title)[0]);
    await waitFor(() => expect(writes('POST', `/notifications/${first.id}/read`)).toHaveLength(1));
    expect(await screen.findByTestId('went')).toBeTruthy();
    expect(within(screen.getByTestId('went')).getByText(new RegExp(first.link.split('?')[0]))).toBeTruthy();
  });
});
