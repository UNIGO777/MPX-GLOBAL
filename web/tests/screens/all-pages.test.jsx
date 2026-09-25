import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { fakeApi } from '../support/fakeApi.js';
import { ChatDockProvider } from '../../src/chat/ChatDockContext.jsx';

/**
 * EVERY page, rendered as the right person, on REAL data.
 *
 * The responses come from `tests/fixtures/recorded.json`: what the running app
 * actually received for these pages from the local TEST database (2026-09-25).
 * Each page must:
 *   · render without throwing,
 *   · not show the "We couldn't load this" error box,
 *   · not log a React error,
 *   · not ask for data the real app never needed for it (a request the
 *     recording cannot answer means the page changed what it loads).
 * Behaviour is tested page by page elsewhere; this is the net under all of it.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: auth.user,
    restoring: false,
    sessionNote: null,
    completeSignIn: async () => {},
    applyNewTokens: () => {},
    signOut: async () => {},
  }),
  AuthProvider: ({ children }) => children,
}));

const IDS = {
  beta: '6ab3fa2261a10d563d5cd903',
  delta: '6ab3ff4853c66bbe08c87832',
  product: '6ab4122cda7bcd5fad8b2b9e',
  leaf: '6ab3f9ceea23c9777a40ec3c',
  conv: '6ab41c41fb0608c385b05ed3',
  buyerConv: '6ab4ff1a86dc6e9cb2c8b417',
  lead: '6ab4ff0686dc6e9cb2c8b412',
  buyerTicket: '6ab4ef328bd8b4e3136d61ab',
  staffTicket: '6ab50f6301c1ac72fe8b3902',
};

const USERS = {
  guest: null,
  buyer: { id: 'u-buyer', name: 'Nikita Rao', email: 'ucm_192532@example.com', role: 'buyer', orgId: IDS.delta, permissions: [] },
  exporter: { id: 'u-exporter', name: 'Priya Picker', email: 'uia_873388@example.com', role: 'exporter', orgId: IDS.beta, permissions: [] },
  superadmin: { id: 'u-admin', name: 'Local Admin', email: 'localadmin@example.com', role: 'superadmin', orgId: null, permissions: [] },
  // Asha: tickets only, and only her own (no "See all tickets").
  employee: { id: 'u-asha', name: 'Asha Menon', email: 'walk.staff.025633@example.com', role: 'employee', orgId: null, permissions: ['support:read', 'support:reply', 'support:status'] },
};

// Router state the auth steps are handed by the step before them.
const LOGIN_FLOW = { loginToken: 'lt', method: 'otp', sentTo: '+91 ••••• 3210', identifier: 'nikita@example.com', backTo: '/signin' };
const SIGNUP_FLOW = { signupToken: 'st', email: 'n••••@example.com', mobile: '+91 ••••• 3210', role: 'buyer', signupPath: '/signup/buyer' };
const QUOTE = '6ab650b4f8c4aabfa62c9cdb';

const MODULES = import.meta.glob('../../src/pages/**/*.jsx');
const page = (file, name) => async () => (await MODULES[`../../src/pages/${file}.jsx`]())[name];

