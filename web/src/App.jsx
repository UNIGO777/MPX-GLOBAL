import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext.jsx';
import { Landing } from './pages/public/Landing.jsx';
import { Styleguide } from './pages/Styleguide.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { SignIn } from './pages/auth/SignIn.jsx';
import { StaffSignIn } from './pages/auth/StaffSignIn.jsx';
import { ChangePassword } from './pages/auth/ChangePassword.jsx';
import { RequireRole } from './auth/RequireRole.jsx';
import { VerificationStatus } from './pages/buyer/VerificationStatus.jsx';
import { KycUpload } from './pages/buyer/KycUpload.jsx';
import { VerificationStatus as ExporterVerificationStatus } from './pages/exporter/VerificationStatus.jsx';
import { KycUpload as ExporterKycUpload } from './pages/exporter/KycUpload.jsx';
import { Users } from './pages/admin/Users.jsx';
import { VerificationQueue } from './pages/admin/VerificationQueue.jsx';
import { KycViewer } from './pages/admin/KycViewer.jsx';
import { Employees } from './pages/admin/Employees.jsx';
import { ComingSoon, NoAccess } from './pages/admin/ComingSoon.jsx';
import { Otp } from './pages/auth/Otp.jsx';
import { Forgot } from './pages/auth/Forgot.jsx';
import { Reset } from './pages/auth/Reset.jsx';
import { BuyerSignup } from './pages/auth/BuyerSignup.jsx';
import { ExporterSignup } from './pages/auth/ExporterSignup.jsx';

/**
 * Route map (build plan §2) — all M1 screens shipped. Admin areas outside the
 * M1 set render the designed ComingSoon page (logged in docs/UiWebNotes.md).
 */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* --- Public --- */}
          <Route path="/" element={<Landing />} />

          {/* --- Party auth (buyer + exporter share screens; portal = the field change) --- */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/otp" element={<Otp />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/signup/buyer" element={<BuyerSignup />} />
          <Route path="/signup/exporter" element={<ExporterSignup />} />

          {/* --- Staff auth (admin + employee share the page; no portal, no entanglement) --- */}
          <Route path="/signin/staff" element={<StaffSignIn />} />

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

          {/* Dev-only foundation review; never mounted in a production build. */}
          {import.meta.env.DEV && <Route path="/styleguide" element={<Styleguide />} />}

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
