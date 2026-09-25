import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, USERS, loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * Super-admin content and configuration: platform settings (D8), the staff
 * member's own password, landing-page featured slots and the category tree.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {}, applyNewTokens: () => {} }),
}));

describe('Platform settings (D8)', () => {
  it('sends ONLY what changed', async () => {
    const user = userEvent.setup();
    fakeApi.on('PATCH', '/admin/settings', recorded.byRole.superadmin['GET /admin/settings'].body);
    await renderPage(await loadPage('admin/Settings', 'Settings'), { auth, role: 'superadmin', url: '/admin/settings' });
    const hours = await screen.findByPlaceholderText('Mon–Sat, 10:00–18:00 IST');
    await user.clear(hours);
    await user.type(hours, 'Mon–Fri, 09:00–17:00 IST');
    await user.click(screen.getAllByRole('button', { name: 'Save changes' })[0]);
    await waitFor(() => expect(writes('PATCH', '/admin/settings')).toHaveLength(1));
    expect(writes('PATCH', '/admin/settings')[0].data).toEqual({ supportHours: 'Mon–Fri, 09:00–17:00 IST' });
  });

  it('a malformed support email is refused before saving', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/Settings', 'Settings'), { auth, role: 'superadmin', url: '/admin/settings' });
    const email = await screen.findByPlaceholderText('support@yourcompany.com');
    await user.clear(email);
    await user.type(email, 'not-an-email');
    const save = screen.getAllByRole('button', { name: 'Save changes' })[0];
    if (!save.disabled) await user.click(save);
    expect(writes('PATCH', '/admin/settings')).toHaveLength(0);
  });
});

describe('My account (staff) — change password', () => {
  it('stays off until current + new (8+, different) + matching confirm; then sends both', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/change-password', { accessToken: 'x' });
    fakeApi.on('GET', '/auth/me', { user: { ...USERS.employee, memberSince: '2026-08-01T00:00:00Z', lastLoginAt: null } });
    await renderPage(await loadPage('admin/Account', 'Account'), { auth, role: 'employee', url: '/staff/account', pattern: '/staff/account' });
    await user.click((await screen.findAllByRole('button', { name: 'Change password' }))[0]);
    await user.type(screen.getByLabelText('Current password'), 'old-password-1');
    await user.type(screen.getByLabelText('New password'), 'old-password-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'old-password-1');
    const submit = screen.getAllByRole('button', { name: 'Change password' }).at(-1);
    expect(submit.disabled).toBe(true); // same as the current one

    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'new-password-2');
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'new-password-2');
    await user.click(submit);
    await waitFor(() => expect(writes('POST', '/auth/change-password')).toHaveLength(1));
    expect(writes('POST', '/auth/change-password')[0].data).toEqual({ currentPassword: 'old-password-1', newPassword: 'new-password-2' });
  });
});

describe('Featured (landing page)', () => {
  const item = recorded.byRole.superadmin['GET /admin/featured'].body.items[0];

  it('the switch turns a slot off (and only that slot)', async () => {
    const user = userEvent.setup();
    fakeApi.on('PATCH', /^\/admin\/featured\//, { item: { ...item, active: false } });
    await renderPage(await loadPage('admin/Featured', 'Featured'), { auth, role: 'superadmin', url: '/admin/featured' });
    await user.click((await screen.findAllByRole('switch', { name: /^Switch off/ }))[0]);
    await waitFor(() => expect(writes('PATCH', /^\/admin\/featured\//)).toHaveLength(1));
    expect(writes('PATCH', /^\/admin\/featured\//)[0].data).toEqual({ active: false });
  });
});

describe('Categories', () => {
  it('a new top category is created switched off, with the typed name', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/admin/categories/top', { category: { id: 'c-new', name: 'Toys & Games', active: false } });
    await renderPage(await loadPage('admin/CategoryManager', 'CategoryManager'), { auth, role: 'superadmin', url: '/admin/categories' });
    await user.click((await screen.findAllByRole('button', { name: /^new/i }))[0]);
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByPlaceholderText('e.g. Toys & Games'), 'Toys & Games');
    await user.click(within(drawer).getByRole('button', { name: 'Create category' }));
    await waitFor(() => expect(writes('POST', '/admin/categories/top')).toHaveLength(1));
    expect(writes('POST', '/admin/categories/top')[0].data).toMatchObject({ name: 'Toys & Games' });
  });

  it('a new field on a leaf category is posted to that category', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', `/admin/categories/${IDS.leaf}/attributes`, { attribute: { id: 'a-new', name: 'Fabric weight', key: 'fabric_weight' } });
    await renderPage(await loadPage('admin/AttributeManager', 'AttributeManager'), {
      auth,
      role: 'superadmin',
      url: `/admin/categories/${IDS.leaf}/attributes`,
      pattern: '/admin/categories/:id/attributes',
    });
    await user.click((await screen.findAllByRole('button', { name: /add field/i }))[0]);
    const panel = await screen.findByRole('dialog');
    await user.type(within(panel).getByPlaceholderText('e.g. Fabric weight'), 'Fabric weight');
    await user.click(within(panel).getByRole('button', { name: 'Add field' }));
    await waitFor(() => expect(writes('POST', `/admin/categories/${IDS.leaf}/attributes`)).toHaveLength(1));
    expect(writes('POST', `/admin/categories/${IDS.leaf}/attributes`)[0].data).toMatchObject({ name: 'Fabric weight' });
  });
});
