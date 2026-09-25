import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderScreen } from './helpers.jsx';

/**
 * Supplier requests (2026-09-25): without "See all supplier requests" an
 * employee works only their own — no Unassigned card, no Assignee filter, and
 * the staff-name list is never even requested. The server enforces all of it;
 * this pins that the screen doesn't ask for, or show, what it can't have.
 */
const auth = vi.hoisted(() => ({ user: null }));
const api = vi.hoisted(() => ({
  overview: vi.fn(),
  queue: vi.fn(),
  assignees: vi.fn(),
}));

vi.mock('../../src/auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../src/layouts/AdminLayout.jsx', () => ({ AdminLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../../src/api/support.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, leadsApi: { ...real.leadsApi, ...api } };
});

const { Leads } = await import('../../src/pages/admin/Leads.jsx');

beforeEach(() => {
  api.overview.mockResolvedValue({ counts: { new: 1, inProgress: 2, unassigned: 3, routed: 4, routed7d: 1 }, scope: 'all' });
  api.queue.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 });
  api.assignees.mockResolvedValue([{ id: 'u1', name: 'Ravi', role: 'employee' }]);
  api.assignees.mockClear();
});

describe('Supplier requests — own-queue vs whole-queue', () => {
  it('route-only employee: no Unassigned card, no Assignee filter, no staff list request', async () => {
    auth.user = { id: 'e1', role: 'employee', permissions: ['lead:manage'] };
    renderScreen(<Leads />, { route: '/staff/leads' });
    await screen.findByText('Finding suppliers');
    expect(screen.queryByText('Unassigned')).toBeNull();
    expect(screen.queryByText('Assignee')).toBeNull();
    expect(api.assignees).not.toHaveBeenCalled();
  });

  it('"See all supplier requests": Unassigned card and Assignee filter, staff list loaded', async () => {
    auth.user = { id: 'e2', role: 'employee', permissions: ['lead:manage', 'lead:view_all'] };
    renderScreen(<Leads />, { route: '/staff/leads' });
    await screen.findByText('Unassigned');
    expect(screen.getByText('Assignee')).toBeTruthy();
    await waitFor(() => expect(api.assignees).toHaveBeenCalled());
  });

  it('super admin sees everything', async () => {
    auth.user = { id: 'sa', role: 'superadmin', permissions: [] };
    renderScreen(<Leads />, { route: '/admin/leads' });
    await screen.findByText('Unassigned');
    await waitFor(() => expect(api.assignees).toHaveBeenCalled());
  });
});
