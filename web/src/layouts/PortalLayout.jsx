import { ConsoleShell } from './ConsoleShell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Buyer + exporter panels. Thin wrapper over the ONE standard dashboard shell
 * (`ConsoleShell`) that the admin console also uses — the design is the same in
 * all three files, so the chrome lives in one place.
 *
 * Identity line = "Buyer · Company". The company is only shown when a panel
 * passes `subline`.
 *
 * ⚠️ Corrected 2026-08-09: this used to say a buyer's Organisation "has no read
 * endpoint until A22". **A22 shipped** — `GET /me/organisation` exists. No panel
 * passes `subline` yet, so a cold header still reads just "Buyer", but that is
 * now a screen that has not been built, not a missing endpoint.
 */
const ROLE_LABELS = { buyer: 'Buyer', exporter: 'Exporter' };

export function PortalLayout({ nav, subline, wide = false, children }) {
  const { user } = useAuth();
  const identity = [ROLE_LABELS[user?.role] ?? user?.role, subline].filter(Boolean).join(' · ');

  return (
    <ConsoleShell nav={nav} identity={identity} signOutTo="/signin">
      {/* The panels' design measure (860px) — right for M1's forms and status
          screens. `wide` opts a page out of it: M2's product TABLE needs the
          full canvas (the design draws it at ~1200px) and would otherwise be
          crushed into a column. This is CONTENT width only — the shell itself
          stays fixed and identical across buyer, exporter and admin. */}
      <div className={wide ? 'max-w-[1200px]' : 'max-w-[860px]'}>{children}</div>
    </ConsoleShell>
  );
}
