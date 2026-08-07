import { QueryClient } from '@tanstack/react-query';

/**
 * The ONE query client. Server data (products, categories, the verification
 * queue) lives here; only local UI state — modals, form drafts, toggles — stays
 * in component state (`web-frontend.md`, "server state ≠ client state").
 *
 * Queries still go through `api/*.js` → `apiClient`, so the 401→refresh→retry
 * interceptor and the `X-Client: web` header are unchanged. This layer caches
 * what those functions return; it never fetches on its own.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The catalogue is not a live feed. Refetching the whole product list
      // every time a seller tabs back to the window is noise, not freshness —
      // mutations invalidate the keys that actually changed.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 🔴 Never retry a 4xx. A 401 is already handled by the client's
      // refresh-and-retry interceptor, and a 403/404 is a real answer — retrying
      // it three times just delays the error state the screen has to draw.
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/**
 * Wipe every cached response. Called on sign-out: `web-frontend.md` requires
 * that no previous user's data survives in memory, and a cache that outlived a
 * session would show the next signed-in user the last one's rows.
 */
export function clearQueryCache() {
  queryClient.clear();
}
