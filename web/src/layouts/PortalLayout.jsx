import { useQuery } from '@tanstack/react-query';

import { ConsoleShell } from './ConsoleShell.jsx';
import { organisationApi, organisationKeys } from '../api/organisation.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Buyer + exporter panels. Thin wrapper over the ONE standard dashboard shell
 * (`ConsoleShell`) that the admin console also uses — the design is the same in
 * all three files, so the chrome lives in one place.
 *
 * Identity line = "Buyer · Company" on EVERY tab (owner, 2026-08-11): the
 * company name is fetched HERE from the caller's own Organisation, not passed
 * per-screen — per-screen sublines made the header flicker between "Exporter"
 * and "Exporter · Company" as you moved around. The 30s query cache means one
 * fetch serves the whole session's navigation. `subline` remains as an
 * explicit override only.
 */
const ROLE_LABELS = { buyer: 'Buyer', exporter: 'Exporter' };

export function PortalLayout({ nav, subline, wide = false, children }) {
  const { user } = useAuth();
  const org = useQuery({
    queryKey: organisationKeys.mine,
    queryFn: organisationApi.mine,
    enabled: Boolean(user),
  });
  const company = subline ?? org.data?.name;
  const identity = [ROLE_LABELS[user?.role] ?? user?.role, company].filter(Boolean).join(' · ');

  return (
    // The org's icon rides along with the name it already fetches (§A22), so the
    // portal shows the company's own mark rather than initials once it has one.
    <ConsoleShell nav={nav} identity={identity} logo={org.data?.logo} signOutTo="/signin">
      {/* The panels' design measure (860px) — right for M1's forms and status
          screens. `wide` opts a page out of it: M2's product TABLE needs the
          full canvas (the design draws it at ~1200px) and would otherwise be
          crushed into a column. This is CONTENT width only — the shell itself
          stays fixed and identical across buyer, exporter and admin. Content is
          left-aligned by design (owner, 2026-08-10 — no centring). */}
      <div className={wide ? 'max-w-[1200px]' : 'max-w-[860px]'}>{children}</div>
    </ConsoleShell>
  );
}
