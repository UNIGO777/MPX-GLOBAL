import { ConsoleShell } from './ConsoleShell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Buyer + exporter panels. Thin wrapper over the ONE standard dashboard shell
 * (`ConsoleShell`) that the admin console also uses — the design is the same in
 * all three files, so the chrome lives in one place.
 *
 * Identity line = "Buyer · Company". The company is only shown when a panel
 * passes `subline`: a buyer's own Organisation still has no read endpoint until
 * A22 (plan §7.4) and we don't stub one, so a cold buyer header reads "Buyer".
 */
const ROLE_LABELS = { buyer: 'Buyer', exporter: 'Exporter' };

export function PortalLayout({ nav, subline, children }) {
  const { user } = useAuth();
  const identity = [ROLE_LABELS[user?.role] ?? user?.role, subline].filter(Boolean).join(' · ');

  return (
    <ConsoleShell nav={nav} identity={identity} signOutTo="/signin">
      {/* The panels' design measure (860px). This is CONTENT, not shell — the
          shell itself stays fixed and identical for the admin console. */}
      <div className="max-w-[860px]">{children}</div>
    </ConsoleShell>
  );
}
