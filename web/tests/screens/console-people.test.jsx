import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { IDS, loadPage, renderPage, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * People and companies in the console. Creating staff, granting permissions,
 * deactivating an account and blocking a company are governance actions: the
 * server gates them (superadmin / audited); the screen must confirm first and
 * send exactly the person or company that was chosen.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

describe('Staff (employees)', () => {
  it('create: every field required; ticking "Assign tickets" brings what it needs', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/admin/employees', ({ data }) => ({ user: { id: 'e-new', name: data.name, permissions: data.permissions } }));
    await renderPage(await loadPage('admin/Employees', 'Employees'), { auth, role: 'superadmin', url: '/admin/staff' });
    await user.click((await screen.findAllByRole('button', { name: /add employee/i }))[0]);
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('button', { name: 'Create employee' }));
    expect(await within(drawer).findByText(/Fill in name, email, mobile/)).toBeTruthy();
    expect(writes('POST', '/admin/employees')).toHaveLength(0);

    await user.type(within(drawer).getByLabelText('Full name'), 'Meera Iyer');
    await user.type(within(drawer).getByLabelText('Work email'), 'meera@mpx.test');
    await user.type(within(drawer).getByPlaceholderText('Number'), '98765 00011');
    await user.type(within(drawer).getByLabelText('Temporary password'), 'Temp-pass-2026');
    await user.click(within(drawer).getByRole('checkbox', { name: /^Assign tickets/ }));
    expect(within(drawer).getByRole('checkbox', { name: /^See all tickets/ }).checked).toBe(true);
    expect(within(drawer).getByRole('checkbox', { name: /^View support tickets/ }).checked).toBe(true);
    await user.click(within(drawer).getByRole('button', { name: 'Create employee' }));
    await waitFor(() => expect(writes('POST', '/admin/employees')).toHaveLength(1));
    const sent = writes('POST', '/admin/employees')[0].data;
    expect(sent).toMatchObject({ name: 'Meera Iyer', email: 'meera@mpx.test', mobile: { number: '9876500011' }, password: 'Temp-pass-2026' });
    expect([...sent.permissions].sort()).toEqual(['support:assign', 'support:read', 'support:view_all']);
  });
});

describe('Users', () => {
  const firstParty = recorded.byRole.superadmin['GET /admin/users?page=1&pageSize=20&role=buyer,exporter'].body;

  it('deactivate asks first and sends that user', async () => {
    const user = userEvent.setup();
    const rows = firstParty.users ?? firstParty.rows;
    fakeApi.on('POST', `/admin/users/${rows[0].id}/deactivate`, { user: { ...rows[0], isActive: false } });
    await renderPage(await loadPage('admin/Users', 'Users'), { auth, role: 'superadmin', url: '/admin/users' });
    const menus = await screen.findAllByRole('button', { name: `Actions for ${rows[0].name}` });
    await user.click(menus[0]);
    await user.click(within(await screen.findByRole('menu')).getByText('Deactivate'));
    const dialog = await screen.findByRole('dialog');
    expect(writes('POST', new RegExp('/deactivate$'))).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(writes('POST', `/admin/users/${rows[0].id}/deactivate`)).toHaveLength(1));
  });
});

describe('Company (organisation) detail', () => {
  it('block needs a reason (shown on the record) and sends it for THIS company', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/OrganisationDetail', 'OrganisationDetail'), {
      auth,
      role: 'superadmin',
      url: `/admin/organisations/${IDS.beta}`,
      pattern: '/admin/organisations/:id',
    });
    await user.click((await screen.findAllByRole('button', { name: 'Block company' }))[0]);
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Block company' });
    expect(confirm.disabled).toBe(true);
    await user.type(within(dialog).getByLabelText(/Reason/), 'Repeated counterfeit listings.');
    await user.click(confirm);
    await waitFor(() => expect(writes('POST', `/admin/orgs/${IDS.beta}/block`)).toHaveLength(1));
    expect(writes('POST', `/admin/orgs/${IDS.beta}/block`)[0].data).toEqual({ reason: 'Repeated counterfeit listings.' });
  });
});
