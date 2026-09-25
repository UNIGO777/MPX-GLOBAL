import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, loadPage, renderPage, writes } from '../support/renderPage.jsx';

/**
 * M4 chat from the buyer's side: the enquiry that opens a thread, and a message
 * in that thread. The thread is the only place two companies talk.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

describe('Enquiry from the product page', () => {
  it('a signed-out visitor is sent to sign in, and comes back to the enquiry', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('public/ProductDetail', 'ProductDetail'), {
      auth,
      url: '/product/organic-cotton-twill',
      pattern: '/product/:slug',
    });
    await user.click(await screen.findByRole('button', { name: 'Create enquiry' }));
    expect(await screen.findByText('Went to /signin')).toBeTruthy();
  });

  it('a buyer with no thread yet: the enquiry form sends the product and the message', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', `/conversations/by-product/${IDS.product}`, { conversationId: null });
    fakeApi.on('POST', '/inquiries', { conversationId: 'c-new' });
    await renderPage(await loadPage('public/ProductDetail', 'ProductDetail'), {
      auth,
      role: 'buyer',
      url: '/product/organic-cotton-twill',
      pattern: '/product/:slug',
    });
    await user.click(await screen.findByRole('button', { name: 'Create enquiry' }));
    await user.type(await screen.findByLabelText('Your message'), 'Need 12 MT monthly, Oeko-Tex certified.');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    await waitFor(() => expect(writes('POST', '/inquiries')).toHaveLength(1));
    expect(writes('POST', '/inquiries')[0].data).toMatchObject({ productId: IDS.product, note: 'Need 12 MT monthly, Oeko-Tex certified.' });
  });

  it('a buyer who already enquired gets "Open chat", not a second enquiry', async () => {
    await renderPage(await loadPage('public/ProductDetail', 'ProductDetail'), {
      auth,
      role: 'buyer',
      url: '/product/organic-cotton-twill',
      pattern: '/product/:slug',
    });
    expect(await screen.findByRole('button', { name: 'Open chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create enquiry' })).toBeNull();
  });
});

describe('Chat thread (buyer)', () => {
  it('sends the typed message to that thread; an empty message cannot be sent', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', `/conversations/${IDS.buyerConv}/messages`, {
      message: { id: 'm-new', body: 'Can you share a swatch?', senderSide: 'buyer', createdAt: new Date().toISOString() },
    });
    await renderPage(await loadPage('chat/ChatInbox', 'ChatInbox'), {
      auth,
      role: 'buyer',
      url: `/buyer/chat/${IDS.buyerConv}`,
      pattern: '/buyer/chat/:id',
    });
    const send = await screen.findByRole('button', { name: 'Send message' });
    expect(send.disabled).toBe(true);
    await user.type(screen.getByPlaceholderText(/Write a message/), 'Can you share a swatch?');
    await user.click(send);
    await waitFor(() => expect(writes('POST', `/conversations/${IDS.buyerConv}/messages`)).toHaveLength(1));
    expect(writes('POST', `/conversations/${IDS.buyerConv}/messages`)[0].data).toEqual({ body: 'Can you share a swatch?' });
  });
});
