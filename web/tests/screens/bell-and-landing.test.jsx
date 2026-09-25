import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { fakeApi } from '../support/fakeApi.js';
import { USERS, loadPage, renderPage, settle } from '../support/renderPage.jsx';

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const { NotificationBell } = await import('../../src/components/notifications/NotificationBell.jsx');

describe('Notification bell', () => {
  const bell = async () => {
    auth.user = USERS.buyer;
    fakeApi.as('buyer');
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await settle();
  };

  it('says how many are unread — in its accessible name, not just a red dot', async () => {
    fakeApi.on('GET', '/notifications/unread-count', { unread: 3 });
    await bell();
    expect(screen.getByRole('button', { name: 'Notifications — 3 unread' })).toBeTruthy();
  });

  it('caps the badge at 99+', async () => {
    fakeApi.on('GET', '/notifications/unread-count', { unread: 250 });
    await bell();
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('opens a panel with the latest and a way to see them all', async () => {
    await bell();
    await userEvent.setup().click(screen.getByRole('button', { name: /^Notifications/ }));
    expect(await screen.findByText('See all notifications')).toBeTruthy();
  });
});

describe('Landing search', () => {
  it('submitting the hero search lands on /search with the query', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('public/Landing', 'Landing'), { auth, url: '/' });
    const box = screen.getAllByRole('searchbox').concat(screen.queryAllByRole('textbox'))[0];
    await user.type(box, 'cotton yarn{Enter}');
    expect(await screen.findByText('Went to /search')).toBeTruthy();
  });
});
