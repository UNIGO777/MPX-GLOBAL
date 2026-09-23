import { apiClient } from './client.js';

/**
 * Auth endpoints — field names exactly as the backend validators declare them
 * (`MPX-BACKEND-FULL-SAAS/src/validators/auth.validators.js`). Kept in step with
 * `web/src/api/auth.js` so the two clients cannot drift.
 *
 * §A21 — buyer and exporter are separate accounts on separate portals, so every
 * party endpoint carries a `portal` ('buyer' | 'exporter'). The same email may
 * hold one of each.
 *
 * There is no staff login in the app, by design: the employee and superadmin
 * panels are web-only, and the app must not even hint at internal tooling. The
 * staff endpoints are therefore absent from this module, not just unused.
 */
export const authApi = {
  // --- signup (A21: two steps, BOTH channels verified before an account exists)
  //
  // The old one-shot `/auth/buyer/signup` is gone: it created the account before
  // anyone proved they owned the email or the phone, which let a stranger's
  // address be permanently taken (both are uniquely indexed per role). Nothing
  // is created until `signupComplete`.
  //
  // start → { signupToken, email, mobile (both MASKED), emailVerified, mobileVerified }
  signupStart: ({ name, email, mobile, password, role }) =>
    apiClient.post('/auth/signup/start', { name, email, mobile, password, role }).then((r) => r.data),
  // Order-agnostic on the server; the screens run email then phone.
  signupVerify: ({ signupToken, channel, code }) =>
    apiClient.post('/auth/signup/verify', { signupToken, channel, code }).then((r) => r.data),
  signupResend: ({ signupToken, channel }) =>
    apiClient.post('/auth/signup/resend', { signupToken, channel }).then((r) => r.data),
  // The only call that creates anything — and the only one that returns a session.
  /**
   * D7 · A21 step 2 — the claim offer. Asked once after both OTPs pass; `[]`
   * when there is nothing to join.
   *
   * 🔴 Each row carries an OPAQUE `choice`. The client never holds an org id and
   * never names a target — the server resolves the choice against the offer it
   * stored and re-checks eligibility on every call.
   */
  signupClaimOffer: ({ signupToken }) =>
    apiClient.post('/auth/signup/organisation', { signupToken }).then((r) => r.data.organisations),

  /**
   * Rule 6 · send the code to the member ALREADY in the company. It lands in a
   * THIRD PARTY's inbox, resolved server-side from the org — never an address
   * the app supplies. Returns the masked `sentTo`.
   */
  signupClaimCode: ({ signupToken, choice }) =>
    apiClient.post('/auth/signup/organisation/code', { signupToken, choice }).then((r) => r.data),

  /** Rule 6 · verify it. On success the offers come back WITH the company name. */
  signupClaimVerify: ({ signupToken, choice, code }) =>
    apiClient
      .post('/auth/signup/organisation/verify', { signupToken, choice, code })
      .then((r) => r.data.organisations),

  signupComplete: ({ signupToken, company, country, entityType, address, claimChoice }) =>
    apiClient
      .post('/auth/signup/complete', {
        signupToken,
        company,
        country,
        entityType,
        address,
        // Omitted entirely when creating — the server's schema rejects unknown
        // keys, and `undefined` would still serialise the key away, but being
        // explicit keeps the create and join payloads visibly different.
        ...(claimChoice ? { claimChoice } : {}),
      })
      .then((r) => r.data),

  // --- login → OTP → tokens -------------------------------------------------
  login: ({ identifier, password, portal }) =>
    apiClient.post('/auth/login', { identifier, password, portal }).then((r) => r.data),
  verifyOtp: ({ loginToken, code }) =>
    apiClient.post('/auth/verify-otp', { loginToken, code }).then((r) => r.data),
  // `channel: 'email'` — no phone to hand (owner, 2026-09-23). Picks one of the
  // account's OWN addresses; the server resolves it, never the request.
  resendOtp: ({ loginToken, channel }) =>
    apiClient
      .post('/auth/resend-otp', { loginToken, ...(channel ? { channel } : {}) })
      .then((r) => r.data),

  // --- session --------------------------------------------------------------
  me: () => apiClient.get('/auth/me').then((r) => r.data.user),
  logout: ({ refreshToken }) => apiClient.post('/auth/logout', { refreshToken }).then((r) => r.data),
  changePassword: ({ currentPassword, newPassword }) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),

  // --- password reset -------------------------------------------------------
  forgotPassword: ({ identifier, portal, channel }) =>
    apiClient
      .post('/auth/forgot-password', { identifier, portal, ...(channel ? { channel } : {}) })
      .then((r) => r.data),
  resetPassword: ({ identifier, code, newPassword, portal }) =>
    apiClient.post('/auth/reset-password', { identifier, code, newPassword, portal }).then((r) => r.data),
};
