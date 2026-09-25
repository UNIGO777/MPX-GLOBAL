import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { loadPage, renderPage } from '../support/renderPage.jsx';

/**
 * Console lists: each filter must reach the SERVER as a query (the lists are
 * paged server-side — filtering what one page happens to hold would be wrong).
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, restoring: false, signOut: async () => {} }),
}));

const gets = (path) => fakeApi.calls.filter((c) => c.method === 'GET' && c.path === path).map((c) => c.key);

/** Open a FilterChip by its label and pick an option. */
async function pick(user, label, option) {
  await user.click(screen.getAllByRole('button', { name: new RegExp(`^${label}`) })[0]);
  const list = await screen.findByRole('listbox', { name: label });
  const opt = within(list).getByRole('option', { name: new RegExp(`^${option}`) });
  await user.click(within(opt).getByRole('button'));
}

describe('Console list filters reach the server', () => {
  it('Companies: side filter and search', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/Organisations', 'Organisations'), { auth, role: 'superadmin', url: '/admin/organisations' });
    await screen.findAllByText(/Beta Traders/);
    await pick(user, 'Side', 'Exporter side');
    await waitFor(() => expect(gets('/admin/orgs').some((k) => /side=exporter/.test(k))).toBe(true));
    await user.type(screen.getByRole('searchbox', { name: /search companies/i }), 'beta');
    await waitFor(() => expect(gets('/admin/orgs').some((k) => /q=beta/.test(k))).toBe(true), { timeout: 2500 });
  });

  it('Error log: method filter', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/ErrorLog', 'ErrorLog'), { auth, role: 'superadmin', url: '/admin/errors' });
    await pick(user, 'Method', 'POST');
    await waitFor(() => expect(gets('/admin/errors').some((k) => /method=POST/.test(k))).toBe(true));
  });

  it('Conversations: state filter', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/Conversations', 'Conversations'), { auth, role: 'superadmin', url: '/admin/conversations' });
    await pick(user, 'State', 'Blocked by MPX');
    await waitFor(() => expect(gets('/admin/conversations').some((k) => /blocked/.test(k))).toBe(true));
  });

  it('Verification queue: switching to Buyers asks for the buyer side', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/VerificationQueue', 'VerificationQueue'), { auth, role: 'superadmin', url: '/admin/verification' });
    await user.click(await screen.findByRole('tab', { name: /Buyers/ }));
    await waitFor(() => expect(gets('/admin/orgs').some((k) => /side=buyer/.test(k))).toBe(true));
  });

  it('Reports: the period buttons change the window asked for', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/Reports', 'Reports'), { auth, role: 'superadmin', url: '/admin/reports' });
    const group = await screen.findByRole('group', { name: 'Period' });
    const buttons = within(group).getAllByRole('button');
    await user.click(buttons[0]);
    const days = buttons[0].textContent.match(/\d+/)[0];
    await waitFor(() => expect(gets('/admin/reports/staff').some((k) => new RegExp(`days=${days}`).test(k))).toBe(true));
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('Audit log: the period filter narrows the query', async () => {
    const user = userEvent.setup();
    await renderPage(await loadPage('admin/AuditLog', 'AuditLog'), { auth, role: 'superadmin', url: '/admin/audit' });
    const before = gets('/admin/audit').length;
    await user.click(screen.getAllByRole('button', { name: /^Period/ })[0]);
    const list = await screen.findByRole('listbox', { name: 'Period' });
    await user.click(within(within(list).getAllByRole('option')[1]).getByRole('button'));
    await waitFor(() => expect(gets('/admin/audit').length).toBeGreaterThan(before));
    expect(gets('/admin/audit').at(-1)).toMatch(/from=/);
  });
});