// [label, role, route pattern, url, component]
const PAGES = [
  // Public
  ['Landing', 'guest', '/', '/', page('public/Landing', 'Landing')],
  ['Categories', 'guest', '/categories', '/categories', page('public/Categories', 'Categories')],
  ['Category (top)', 'guest', '/category/:slug', '/category/tex-779280', page('public/CategoryListing', 'CategoryListing')],
  ['Category (leaf)', 'guest', '/category/:slug', '/category/cotton-779280', page('public/CategoryListing', 'CategoryListing')],
  ['Product page', 'guest', '/product/:slug', '/product/organic-cotton-twill', page('public/ProductDetail', 'ProductDetail')],
  ['Product page (buyer)', 'buyer', '/product/:slug', '/product/organic-cotton-twill', page('public/ProductDetail', 'ProductDetail')],
  ['Supplier profile', 'guest', '/supplier/:slug', '/supplier/beta-traders-873388', page('public/SupplierProfile', 'SupplierProfile')],
  ['Search', 'guest', '/search', '/search?q=cotton', page('public/Search', 'Search')],
  ['AI search', 'guest', '/ai-search', '/ai-search', page('public/AiSearch', 'AiSearch')],
  ['Terms', 'guest', '/terms', '/terms', page('public/Legal', 'Legal')],
  ['Privacy', 'guest', '/privacy', '/privacy', page('public/Legal', 'Legal')],
  ['Help', 'guest', '/help', '/help', page('public/Help', 'Help')],
  ['Not found', 'guest', '*', '/no-such-page', page('public/NotFound', 'NotFound')],
  // Auth
  ['Sign in', 'guest', '/signin', '/signin', page('auth/SignIn', 'SignIn')],
  ['Staff sign in', 'guest', '/signin/staff', '/signin/staff', page('auth/StaffSignIn', 'StaffSignIn')],
  ['Forgot password', 'guest', '/forgot', '/forgot', page('auth/Forgot', 'Forgot')],
  ['Reset password', 'guest', '/reset', '/reset', page('auth/Reset', 'Reset'), { portal: 'buyer', identifier: 'nikita@example.com' }],
  ['Sign-in code', 'guest', '/otp', '/otp', page('auth/Otp', 'Otp'), LOGIN_FLOW],
  ['Signup — verify both codes', 'guest', '/signup/verify', '/signup/verify', page('auth/SignupVerify', 'SignupVerify'), SIGNUP_FLOW],
  ['Signup — company step', 'guest', '/signup/company', '/signup/company', page('auth/SignupCompany', 'SignupCompany'), { ...SIGNUP_FLOW, verified: { email: true, mobile: true } }],
  ['Buyer signup', 'guest', '/signup/buyer', '/signup/buyer', page('auth/BuyerSignup', 'BuyerSignup')],
  ['Exporter signup', 'guest', '/signup/exporter', '/signup/exporter', page('auth/ExporterSignup', 'ExporterSignup')],
  ['Change password', 'buyer', '/change-password', '/change-password', page('auth/ChangePassword', 'ChangePassword')],
  // Buyer
  ['Buyer verification', 'buyer', '/buyer/verification', '/buyer/verification', page('buyer/VerificationStatus', 'VerificationStatus')],
  ['Buyer KYC', 'buyer', '/buyer/kyc', '/buyer/kyc', page('buyer/KycUpload', 'KycUpload')],
  ['Buyer company', 'buyer', '/buyer/company', '/buyer/company', page('account/CompanyProfile', 'CompanyProfile')],
  ['Saved items', 'buyer', '/saved', '/saved', page('buyer/SavedItems', 'SavedItems')],
  ['Buyer chat list', 'buyer', '/buyer/chat', '/buyer/chat', page('chat/ChatInbox', 'ChatInbox')],
  ['Buyer chat thread', 'buyer', '/buyer/chat/:id', `/buyer/chat/${IDS.buyerConv}`, page('chat/ChatInbox', 'ChatInbox')],
  ['Buyer support', 'buyer', '/buyer/support', '/buyer/support', page('support/MySupport', 'MySupport')],
  ['Buyer ticket', 'buyer', '/buyer/support/:id', `/buyer/support/${IDS.buyerTicket}`, page('support/MyTicket', 'MyTicket')],
  ['Find a supplier', 'buyer', '/buyer/find-supplier', '/buyer/find-supplier', page('support/FindSupplier', 'FindSupplier')],
  ['Buyer notifications', 'buyer', '/buyer/notifications', '/buyer/notifications', page('notifications/Notifications', 'Notifications')],
  // Exporter
  ['Exporter dashboard', 'exporter', '/exporter/dashboard', '/exporter/dashboard', page('exporter/Dashboard', 'Dashboard')],
  ['Exporter verification', 'exporter', '/exporter/verification', '/exporter/verification', page('exporter/VerificationStatus', 'VerificationStatus')],
  ['Exporter KYC', 'exporter', '/exporter/kyc', '/exporter/kyc', page('exporter/KycUpload', 'KycUpload')],
  ['Exporter company', 'exporter', '/exporter/company', '/exporter/company', page('account/CompanyProfile', 'CompanyProfile')],
  ['My products', 'exporter', '/exporter/products', '/exporter/products', page('exporter/Products', 'Products')],
  ['New product', 'exporter', '/exporter/products/new', '/exporter/products/new', page('exporter/ProductForm', 'ProductForm')],
  ['Edit product', 'exporter', '/exporter/products/:id/edit', `/exporter/products/${IDS.product}/edit`, page('exporter/ProductForm', 'ProductForm')],
  ['Exporter chat list', 'exporter', '/exporter/chat', '/exporter/chat', page('chat/ChatInbox', 'ChatInbox')],
  ['Exporter chat thread', 'exporter', '/exporter/chat/:id', `/exporter/chat/${IDS.conv}`, page('chat/ChatInbox', 'ChatInbox')],
  ['Exporter support', 'exporter', '/exporter/support', '/exporter/support', page('support/MySupport', 'MySupport')],
  ['Exporter notifications', 'exporter', '/exporter/notifications', '/exporter/notifications', page('notifications/Notifications', 'Notifications')],
  ['Quotation builder', 'exporter', '/exporter/quotations/:id', `/exporter/quotations/${QUOTE}`, page('exporter/QuotationBuilder', 'QuotationBuilder')],
  ['Quotation document', 'exporter', '/quotations/:id', `/quotations/${QUOTE}`, page('QuotationView', 'QuotationView')],
  ['Chat thread with a quotation', 'exporter', '/exporter/chat/:id', `/exporter/chat/${IDS.buyerConv}`, page('chat/ChatInbox', 'ChatInbox')],
  // Console as an employee with limited permissions (/staff).
  ['Staff dashboard (employee)', 'employee', '/staff/dashboard', '/staff/dashboard', page('admin/Dashboard', 'Dashboard')],
  ['Support queue (employee, own only)', 'employee', '/staff/support', '/staff/support', page('admin/Support', 'Support')],
  ['Support ticket (employee)', 'employee', '/staff/support/:id', `/staff/support/${IDS.staffTicket}`, page('admin/SupportTicket', 'SupportTicket')],
  ['Reports (employee)', 'employee', '/staff/reports', '/staff/reports', page('admin/Reports', 'Reports')],
  ['My account (employee)', 'employee', '/staff/account', '/staff/account', page('admin/Account', 'Account')],
  ['Notifications (employee)', 'employee', '/staff/notifications', '/staff/notifications', page('notifications/Notifications', 'Notifications')],
  ['No access', 'employee', '/staff/no-access', '/staff/no-access', page('admin/ComingSoon', 'NoAccess')],
  ['Coming soon', 'superadmin', '/admin/x', '/admin/x', page('admin/ComingSoon', 'ComingSoon')],
  ['Landing (alternate)', 'guest', '/landing-blue', '/landing-blue', page('public/LandingBlue', 'LandingBlue')],
  ['Styleguide (dev only)', 'guest', '/styleguide', '/styleguide', page('Styleguide', 'Styleguide')],
  // Console (super admin)
  ['Admin dashboard', 'superadmin', '/admin/dashboard', '/admin/dashboard', page('admin/Dashboard', 'Dashboard')],
  ['Organisations', 'superadmin', '/admin/organisations', '/admin/organisations', page('admin/Organisations', 'Organisations')],
  ['Organisation detail', 'superadmin', '/admin/organisations/:id', `/admin/organisations/${IDS.beta}`, page('admin/OrganisationDetail', 'OrganisationDetail')],
  ['Users', 'superadmin', '/admin/users', '/admin/users', page('admin/Users', 'Users')],
  ['Categories (admin)', 'superadmin', '/admin/categories', '/admin/categories', page('admin/CategoryManager', 'CategoryManager')],
  ['Category fields', 'superadmin', '/admin/categories/:id/attributes', `/admin/categories/${IDS.leaf}/attributes`, page('admin/AttributeManager', 'AttributeManager')],
  ['Products (admin)', 'superadmin', '/admin/products', '/admin/products', page('admin/ProductMonitoring', 'ProductMonitoring')],
  ['Verification queue', 'superadmin', '/admin/verification', '/admin/verification', page('admin/VerificationQueue', 'VerificationQueue')],
  ['KYC viewer', 'superadmin', '/admin/verification/:orgId/kyc', `/admin/verification/${IDS.beta}/kyc`, page('admin/KycViewer', 'KycViewer')],
  ['Conversations', 'superadmin', '/admin/conversations', '/admin/conversations', page('admin/Conversations', 'Conversations')],
  ['Conversation viewer', 'superadmin', '/admin/conversations/:id', `/admin/conversations/${IDS.conv}`, page('admin/ConversationViewer', 'ConversationViewer')],
  ['Support (admin)', 'superadmin', '/admin/support', '/admin/support', page('admin/Support', 'Support')],
  ['Support ticket (admin)', 'superadmin', '/admin/support/:id', `/admin/support/${IDS.staffTicket}`, page('admin/SupportTicket', 'SupportTicket')],
  ['Supplier requests', 'superadmin', '/admin/leads', '/admin/leads', page('admin/Leads', 'Leads')],
  ['Supplier request', 'superadmin', '/admin/leads/:id', `/admin/leads/${IDS.lead}`, page('admin/LeadDetail', 'LeadDetail')],
  ['Reports', 'superadmin', '/admin/reports', '/admin/reports', page('admin/Reports', 'Reports')],
  ['Audit log', 'superadmin', '/admin/audit', '/admin/audit', page('admin/AuditLog', 'AuditLog')],
  ['Error log', 'superadmin', '/admin/errors', '/admin/errors', page('admin/ErrorLog', 'ErrorLog')],
  ['Featured', 'superadmin', '/admin/featured', '/admin/featured', page('admin/Featured', 'Featured')],
  ['My account (staff)', 'superadmin', '/admin/account', '/admin/account', page('admin/Account', 'Account')],
  ['Staff notifications', 'superadmin', '/admin/notifications', '/admin/notifications', page('notifications/Notifications', 'Notifications')],
  ['Staff (employees)', 'superadmin', '/admin/staff', '/admin/staff', page('admin/Employees', 'Employees')],
  ['Platform settings', 'superadmin', '/admin/settings', '/admin/settings', page('admin/Settings', 'Settings')],
];

