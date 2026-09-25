import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { QuotationActions } from '../../src/components/quotation/QuotationActions.jsx';
import { fakeApi } from '../support/fakeApi.js';
import { IDS, writes } from '../support/renderPage.jsx';
import recorded from '../fixtures/recorded.json';

/**
 * Accept / Negotiate on a sent quotation (chat card). Accepting is CONFIRMED:
 * a code goes to the person's own email and must be entered — a click alone
 * never records an acceptance. Money travels as integer minor units.
 */
const sent = (extra = {}) => ({
  ...structuredClone(recorded.byRole.exporter[`GET /quotations/${IDS.quote}`].body.quotation),
  status: 'sent',
  validUntil: '2026-12-31T00:00:00.000Z',
  totalMinor: 12500000,
  currentFigureMinor: 12500000,
  ...extra,
});

function show(quotation, viewerSide) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuotationActions quotation={quotation} viewerSide={viewerSide} />
    </QueryClientProvider>,
  );
}

describe('Quotation — accept and negotiate', () => {
  it('the buyer accepts with an emailed code: request the code, then confirm with it', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', `/quotations/${IDS.quote}/accept/request-code`, { sentTo: 'n••••@example.com' });
    fakeApi.on('POST', `/quotations/${IDS.quote}/accept/confirm`, { quotation: sent({ status: 'accepted' }) });
    show(sent(), 'buyer');
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Confirm your acceptance')).toBeTruthy();
    expect(writes('POST', `/quotations/${IDS.quote}/accept/confirm`)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Email me a code' }));
    await waitFor(() => expect(writes('POST', `/quotations/${IDS.quote}/accept/request-code`)).toHaveLength(1));
    const boxes = await within(dialog).findAllByLabelText(/^Digit \d$/);
    await user.click(boxes[0]);
    await user.keyboard('123456');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(writes('POST', `/quotations/${IDS.quote}/accept/confirm`)).toHaveLength(1));
    expect(writes('POST', `/quotations/${IDS.quote}/accept/confirm`)[0].data).toEqual({ code: '123456' });
  });

  it('a counter-offer sends the whole total in minor units, never floats', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', `/quotations/${IDS.quote}/negotiate`, { quotation: sent({ status: 'negotiating' }) });
    show(sent(), 'buyer');
    await user.click(screen.getByRole('button', { name: 'Negotiate' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Your offer/), '118500.50');
    await user.type(within(dialog).getByPlaceholderText('Why this figure works for you'), 'Volume discount');
    await user.click(within(dialog).getByRole('button', { name: 'Send offer' }));
    await waitFor(() => expect(writes('POST', `/quotations/${IDS.quote}/negotiate`)).toHaveLength(1));
    expect(writes('POST', `/quotations/${IDS.quote}/negotiate`)[0].data).toEqual({ totalMinor: 11850050, note: 'Volume discount' });
  });

  it('offering the same figure that is already on the table is not allowed', async () => {
    const user = userEvent.setup();
    show(sent(), 'buyer');
    await user.click(screen.getByRole('button', { name: 'Negotiate' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Your offer/), '125000');
    expect(within(dialog).getByRole('button', { name: 'Send offer' }).disabled).toBe(true);
  });

  it('the exporter cannot accept their own price: they wait for the buyer', () => {
    show(sent(), 'exporter');
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.getByText('Waiting for the buyer to accept.')).toBeTruthy();
  });

  it('an answered quotation offers nothing', () => {
    const { container } = show(sent({ status: 'accepted' }), 'buyer');
    expect(container.textContent).toBe('');
  });
});
