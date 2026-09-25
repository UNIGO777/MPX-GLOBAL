import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderScreen } from './helpers.jsx';

/**
 * Support tickets (owner, 2026-09-25): without "See all tickets" an employee
 * sees only the tickets assigned to them — no Unassigned card, no Assignee
 * filter, and no request for the staff-name list (the server refuses it too).
 */
const auth = vi.hoisted(() => ({ user: null }));
const calls = vi.hoisted(() => ({ assignees: 0 }));

vi.mock('../../src/auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../src/layouts/AdminLayout.jsx', () => ({ AdminLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../../src/api/support.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    supportApi: {
      ...real.supportApi,
      overview: async () => ({ counts: { open: 2, awaiting: 1, unassigned: 5, resolved7d: 3 }, scope: 'all' }),
      queue: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
      assignees: async () => {
        calls.assignees += 1;
        return [{ id: 'u1', name: 'Ravi', role: 'employee' }];
      },
    },
  };
});

const { Support } = await import('../../src/pages/admin/Support.jsx');

beforeEach(() => {
  calls.assignees = 0;
});

describe('Support queue — own tickets vs whole queue', () => {
  it('without "See all tickets": no Unassigned card, no Assignee filter, no staff list', async () => {
    auth.user = { id: 'asha', role: 'employee', permissions: ['support:read', 'support:reply'] };
    renderScreen(<Support />, { route: '/staff/support' });
    // The other cards are there, so the missing one is missing on purpose.
    expect(await screen.findByText('The company wrote last')).toBeTruthy();
    expect(screen.queryByText('Nobody has picked it up')).toBeNull();
    expect(screen.queryByText('Assignee')).toBeNull();
    expect(calls.assignees).toBe(0);
  });

  it('with "See all tickets": the Unassigned card and Assignee filter, staff list loaded', async () => {
    auth.user = { id: 'lead', role: 'employee', permissions: ['support:read', 'support:view_all'] };
    renderScreen(<Support />, { route: '/staff/support' });
    expect(await screen.findByText('Nobody has picked it up')).toBeTruthy();
    expect(screen.getByText('Assignee')).toBeTruthy();
    await waitFor(() => expect(calls.assignees).toBeGreaterThan(0));
  });
});
