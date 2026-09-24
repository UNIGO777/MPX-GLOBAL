import { useQuery } from '@tanstack/react-query';

import { supportApi, supportKeys } from '../api/support.js';

/**
 * The published support contact ({ email, phone, hours }, any may be null) and
 * the company footer block ({ name, address, linkedinUrl }) — 2026-09-25.
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
  const email = q.data?.support?.email ?? null;
  const phone = q.data?.support?.phone ?? null;
  const hours = q.data?.support?.hours ?? null;
  const company = q.data?.company ?? { name: null, address: null, linkedinUrl: null };
  return { email, phone, hours, company, hasAny: Boolean(email || phone), isLoading: q.isLoading };
}
