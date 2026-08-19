import { Suspense, lazy } from 'react';
import { useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './auth/AuthContext.jsx';
import { queryClient } from './lib/queryClient.js';
import { Landing } from './pages/public/Landing.jsx';
import { Categories } from './pages/public/Categories.jsx';
import { CategoryListing } from './pages/public/CategoryListing.jsx';
import { ProductDetail } from './pages/public/ProductDetail.jsx';
import { SupplierProfile } from './pages/public/SupplierProfile.jsx';
import { Search } from './pages/public/Search.jsx';
import { AiSearch } from './pages/public/AiSearch.jsx';
import { NotFound } from './pages/public/NotFound.jsx';
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
import { SavedItems } from './pages/buyer/SavedItems.jsx';
import { ChatInbox } from './pages/chat/ChatInbox.jsx';
import { ChatDock } from './chat/ChatDock.jsx';
import { ChatDockProvider } from './chat/ChatDockContext.jsx';
import { VerificationStatus as ExporterVerificationStatus } from './pages/exporter/VerificationStatus.jsx';
import { KycUpload as ExporterKycUpload } from './pages/exporter/KycUpload.jsx';
import { Products as ExporterProducts } from './pages/exporter/Products.jsx';
import { ProductForm } from './pages/exporter/ProductForm.jsx';
import { CompanyProfile } from './pages/account/CompanyProfile.jsx';
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
const CategoryManager = lazy(() =>
  import('./pages/admin/CategoryManager.jsx').then((m) => ({ default: m.CategoryManager })),
);
const AttributeManager = lazy(() =>
  import('./pages/admin/AttributeManager.jsx').then((m) => ({ default: m.AttributeManager })),
);
const OrganisationDetail = lazy(() =>
  import('./pages/admin/OrganisationDetail.jsx').then((m) => ({ default: m.OrganisationDetail })),
);
const Dashboard = lazy(() =>
  import('./pages/admin/Dashboard.jsx').then((m) => ({ default: m.Dashboard })),
);
const Organisations = lazy(() =>
  import('./pages/admin/Organisations.jsx').then((m) => ({ default: m.Organisations })),
);
const ProductMonitoring = lazy(() =>
  import('./pages/admin/ProductMonitoring.jsx').then((m) => ({ default: m.ProductMonitoring })),
);
const Conversations = lazy(() =>
  import('./pages/admin/Conversations.jsx').then((m) => ({ default: m.Conversations })),
);
const ConversationViewer = lazy(() =>
  import('./pages/admin/ConversationViewer.jsx').then((m) => ({ default: m.ConversationViewer })),
);
const AuditLog = lazy(() =>
  import('./pages/admin/AuditLog.jsx').then((m) => ({ default: m.AuditLog })),
);
const ErrorLog = lazy(() =>
  import('./pages/admin/ErrorLog.jsx').then((m) => ({ default: m.ErrorLog })),
);
const Featured = lazy(() =>
  import('./pages/admin/Featured.jsx').then((m) => ({ default: m.Featured })),
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
/**
 * Scroll restoration (owner-reported, 2026-08-11): the router keeps scroll
 * across navigations, so a page opened from deep in a list started mid-scroll.
 * Two scrollers exist — the WINDOW on public pages, the console shell's <main>
 * on portal/admin screens — reset both on every pathname change. Hash
 * navigations (`/#faq`) are left alone so anchors still land on their section;
 * query-only changes (pagination, filters) deliberately keep position.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useLayoutEffect(() => {
    // The browser's own restoration fights this on back/forward — take it over.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    if (hash) return;
    // LAYOUT effect: reset BEFORE the new page paints, so it can never be seen
    // scrolled. Every scroller: window (public pages), documentElement/body
    // (engine differences), and any <main> (the console shells scroll there).
    const reset = () => {
      // The stylesheet sets scroll-behavior:smooth, which turns these resets
      // into a visible glide from the old position (found via headless-browser
      // trace). Suspend it for the reset so the new page STARTS at the top.
      const root = document.documentElement;
      const prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll('main').forEach((el) => {
        el.style.scrollBehavior = 'auto';
        el.scrollTop = 0;
        el.style.scrollBehavior = '';
      });
      root.style.scrollBehavior = prev;
    };
    reset();
    // Second pass a frame later: catches a scroller that only becomes
    // scrollable after async content/images land in the same navigation.
    const raf = requestAnimationFrame(() => requestAnimationFrame(reset));
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    // Query cache OUTSIDE the auth provider: sign-out clears it (see
    // AuthContext), and it must not be torn down and rebuilt by an auth
    // re-render mid-flight.
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          {/* M4 · the docked chat. Mounted OUTSIDE <Routes> on purpose: a
              conversation must survive navigation, which is the entire point of
              a dock. It renders nothing for guests, staff or auth screens. */}
          <ChatDockProvider>
          <Routes>
            {/* --- Public (guest-visible; no auth guard by design — B7) --- */}
            <Route path="/" element={<Landing />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/category/:slug" element={<CategoryListing />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/supplier/:slug" element={<SupplierProfile />} />
            <Route path="/search" element={<Search />} />
            <Route path="/ai-search" element={<AiSearch />} />

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
                <Route path="/buyer/company" element={<CompanyProfile />} />
                {/* M3 screen 8 — saved items. Buyer-only here AND on every
                    /saved endpoint; guests land on sign-in via RequireAuth. */}
                <Route path="/saved" element={<SavedItems />} />
                {/* M4 screens 3+4. One component serves the list and the
                    thread: at lg+ both panes show at once, below that the
                    thread replaces the list. */}
                <Route path="/buyer/chat" element={<ChatInbox />} />
                <Route path="/buyer/chat/:id" element={<ChatInbox />} />
              </Route>
            </Route>

            {/* --- Exporter panel --- */}
            <Route element={<RequireAuth />}>
              <Route element={<RequireRole roles={['exporter']} />}>
                <Route path="/exporter/verification" element={<ExporterVerificationStatus />} />
                {/* Old bookmark-friendly alias — the hub moved (owner, 2026-08-11). */}
                <Route path="/exporter" element={<Navigate to="/exporter/verification" replace />} />
                <Route path="/exporter/kyc" element={<ExporterKycUpload />} />
                <Route path="/exporter/company" element={<CompanyProfile />} />
                <Route path="/exporter/products" element={<ExporterProducts />} />
                <Route path="/exporter/products/new" element={<ProductForm />} />
                <Route path="/exporter/products/:id/edit" element={<ProductForm />} />
                {/* Same component as the buyer's — one role-aware inbox
                    (M4-35), scoped server-side by the caller's own org. */}
                <Route path="/exporter/chat" element={<ChatInbox />} />
                <Route path="/exporter/chat/:id" element={<ChatInbox />} />
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
                  <Route path="/admin/organisations" element={<Organisations />} />
                  <Route path="/admin/organisations/:id" element={<OrganisationDetail />} />
                  <Route path="/admin/users" element={<Users />} />
                  <Route path="/admin/categories" element={<CategoryManager />} />
                  <Route path="/admin/categories/:id/attributes" element={<AttributeManager />} />
                  <Route path="/admin/products" element={<ProductMonitoring />} />
                  <Route path="/admin/verification" element={<VerificationQueue />} />
                  {/* M4 screens 5-6 — permissioned per endpoint on the server;
                      the sidebar item hides without `conversation:read`. */}
                  <Route path="/admin/conversations" element={<Conversations />} />
                  <Route path="/admin/conversations/:id" element={<ConversationViewer />} />
                  <Route path="/admin/verification/:orgId/kyc" element={<KycViewer />} />
                  <Route element={<RequireRole roles={['superadmin']} />}>
                    <Route path="/admin/staff" element={<Employees />} />
                    {/* The screen was /admin/employees until 2026-08-18. Kept as
                        a redirect rather than deleted: the old path is in the
                        owner's bookmarks and in older History entries, and a
                        superadmin hitting a dead admin URL has no way to tell a
                        rename from a permission problem. */}
                    <Route path="/admin/employees" element={<Navigate to="/admin/staff" replace />} />
                  </Route>
                  <Route path="/admin/dashboard" element={<Dashboard />} />
                  <Route path="/admin/audit" element={<AuditLog />} />
                  <Route path="/admin/errors" element={<ErrorLog />} />
                  <Route path="/admin/featured" element={<Featured />} />
                  <Route path="/admin/settings" element={<ComingSoon title="Settings" />} />
                  <Route path="/admin/no-access" element={<NoAccess />} />
                </Route>
              </Route>
            </Route>

            {/* Dev-only foundation review; never mounted in a production build. */}
            {import.meta.env.DEV && <Route path="/styleguide" element={<Styleguide />} />}

            {/* 🔴 A real not-found page, NOT a redirect home. M2's public screens
                need one designed state for every unavailable entity, and
                m3-seo.md §6 requires dead public URLs to stop being indexable —
                bouncing them to the homepage did neither. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ChatDock />
          </ChatDockProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
