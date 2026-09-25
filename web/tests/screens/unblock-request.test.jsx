import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderScreen } from './helpers.jsx';

// A plain function, not vi.fn: vitest's spy tracks a rejected call with a
// handler-less `.then`, which surfaces as an unhandled rejection even though
// the screen handles the error. `calls` records what was sent.
const api = vi.hoisted(() => ({ impl: async () => ({}), calls: [] }));
vi.mock('../../src/api/products.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    productsApi: {
      ...real.productsApi,
      requestUnblock: (...args) => {
        api.calls.push(args);
        return api.impl(...args);
      },
    },
  };
});

const { UnblockRequest } = await import('../../src/components/catalogue/UnblockRequest.jsx');

const DAY = 24 * 60 * 60 * 1000;
beforeEach(() => {
  api.calls = [];
  api.impl = async () => ({ id: 'p1' });
});

describe('D6 · seller "Request unblock"', () => {
  it('no request yet: offers the button; Send stays off until 10 characters', async () => {
    const user = userEvent.setup();
    renderScreen(<UnblockRequest productId="p1" request={null} />);

    await user.click(screen.getByRole('button', { name: 'Request unblock' }));
    const send = screen.getByRole('button', { name: 'Send request' });
    expect(send.disabled).toBe(true);

    await user.type(screen.getByLabelText('What did you change?'), '  Replaced the photos.  ');
    expect(send.disabled).toBe(false);
    await user.click(send);
    expect(api.calls).toEqual([['p1', 'Replaced the photos.']]);
  });

  it('shows the server\'s refusal instead of closing', async () => {
    const user = userEvent.setup();
    // Shaped like an AxiosError: a real Error carrying the server's envelope.
    const refusal = Object.assign(new Error('Request failed with status code 409'), {
      response: { status: 409, data: { error: { message: 'You have already asked for this product to be unblocked.' } } },
    });
    api.impl = async () => {
      throw refusal;
    };
    renderScreen(<UnblockRequest productId="p1" request={null} />);
    await user.click(screen.getByRole('button', { name: 'Request unblock' }));
    await user.type(screen.getByLabelText('What did you change?'), 'Replaced the photos.');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/already asked/)).toBeTruthy();
  });

  it('pending: says so, no button', () => {
    renderScreen(<UnblockRequest productId="p1" request={{ status: 'pending', at: new Date().toISOString() }} />);
    expect(screen.getByText(/Unblock requested/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Request unblock' })).toBeNull();
  });

  it('declined within 7 days: the reason and the wait, no button — and never who declined', () => {
    const decidedAt = new Date().toISOString();
    renderScreen(
      <UnblockRequest
        productId="p1"
        request={{ status: 'rejected', decidedAt, rejectReason: 'Logo still visible.', canAskAgainAt: new Date(Date.now() + 7 * DAY).toISOString() }}
      />,
    );
    expect(screen.getByText('Logo still visible.')).toBeTruthy();
    expect(screen.getByText(/You can ask again from/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Request unblock' })).toBeNull();
  });

  it('declined more than 7 days ago: can ask again', () => {
    renderScreen(
      <UnblockRequest
        productId="p1"
        request={{ status: 'rejected', decidedAt: new Date(Date.now() - 8 * DAY).toISOString(), rejectReason: 'x', canAskAgainAt: new Date(Date.now() - DAY).toISOString() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Request unblock' })).toBeTruthy();
  });
});
