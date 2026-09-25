import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { renderScreen } from './helpers.jsx';

/**
 * Supplier-request detail (2026-09-25). Who may hand a request to someone:
 *   · "Assign supplier requests" → the staff picker;
 *   · "See all" without assign → read-only holder, plus "Take this request"
 *     when nobody holds it (self-take only — the server enforces the same);
 *   · the staff-name list is requested only by someone allowed to assign.
 */
const auth = vi.hoisted(() => ({ user: null }));
const state = vi.hoisted(() => ({ lead: null, assigneeCalls: 0, assignCalls: [] }));

vi.mock('../../src/auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../src/layouts/AdminLayout.jsx', () => ({ AdminLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../../src/api/support.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    leadsApi: {
      ...real.leadsApi,
      get: async () => state.lead,
      timeline: async () => [],
      assignees: async () => {
        state.assigneeCalls += 1;
        return [{ id: 'u9', name: 'Ravi', role: 'employee' }];
      },
      assign: async (id, who) => {
        state.assignCalls.push([id, who]);
        return { ...state.lead, assignedTo: { id: who, name: 'Me' } };
      },
    },
    notesApi: { ...real.notesApi, list: async () => [] },
  };
});

const { LeadDetail } = await import('../../src/pages/admin/LeadDetail.jsx');

const LEAD = {
  id: 'L1',
  ref: 'L-7QK2',
  status: 'new',
  product: 'Organic cotton twill',
  details: 'Need 2 containers.',
  quantity: 2000,
  unit: 'meter',
  destinationCountry: 'US',
  buyer: { orgId: 'o1', org: 'Delta Knits', name: 'Nikita', email: 'nikita@example.com' },
  assignedTo: null,
  routedTo: [],
  createdAt: new Date().toISOString(),
  closedAt: null,
};

function open() {
  return renderScreen(
    <Routes>
      <Route path="/staff/leads/:id" element={<LeadDetail />} />
    </Routes>,
    { route: '/staff/leads/L1' },
  );
}

beforeEach(() => {
  state.lead = { ...LEAD };
  state.assigneeCalls = 0;
  state.assignCalls = [];
});

describe('Supplier request — who can assign', () => {
  it('"See all" without assign: nobody holds it → "Take this request" takes it for yourself; no staff list', async () => {
    auth.user = { id: 'me', role: 'employee', permissions: ['lead:manage', 'lead:view_all'] };
    const user = userEvent.setup();
    open();
    const take = (await screen.findAllByRole('button', { name: 'Take this request' }))[0];
    await user.click(take);
    await waitFor(() => expect(state.assignCalls).toEqual([['L1', 'me']]));
    expect(state.assigneeCalls).toBe(0);
  });

  it('held by someone else: shows who, and offers nothing to change it', async () => {
    auth.user = { id: 'me', role: 'employee', permissions: ['lead:manage', 'lead:view_all'] };
    state.lead = { ...LEAD, assignedTo: { id: 'u9', name: 'Ravi Kumar' } };
    open();
    expect((await screen.findAllByText('Ravi Kumar')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Take this request' })).toBeNull();
    expect(state.assigneeCalls).toBe(0);
  });

  it('"Assign supplier requests": the staff picker, and the staff list is loaded', async () => {
    auth.user = { id: 'me', role: 'employee', permissions: ['lead:manage', 'lead:view_all', 'lead:assign'] };
    open();
    await screen.findAllByText('L-7QK2');
    await waitFor(() => expect(state.assigneeCalls).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Take this request' })).toBeNull();
  });
});
