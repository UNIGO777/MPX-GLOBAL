import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderScreen } from './helpers.jsx';

/**
 * Staff Products page. `product:read` looks, `product:takedown` acts. D6: a
 * pending unblock request shows on the row and can be declined with a reason
 * (approving it is Restore).
 */
const auth = vi.hoisted(() => ({ user: null }));
const state = vi.hoisted(() => ({ rows: [], declines: [] }));

vi.mock('../../src/auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../src/layouts/AdminLayout.jsx', () => ({ AdminLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../../src/api/catalogue.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, catalogueApi: { ...real.catalogueApi, tree: async () => [] } };
});
vi.mock('../../src/api/adminCatalogue.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    adminCatalogueApi: {
      ...real.adminCatalogueApi,
      products: async () => ({ rows: state.rows, total: state.rows.length, page: 1, pageSize: 20 }),
      declineUnblock: async (id, reason) => {
        state.declines.push([id, reason]);
        return {};
      },
    },
  };
});

const { ProductMonitoring } = await import('../../src/pages/admin/ProductMonitoring.jsx');

const LIVE = {
  id: 'p1',
  name: 'Organic Cotton Twill',
  slug: 'organic-cotton-twill',
  status: 'active',
  createdAt: new Date().toISOString(),
  takedown: null,
  category: { id: 'c1', name: 'Cotton', slug: 'cotton' },
  seller: { orgId: 'o1', name: 'Beta Traders', slug: 'beta', takedownCount: 0 },
};
const REQUESTED = {
  ...LIVE,
  id: 'p2',
  name: 'Linen Roll',
  takedown: {
    isDown: true,
    reason: 'Brand logo in photos',
    at: new Date().toISOString(),
    appeal: { status: 'pending', message: 'Replaced the photos.', at: new Date().toISOString() },
  },
  purgeAt: new Date(Date.now() + 100 * 86400000).toISOString(),
  purgePaused: true,
};

/** The row's ⋮ menu items, for the first rendering of that product. */
async function menuFor(user, name) {
  const menus = await screen.findAllByRole('button', { name: `Actions for ${name}` });
  await user.click(menus[0]);
  return screen.findByRole('menu');
}

beforeEach(() => {
  state.rows = [];
  state.declines = [];
});

describe('Staff Products — who can act', () => {
  it('"View products" only: can look, cannot take down', async () => {
    auth.user = { id: 'e1', role: 'employee', permissions: ['product:read'] };
    state.rows = [LIVE];
    const user = userEvent.setup();
    renderScreen(<ProductMonitoring />, { route: '/staff/products' });
    const menu = await menuFor(user, LIVE.name);
    expect(within(menu).getByText('View details')).toBeTruthy();
    expect(within(menu).queryByText('Take down')).toBeNull();
  });

  it('"Take down products": the action is offered', async () => {
    auth.user = { id: 'e2', role: 'employee', permissions: ['product:read', 'product:takedown'] };
    state.rows = [LIVE];
    const user = userEvent.setup();
    renderScreen(<ProductMonitoring />, { route: '/staff/products' });
    const menu = await menuFor(user, LIVE.name);
    expect(within(menu).getByText('Take down')).toBeTruthy();
  });
});

describe('D6 · unblock requests on the staff page', () => {
  it('a pending request shows on the row with the deletion paused', async () => {
    auth.user = { id: 'sa', role: 'superadmin', permissions: [] };
    state.rows = [REQUESTED];
    renderScreen(<ProductMonitoring />, { route: '/admin/products?status=requests' });
    await screen.findAllByText(REQUESTED.name);
    // The row chip, not just the Status filter's label (which says the same).
    expect(screen.getAllByText('Unblock requested').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Deletion paused · request waiting').length).toBeGreaterThan(0);
  });

  it('decline needs a reason, shows what the seller wrote, and sends the reason', async () => {
    auth.user = { id: 'sa', role: 'superadmin', permissions: [] };
    state.rows = [REQUESTED];
    const user = userEvent.setup();
    renderScreen(<ProductMonitoring />, { route: '/admin/products?status=requests' });
    const menu = await menuFor(user, REQUESTED.name);
    await user.click(within(menu).getByText('Decline unblock request'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Replaced the photos.')).toBeTruthy();
    const decline = within(dialog).getByRole('button', { name: 'Decline' });
    expect(decline.disabled).toBe(true);
    await user.type(within(dialog).getByLabelText('Reason'), 'Second photo still shows the tag.');
    await user.click(decline);
    await waitFor(() => expect(state.declines).toEqual([['p2', 'Second photo still shows the tag.']]));
  });
});
