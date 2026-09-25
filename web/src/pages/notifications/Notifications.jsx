import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { NotificationsList } from '../../components/notifications/NotificationsList.jsx';
import { BUYER_NAV } from '../buyer/buyerNav.js';
import { EXPORTER_NAV } from '../exporter/exporterNav.js';

/**
 * B8 · the full notifications page — `/buyer/notifications`,
 * `/exporter/notifications`, `/admin/notifications`, `/staff/notifications`.
 * One component; the chrome follows the reader (company portal or console).
 * "Unread" is in the URL (`?show=unread`) so it survives a reload.
 */
export function Notifications() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const unreadOnly = params.get('show') === 'unread';

  useEffect(() => {
    const previous = document.title;
    document.title = 'Notifications — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const body = (
    <>
      <header className="mb-5">
        <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted">What happened on your account — open one to go straight to it.</p>
      </header>
      <NotificationsList
        unreadOnly={unreadOnly}
        onToggleUnread={(v) => setParams(v ? { show: 'unread' } : {}, { replace: true })}
      />
    </>
  );

  if (user?.role === 'buyer' || user?.role === 'exporter') {
    return <PortalLayout nav={user.role === 'exporter' ? EXPORTER_NAV : BUYER_NAV}>{body}</PortalLayout>;
  }
  return <AdminLayout>{body}</AdminLayout>;
}
