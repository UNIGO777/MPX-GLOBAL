import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, loadPage, renderPage, writes } from '../support/renderPage.jsx';

/** Public discovery (M3): search, AI search, and saving from a product page. */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const searches = () => fakeApi.calls.filter((c) => c.method === 'GET' && c.path === '/public/search');

describe('Search', () => {
  it('sends the typed query, and changing the sort asks again with it', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('public/Search', 'Search'), { auth, url: '/search?q=cotton', pattern: '/search' });
    await waitFor(() => expect(searches().length).toBeGreaterThan(0));
    expect(searches()[0].key).toMatch(/q=cotton/);
    await user.click(screen.getByRole('button', { name: /most relevant/i }));
    await user.click(await screen.findByRole('option', { name: 'Newest first' }));
    await waitFor(() => expect(searches().some((c) => /sort=newest/.test(c.key))).toBe(true));
  });
});

describe('AI search', () => {
  it('asks the server with the question as typed (the model never runs in the browser)', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/search/ai', { extracted: { keywords: ['cotton', 'fabric'] }, fallback: false });
    await renderPage(await loadPage('public/AiSearch', 'AiSearch'), { auth, url: '/ai-search', pattern: '/ai-search' });
    const box = screen.getAllByRole('textbox')[0];
    await user.type(box, 'sasti cotton fabric bulk order');
    await user.click(screen.getAllByRole('button', { name: 'Search with AI' })[0]);
    await waitFor(() => expect(writes('POST', '/search/ai')).toHaveLength(1));
    expect(writes('POST', '/search/ai')[0].data).toEqual({ query: 'sasti cotton fabric bulk order' });
  });
});

describe('Save a product', () => {
  const productPage = async (role) =>
    renderPage(await loadPage('public/ProductDetail', 'ProductDetail'), {
      auth,
      role,
      url: '/product/organic-cotton-twill',
      pattern: '/product/:slug',
    });

  it('a buyer saves it', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/saved', { saved: { id: 'sv-new' } });
    await productPage('buyer');
    await user.click((await screen.findAllByRole('button', { name: 'Save Organic Cotton Twill' }))[0]);
    await waitFor(() => expect(writes('POST', '/saved')).toHaveLength(1));
    expect(writes('POST', '/saved')[0].data).toEqual({ targetType: 'product', targetId: IDS.product });
  });

  it('a visitor is asked to sign in instead', async () => {
    const user = userEvent.setup();
    await productPage('guest');
    await user.click((await screen.findAllByRole('button', { name: 'Save Organic Cotton Twill' }))[0]);
    expect(writes('POST', '/saved')).toHaveLength(0);
    expect(await screen.findByText('Log in with a buyer account to save this product')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('Went to /signin')).toBeTruthy();
  });
});
