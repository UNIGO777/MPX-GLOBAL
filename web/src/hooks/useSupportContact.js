import { useQuery } from '@tanstack/react-query';

import { supportApi, supportKeys } from '../api/support.js';

/**
 * The published support contact ({ email, phone }, either may be null).
 * Cached for a few minutes — it changes when a superadmin edits Settings,
 * which is rare, and it is read on every page that has a footer.
 */
export function useSupportContact() {
  const q = useQuery({
    queryKey: supportKeys.contact,
    queryFn: supportApi.contact,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const email = q.data?.email ?? null;
  const phone = q.data?.phone ?? null;
  return { email, phone, hasAny: Boolean(email || phone), isLoading: q.isLoading };
}
