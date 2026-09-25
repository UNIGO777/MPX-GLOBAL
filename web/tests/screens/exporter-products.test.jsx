import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * The seller's catalogue: add/edit a product, and the list's lifecycle actions.
 * The server owns every rule (D1 caps, required specs, takedown freeze); these
 * pin what the screens send and what they refuse to offer.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const PRODUCT_KEY = `GET /products/${IDS.product}`;
const ownProduct = () => structuredClone(recorded.byRole.exporter[PRODUCT_KEY].body);

describe('Product form', () => {
  it('new: pick a category first, then save a draft with that leaf', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/products', { product: { id: 'p-new' } });
    await renderPage(await loadPage('exporter/ProductForm', 'ProductForm'), { auth, role: 'exporter', url: '/exporter/products/new' });
    // The form does not exist until a leaf category is chosen.
    expect(screen.queryByText('Product name')).toBeNull();
    await user.type(screen.getByLabelText('Search categories'), 'Cotton 779280');
    await user.click(await screen.findByRole('button', { name: /Tex 779280.*Cotton 779280/ }));
    const name = await screen.findByRole('textbox', { name: 'Product name' });
    await user.type(name, 'Combed cotton yarn');
    // Goods need a price (or "On request"), a minimum order and a unit — checked before sending.
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('A minimum order quantity is required.')).toBeTruthy();
    expect(writes('POST', '/products')).toHaveLength(0);

    await user.click(screen.getByRole('radio', { name: 'On request' }));
    await user.type(screen.getByPlaceholderText('e.g. 500'), '500');
    const unit = screen.getByPlaceholderText('e.g. meter, kg, piece');
    await user.click(unit);
    await user.type(unit, 'meter');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(writes('POST', '/products')).toHaveLength(1));
    expect(writes('POST', '/products')[0].data).toMatchObject({
      name: 'Combed cotton yarn',
      categoryId: IDS.leaf,
      price: { mode: 'on_request' },
      moq: 500,
      unit: 'meter',
    });
    expect(await screen.findByText('Went to /exporter/products')).toBeTruthy();
  });

  it('edit: loads the product, saves changes with PATCH', async () => {
    const user = userEvent.setup();
    fakeApi.on('PATCH', `/products/${IDS.product}`, ownProduct());
    await renderPage(await loadPage('exporter/ProductForm', 'ProductForm'), {
      auth,
      role: 'exporter',
      url: `/exporter/products/${IDS.product}/edit`,
      pattern: '/exporter/products/:id/edit',
    });
    const name = await screen.findByRole('textbox', { name: 'Product name' });
    expect(name.value).toBe('Organic Cotton Twill');
    await user.clear(name);
    await user.type(name, 'Organic Cotton Twill 2/1');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(writes('PATCH', `/products/${IDS.product}`)).toHaveLength(1));
    expect(writes('PATCH', `/products/${IDS.product}`)[0].data.name).toBe('Organic Cotton Twill 2/1');
  });

  it('a server refusal is shown, and the page stays', async () => {
    const user = userEvent.setup();
    fakeApi.on('PATCH', `/products/${IDS.product}`, () => {
      throw Object.assign(new Error('409'), { response: { status: 409, data: { error: { message: 'Contact details are not allowed in the description.' } } } });
    });
    await renderPage(await loadPage('exporter/ProductForm', 'ProductForm'), {
      auth,
      role: 'exporter',
      url: `/exporter/products/${IDS.product}/edit`,
      pattern: '/exporter/products/:id/edit',
    });
    await screen.findByRole('textbox', { name: 'Product name' });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Contact details are not allowed in the description.')).toBeTruthy();
    expect(screen.queryByTestId('went')).toBeNull();
  });

  it('taken down: the reason shows, Publish/Hide are gone, "Request unblock" is offered', async () => {
    const taken = ownProduct();
    taken.product.takedown = { reason: 'Brand logo in photos', at: '2026-09-20T10:00:00Z', unblockRequest: null };
    fakeApi.on('GET', `/products/${IDS.product}`, taken);
    await renderPage(await loadPage('exporter/ProductForm', 'ProductForm'), {
      auth,
      role: 'exporter',
      url: `/exporter/products/${IDS.product}/edit`,
      pattern: '/exporter/products/:id/edit',
    });
    expect(await screen.findByText('Brand logo in photos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Request unblock' })).toBeTruthy();
  });
});

describe('My products — list actions', () => {
  it('Hide on a live product sends status inactive', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('exporter/Products', 'Products'), { auth, role: 'exporter', url: '/exporter/products' });
    await user.click((await screen.findAllByRole('button', { name: 'Hide' }))[0]);
    await waitFor(() => expect(writes('PATCH', `/products/${IDS.product}/status`)).toHaveLength(1));
    expect(writes('PATCH', `/products/${IDS.product}/status`)[0].data).toEqual({ status: 'inactive' });
  });

  it('Delete asks first, says it ARCHIVES, then archives', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('exporter/Products', 'Products'), { auth, role: 'exporter', url: '/exporter/products' });
    const menus = await screen.findAllByRole('button', { name: /row actions|actions/i });
    await user.click(menus[0]);
    await user.click(within(await screen.findByRole('menu')).getByText('Delete'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Archive this product?')).toBeTruthy();
    expect(writes('DELETE', `/products/${IDS.product}`)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Archive product' }));
    await waitFor(() => expect(writes('DELETE', `/products/${IDS.product}`)).toHaveLength(1));
  });
});
