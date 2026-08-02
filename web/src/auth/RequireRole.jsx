import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from './AuthContext.jsx';
import { roleHome } from './roleHome.js';

/**
 * Role gate for a route group. A signed-in user of the WRONG role is sent to
 * their own home — never shown the page and never a 403 that leaks structure
 * (web-screens-design §7). Mount inside RequireAuth.
 */
export function RequireRole({ roles }) {
  const { user } = useAuth();
  if (!user) return null; // RequireAuth upstream handles anonymous
  if (!roles.includes(user.role)) {
    return <Navigate to={roleHome(user)} replace />;
  }
  return <Outlet />;
}
