import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NotificationItem } from '../../src/components/notifications/NotificationItem.jsx';

const item = (extra = {}) => ({
  id: 'n1',
  type: 'chat.message',
  title: 'New message from Delta Knits',
  body: 'Organic Cotton Twill',
  count: 1,
  at: new Date().toISOString(),
  read: false,
  ...extra,
});

describe('NotificationItem', () => {
  it('shows title, product and an unread marker for screen readers', () => {
    render(<NotificationItem item={item()} onOpen={() => {}} />);
    expect(screen.getByText('New message from Delta Knits')).toBeTruthy();
    expect(screen.getByText('Organic Cotton Twill')).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
  });

  it('a coalesced row shows its count; a read row has no unread marker', () => {
    render(<NotificationItem item={item({ count: 4, read: true })} onOpen={() => {}} />);
    expect(screen.getByText('(4)')).toBeTruthy();
    expect(screen.queryByText('Unread')).toBeNull();
  });

  it('clicking opens that notification', async () => {
    const onOpen = vi.fn();
    render(<NotificationItem item={item()} onOpen={onOpen} />);
    await userEvent.setup().click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
  });
});
