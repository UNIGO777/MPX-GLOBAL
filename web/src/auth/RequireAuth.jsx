import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext.jsx';

/**
 * Route gate — UX only, never enforcement (the server re-checks every call).
 *
 * - Anonymous → the given sign-in page (party by default; admin routes pass the
 *   staff one), carrying where they were going so sign-in can return them.
 * - `mustChangePassword` → the blocking change-password screen, everywhere
 *   except that screen itself (mirrors the backend's authorize gate).
 */
export function RequireAuth({ signin = '/signin' }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={signin} replace state={{ from: location.pathname }} />;
  }
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}
