import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from './AuthContext.jsx';
import { RestoringSession } from './RestoringSession.jsx';
import { roleHome } from './roleHome.js';

/**
 * The mirror of RequireAuth: a signed-in user has no business on sign-in,
 * signup or password-recovery. Without this they can start a second login on
 * top of a live session, or be shown "Get started" for an account they hold.
 *
 * `mustChangePassword` still wins — that gate is blocking everywhere, so a
 * staff user mid-temp-password goes there rather than to their role home.
 *
 * NOT applied to /otp: verification completes the sign-in and then navigates
 * itself, so guarding it would race the redirect.
 */
export function RedirectIfAuthed() {
  const { user, restoring } = useAuth();
  // Same race, opposite direction: rendering the sign-in form before the silent
  // refresh resolves would flash it at someone who is already signed in.
  if (restoring) return <RestoringSession />;
  if (!user) return <Outlet />;
  return <Navigate to={user.mustChangePassword ? '/change-password' : roleHome(user)} replace />;
}