// React Router v7 notices are advice, not errors.
const IGNORED = [/React Router Future Flag Warning/];
let consoleErrors = [];
beforeEach(() => {
  consoleErrors = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    const text = args.map(String).join(' ');
    if (!IGNORED.some((re) => re.test(text))) consoleErrors.push(text.slice(0, 300));
  });
});
afterEach(() => vi.restoreAllMocks());

describe('every page renders on real data', () => {
  it.each(PAGES)('%s', async (_label, role, pattern, url, load, state) => {
    auth.user = USERS[role];
    fakeApi.as(role);
    // Not recorded on purpose (the recorder skips /auth/*): hand-written.
    fakeApi.on('GET', '/auth/me', { user: { ...USERS[role], memberSince: '2026-08-01T10:00:00.000Z', lastLoginAt: '2026-09-25T09:30:00.000Z' } });
    fakeApi.on('POST', '/auth/signup/organisation', { organisations: [] });
    const Page = await load();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[{ pathname: url.split('?')[0], search: url.includes('?') ? `?${url.split('?')[1]}` : '', state }]}>
          <ChatDockProvider>
            <Routes>
              <Route path={pattern} element={<Page />} />
              <Route path="*" element={<p>Redirected away</p>} />
            </Routes>
          </ChatDockProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Let every query resolve and the page settle.
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40));
      });
    }

    expect(screen.queryByText('Redirected away'), 'page bounced to another route').toBeNull();
    expect(document.body.textContent.trim().length, 'page rendered nothing').toBeGreaterThan(20);
    // The styleguide shows the error box on purpose, as a sample.
    if (!_label.startsWith('Styleguide')) expect(screen.queryByText("We couldn't load this"), 'error box shown').toBeNull();
    expect(fakeApi.misses, 'requests the recording cannot answer').toEqual([]);
    expect(consoleErrors, 'React errors').toEqual([]);
  });
});
