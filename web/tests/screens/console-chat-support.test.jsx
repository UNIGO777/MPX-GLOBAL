import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, USERS, loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * Chat moderation and staff ticket handling.
 *  · D11: staff never write free text into a thread — a warning is one of the
 *    PRE-WRITTEN keys; the client sends only the key.
 *  · Block needs a reason; each action is its own grant.
 *  · Tickets: reply, status, and the assignee picker only with "Assign tickets".
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const CONV_KEY = `GET /admin/conversations/${IDS.conv}`;
const openConversation = () => {
  const c = structuredClone(recorded.byRole.superadmin[CONV_KEY].body);
  c.conversation.frozen = false;
  c.conversation.blockedReason = null;
  return c;
};
const WARNINGS = [
  { key: 'off_platform', tone: 'reminder', label: 'Keep contact on the platform', body: 'Please keep all communication…' },
  { key: 'payment_safety', tone: 'reminder', label: 'Payment safety', body: 'For your safety, never pay…' },
];
const viewer = async (user) => {
  fakeApi.on('GET', `/admin/conversations/${IDS.conv}`, openConversation());
  fakeApi.on('GET', '/admin/conversation-warnings', { warnings: WARNINGS });
  return renderPage(await loadPage('admin/ConversationViewer', 'ConversationViewer'), {
    auth,
    role: 'superadmin',
    user,
    url: `/admin/conversations/${IDS.conv}`,
    pattern: '/admin/conversations/:id',
  });
};

describe('Chat moderation', () => {
  it('a warning is picked from the pre-written list — no text box — and only its key is sent', async () => {
    const user = userEvent.setup();
    await viewer(USERS.superadmin);
    await user.click((await screen.findAllByRole('button', { name: /send (a )?warning/i }))[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    await user.click(within(dialog).getByRole('radio', { name: /Payment safety/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Send warning' }));
    await waitFor(() => expect(writes('POST', `/admin/conversations/${IDS.conv}/warn`)).toHaveLength(1));
    expect(writes('POST', `/admin/conversations/${IDS.conv}/warn`)[0].data).toEqual({ warning: 'payment_safety' });
  });

  it('block needs a reason and sends it', async () => {
    const user = userEvent.setup();
    await viewer(USERS.superadmin);
    await user.click((await screen.findAllByRole('button', { name: /block (chat|conversation)/i }))[0]);
    const dialog = await screen.findByRole('dialog');
    const block = within(dialog).getByRole('button', { name: 'Block conversation' });
    expect(block.disabled).toBe(true);
    await user.type(within(dialog).getByRole('textbox'), 'Both parties tried to move payment off the platform.');
    await user.click(block);
    await waitFor(() => expect(writes('POST', `/admin/conversations/${IDS.conv}/block`)).toHaveLength(1));
    expect(writes('POST', `/admin/conversations/${IDS.conv}/block`)[0].data).toEqual({ reason: 'Both parties tried to move payment off the platform.' });
  });

  it('someone who may only READ conversations gets neither action', async () => {
    await viewer({ id: 'r', name: 'Reader', role: 'employee', permissions: ['conversation:read'] });
    await screen.findAllByText(/Beta Traders/);
    expect(screen.queryByRole('button', { name: /send (a )?warning/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /block (chat|conversation)/i })).toBeNull();
  });
});

describe('Support ticket (staff)', () => {
  const ticketPage = async (role, user) =>
    renderPage(await loadPage('admin/SupportTicket', 'SupportTicket'), {
      auth,
      role,
      user,
      url: `/admin/support/${IDS.staffTicket}`,
      pattern: '/admin/support/:id',
    });
  const ticket = () => structuredClone(recorded.byRole.superadmin[`GET /admin/support/tickets/${IDS.staffTicket}`].body);

  it('a reply is sent as MPX Global Support', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', `/admin/support/tickets/${IDS.staffTicket}/messages`, ticket());
    await ticketPage('superadmin');
    await user.type((await screen.findAllByPlaceholderText('Reply as MPX Global Support…'))[0], 'We have fixed the upload limit.');
    await user.click(screen.getAllByRole('button', { name: 'Send' })[0]);
    await waitFor(() => expect(writes('POST', `/admin/support/tickets/${IDS.staffTicket}/messages`)).toHaveLength(1));
    expect(writes('POST', `/admin/support/tickets/${IDS.staffTicket}/messages`)[0].data).toEqual({ body: 'We have fixed the upload limit.' });
  });

  it('Resolve sets the status', async () => {
    const user = userEvent.setup();
    fakeApi.on('PATCH', `/admin/support/tickets/${IDS.staffTicket}/status`, ticket());
    await ticketPage('superadmin');
    await user.click((await screen.findAllByRole('button', { name: 'Resolve' }))[0]);
    await waitFor(() => expect(writes('PATCH', `/admin/support/tickets/${IDS.staffTicket}/status`)).toHaveLength(1));
    expect(writes('PATCH', `/admin/support/tickets/${IDS.staffTicket}/status`)[0].data).toEqual({ status: 'resolved' });
  });

  it('Asha (no "Assign tickets") sees who holds it but gets no picker', async () => {
    await ticketPage('employee');
    expect((await screen.findAllByText(/Asha Menon/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(fakeApi.calls.some((c) => c.path === '/admin/support/assignees')).toBe(false);
  });
});
