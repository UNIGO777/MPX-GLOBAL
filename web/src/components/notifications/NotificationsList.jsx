import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationsApi, notificationKeys } from '../../api/notifications.js';
import { apiError } from '../../lib/format.js';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { ErrorState } from '../ui/ErrorState.jsx';
import { BellIcon } from '../ui/icons.jsx';
import { SkeletonRows } from '../ui/Skeleton.jsx';
import { NotificationItem } from './NotificationItem.jsx';
import { linkFor } from './notificationMeta.js';

/**
 * The full notifications page body — used by the company portals and the staff
 * console alike. "All" or "Unread", newest first, 20 at a time.
 */
export function NotificationsList({ unreadOnly = false, onToggleUnread }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = unreadOnly ? { unread: '1' } : {};
  const list = useInfiniteQuery({
    queryKey: notificationKeys.list({ page: true, ...params }),
    queryFn: ({ pageParam }) => notificationsApi.list({ ...params, ...(pageParam ? { before: pageParam } : {}) }),
    initialPageParam: null,
    getNextPageParam: (last) => last?.nextBefore ?? undefined,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const anyUnread = items.some((i) => !i.read);

  const openItem = (item) => {
    if (!item.read) markRead.mutate(item.id);
    const to = linkFor(item.link);
    if (to) navigate(to);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3 sm:px-5">
        <div role="tablist" aria-label="Show" className="inline-flex rounded-lg bg-ink-100 p-1">
          {[['All', false], ['Unread', true]].map(([label, val]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={unreadOnly === val}
              onClick={() => onToggleUnread(val)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${unreadOnly === val ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {anyUnread && (
          <Button size="sm" variant="secondary" loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        )}
      </div>

      {list.isLoading ? (
        <SkeletonRows rows={6} />
      ) : list.error ? (
        <ErrorState title="We couldn't load your notifications" message={apiError(list.error).message} onRetry={list.refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon={BellIcon} title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}>
          {unreadOnly ? 'You have read everything.' : 'Updates about your account, requests and conversations will appear here.'}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-surface-border">
            {items.map((item) => (
              <li key={item.id}>
                <NotificationItem item={item} onOpen={openItem} />
              </li>
            ))}
          </ul>
          {list.hasNextPage && (
            <div className="border-t border-surface-border p-3 text-center">
              <Button size="sm" variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                Show older
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
