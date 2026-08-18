import { useInfiniteQuery } from '@tanstack/react-query';

import { conversationsApi, conversationKeys } from '../api/conversations.js';

export const CONVERSATION_PAGE_LIMIT = 20;

/**
 * The party's conversation list — ONE definition for every surface that shows
 * it (the inbox page and the dock).
 *
 * 🔴 This exists because the two surfaces shared a query KEY while storing
 * different SHAPES: the inbox used `useInfiniteQuery` (`{ pages: [...] }`) and
 * the dock a plain `useQuery` (`{ conversations: [...] }`). One cache entry,
 * two writers — so whichever fetched last won, and the dock read
 * `data.conversations` off an infinite-shaped entry, got `undefined`, and
 * reported "No conversations yet" while the inbox showed the same threads.
 *
 * Splitting the keys instead would have been worse, and the key factory says so:
 * two entries mean the list is fetched twice and reading a thread in one surface
 * leaves the other showing it unread.
 *
 * Cursor pagination, never page numbers — this list reorders every time a
 * message lands anywhere in it.
 */
export function useConversationList(search = '') {
  return useInfiniteQuery({
    queryKey: conversationKeys.list({ q: search }),
    queryFn: ({ pageParam }) =>
      conversationsApi.list({
        q: search || undefined,
        cursor: pageParam,
        limit: CONVERSATION_PAGE_LIMIT,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** The flat rows behind an infinite list — the shape every consumer wants. */
export function conversationRowsOf(query) {
  return (query.data?.pages ?? []).flatMap((page) => page.conversations);
}
