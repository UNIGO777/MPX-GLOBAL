import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { BankAccounts } from '../../src/components/account/BankAccounts.jsx';
import { fakeApi } from '../support/fakeApi.js';
import { writes } from '../support/renderPage.jsx';

/**
 * Exporter bank details for quotations. The full account number is sent when
 * entered and NEVER shown back — only the masked last four. Editing without
 * retyping the number must not send one (the stored number stays).
 */
const ACCOUNT = { id: 'b1', label: 'HDFC current', beneficiary: 'Beta Traders', bankName: 'HDFC Bank', branch: null, masked: '••••4444', swift: null, ifsc: 'HDFC0001234', isDefault: true, lastConfirmedAt: null };

function show() {
  fakeApi.as('exporter');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BankAccounts />
    </QueryClientProvider>,
  );
}

describe('Bank details', () => {
  it('a saved account shows only its last four digits', async () => {
    fakeApi.on('GET', '/me/bank-accounts', { bankAccounts: [ACCOUNT] });
    show();
    expect(await screen.findByText(/••••4444/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d{8,}/);
  });

  it('adding sends the account number once, with IFSC upper-cased', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', '/me/bank-accounts', { bankAccounts: [] });
    fakeApi.on('POST', '/me/bank-accounts', { bankAccount: ACCOUNT });
    show();
    await user.click(await screen.findByRole('button', { name: 'Add bank details' }));
    const dialog = await screen.findByRole('dialog');
    const add = within(dialog).getByRole('button', { name: 'Add account' });
    expect(add.disabled).toBe(true);
    await user.type(within(dialog).getByPlaceholderText('HDFC current'), 'HDFC current');
    await user.type(within(dialog).getByPlaceholderText('As the bank has it'), 'Beta Traders');
    await user.type(within(dialog).getByRole('textbox', { name: 'Bank' }), 'HDFC Bank');
    await user.type(within(dialog).getByRole('textbox', { name: 'Account number' }), '50100012344444');
    await user.type(within(dialog).getByRole('textbox', { name: /IFSC/ }), 'hdfc0001234');
    await user.click(add);
    await waitFor(() => expect(writes('POST', '/me/bank-accounts')).toHaveLength(1));
    expect(writes('POST', '/me/bank-accounts')[0].data).toMatchObject({
      label: 'HDFC current',
      beneficiary: 'Beta Traders',
      bankName: 'HDFC Bank',
      accountNumber: '50100012344444',
      ifsc: 'HDFC0001234',
    });
  });

  it('editing without retyping the number does not send one', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', '/me/bank-accounts', { bankAccounts: [ACCOUNT] });
    fakeApi.on('PATCH', '/me/bank-accounts/b1', { bankAccount: ACCOUNT });
    show();
    await screen.findByText(/••••4444/);
    await user.click(screen.getAllByRole('button', { name: /edit/i })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByPlaceholderText('Leave blank to keep ••••4444')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(writes('PATCH', '/me/bank-accounts/b1')).toHaveLength(1));
    expect(writes('PATCH', '/me/bank-accounts/b1')[0].data).not.toHaveProperty('accountNumber');
  });
});
