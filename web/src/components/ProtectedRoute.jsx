import { Outlet } from 'react-router-dom';

// Client-side route gate. IMPORTANT (rule: web-frontend.md): this is UX only — the client
// never *decides* access. Every API call is re-authorised on the server; this just redirects
// unauthenticated users for a nicer experience.
//
// No auth logic yet: renders its children unconditionally. When auth context lands, read the
// session here and `return <Navigate to="/login" replace />` when there is none.
export function ProtectedRoute() {
  // TODO(auth): replace with a real session check from the auth context.
  return <Outlet />;
}
