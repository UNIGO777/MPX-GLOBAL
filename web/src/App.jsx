import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext.jsx';
import { Landing } from './pages/public/Landing.jsx';
import { Styleguide } from './pages/Styleguide.jsx';
import { Spinner } from './components/ui/Spinner.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { RedirectIfAuthed } from './auth/RedirectIfAuthed.jsx';
import { SignIn } from './pages/auth/SignIn.jsx';
import { StaffSignIn } from './pages/auth/StaffSignIn.jsx';
import { ChangePassword } from './pages/auth/ChangePassword.jsx';
import { RequireRole } from './auth/RequireRole.jsx';
import { VerificationStatus } from './pages/buyer/VerificationStatus.jsx';
import { KycUpload } from './pages/buyer/KycUpload.jsx';
import { VerificationStatus as ExporterVerificationStatus } from './pages/exporter/VerificationStatus.jsx';
import { KycUpload as ExporterKycUpload } from './pages/exporter/KycUpload.jsx';
import { Otp } from './pages/auth/Otp.jsx';
import { SignupVerify } from './pages/auth/SignupVerify.jsx';
import { SignupCompany } from './pages/auth/SignupCompany.jsx';
import { Forgot } from './pages/auth/Forgot.jsx';
import { Reset } from './pages/auth/Reset.jsx';
import { BuyerSignup } from './pages/auth/BuyerSignup.jsx';
import { ExporterSignup } from './pages/auth/ExporterSignup.jsx';

/**
 * The admin console is a SEPARATE BUNDLE, not a separate app (owner, 2026-08-02).
 * Every admin screen was previously in the main chunk, so an anonymous visitor
 * to the landing page downloaded the employee/KYC/permission screens — free
 * reconnaissance of internal endpoints and permission strings. Lazy routes keep
 * that code out of a public visitor's download.
 *
 * This is NOT an access control. The server re-checks every request; RequireAuth
 * and RequireRole below are UX. Splitting the bundle changes what ships, not who
 * is allowed in.
 */
const Users = lazy(() => import('./pages/admin/Users.jsx').then((m) => ({ default: m.Users })));
const VerificationQueue = lazy(() =>
  import('./pages/admin/VerificationQueue.jsx').then((m) => ({ default: m.VerificationQueue })),
);
const KycViewer = lazy(() =>
  import('./pages/admin/KycViewer.jsx').then((m) => ({ default: m.KycViewer })),
);
const Employees = lazy(() =>
  import('./pages/admin/Employees.jsx').then((m) => ({ default: m.Employees })),
);
const ComingSoon = lazy(() =>
  import('./pages/admin/ComingSoon.jsx').then((m) => ({ default: m.ComingSoon })),
);
const NoAccess = lazy(() =>
  import('./pages/admin/ComingSoon.jsx').then((m) => ({ default: m.NoAccess })),
);

/** Shown only while an admin chunk is in flight — never a blank screen. */
function ChunkFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
      <Spinner className="h-6 w-6 text-primary-600" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Route map (build plan §2) — all M1 screens shipped. Admin areas outside the
 * M1 set render the designed ComingSoon page (logged in docs/UiWebNotes.md).
 */
export function App() {
  // console.log("asdf")
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* --- Public --- */}
          <Route path="/" element={<Landing />} />

          {/* --- Party auth (buyer + exporter share screens; portal = the field change) ---
                 All of these are for signed-OUT visitors: RedirectIfAuthed sends a live
                 session to its own home instead of a second login. /otp is deliberately
                 outside the guard — it completes the sign-in and redirects itself. */}
          <Route element={<RedirectIfAuthed />}>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/signup/buyer" element={<BuyerSignup />} />
            <Route path="/signup/exporter" element={<ExporterSignup />} />

            {/* --- Staff auth (admin + employee share the page; no portal, no entanglement) --- */}
            <Route path="/signin/staff" element={<StaffSignIn />} />
          </Route>

          <Route path="/otp" element={<Otp />} />

          {/* A21 signup steps 2-4. Outside RedirectIfAuthed for the same reason
              /otp is: they finish the flow and redirect themselves, and the last
              one issues the session. Each requires the signup token in router
              state and sends a direct hit back to sign-in. */}
          <Route path="/signup/verify" element={<SignupVerify />} />
          <Route path="/signup/company" element={<SignupCompany />} />

          {/* Blocking gate — RequireAuth sends every signed-in mustChangePassword
              user here and nowhere else (mirrors the backend's authorize 403). */}
          {/* Anonymous direct hits go to the staff page: the only flow that
              lands here today is the staff temp-password gate. */}
          <Route element={<RequireAuth signin="/signin/staff" />}>
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* --- Buyer panel --- */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole roles={['buyer']} />}>
              <Route path="/buyer/verification" element={<VerificationStatus />} />
              <Route path="/buyer/kyc" element={<KycUpload />} />
            </Route>
          </Route>

          {/* --- Exporter panel --- */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole roles={['exporter']} />}>
              <Route path="/exporter" element={<ExporterVerificationStatus />} />
              <Route path="/exporter/kyc" element={<ExporterKycUpload />} />
            </Route>
          </Route>

          {/* --- Admin console (staff only; per-screen permissions are the
                 server's — the sidebar merely hides what a 403 would refuse) --- */}
          <Route element={<RequireAuth signin="/signin/staff" />}>
            <Route element={<RequireRole roles={['employee', 'superadmin']} />}>
              <Route
                element={
                  <Suspense fallback={<ChunkFallback />}>
                    <Outlet />
                  </Suspense>
                }
              >
                <Route path="/admin/users" element={<Users />} />
                <Route path="/admin/verification" element={<VerificationQueue />} />
                <Route path="/admin/verification/:orgId/kyc" element={<KycViewer />} />
                <Route element={<RequireRole roles={['superadmin']} />}>
                  <Route path="/admin/employees" element={<Employees />} />
                </Route>
                <Route path="/admin/dashboard" element={<ComingSoon title="Dashboard" />} />
                <Route path="/admin/audit" element={<ComingSoon title="Audit log" />} />
                <Route path="/admin/settings" element={<ComingSoon title="Settings" />} />
                <Route path="/admin/no-access" element={<NoAccess />} />
              </Route>
            </Route>
          </Route>

          {/* Dev-only foundation review; never mounted in a production build. */}
          {import.meta.env.DEV && <Route path="/styleguide" element={<Styleguide />} />}

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
