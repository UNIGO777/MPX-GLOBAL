import { apiClient } from './client.js';

/**
 * Auth endpoints — field names exactly as the backend validators declare them
 * (auth.validators.js). Party endpoints carry a `portal`; staff endpoints never
 * do (A21: a staff email is exclusive).
 */
export const authApi = {
  // --- signup (A21: two steps, BOTH channels verified before an account exists)
  //
  // The old one-shot `/auth/buyer/signup` is gone. It created the account before
  // anyone proved they owned the email or the phone, which let a stranger's
  // address be permanently taken. Nothing is created now until `signupComplete`.
  //
  // start → { signupToken, email, mobile (both MASKED), emailVerified, mobileVerified }
  signupStart: ({ name, email, mobile, password, role }) =>
    apiClient.post('/auth/signup/start', { name, email, mobile, password, role }).then((r) => r.data),
  // Order-agnostic on the server; the screens run email then mobile.
  signupVerify: ({ signupToken, channel, code }) =>
    apiClient.post('/auth/signup/verify', { signupToken, channel, code }).then((r) => r.data),
  signupResend: ({ signupToken, channel }) =>
    apiClient.post('/auth/signup/resend', { signupToken, channel }).then((r) => r.data),
  // The only call that creates anything — and the only one that returns a session.
  signupComplete: ({ signupToken, company, country, entityType, address }) =>
    apiClient
      .post('/auth/signup/complete', { signupToken, company, country, entityType, address })
      .then((r) => r.data),

  // --- login → OTP → tokens -------------------------------------------------
  login: ({ identifier, password, portal }) =>
    apiClient.post('/auth/login', { identifier, password, portal }).then((r) => r.data),
  staffLogin: ({ identifier, password }) =>
    apiClient.post('/auth/staff/login', { identifier, password }).then((r) => r.data),
  verifyOtp: ({ loginToken, code }) =>
    apiClient.post('/auth/verify-otp', { loginToken, code }).then((r) => r.data),
  resendOtp: ({ loginToken }) =>
    apiClient.post('/auth/resend-otp', { loginToken }).then((r) => r.data),

  // --- session --------------------------------------------------------------
  me: () => apiClient.get('/auth/me').then((r) => r.data.user),
  logout: ({ refreshToken }) => apiClient.post('/auth/logout', { refreshToken }).then((r) => r.data),
  changePassword: ({ currentPassword, newPassword }) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),

  // --- password reset (party carries portal; staff pair does not) -----------
  forgotPassword: ({ identifier, portal }) =>
    apiClient.post('/auth/forgot-password', { identifier, portal }).then((r) => r.data),
  resetPassword: ({ identifier, code, newPassword, portal }) =>
    apiClient.post('/auth/reset-password', { identifier, code, newPassword, portal }).then((r) => r.data),
  staffForgotPassword: ({ identifier }) =>
    apiClient.post('/auth/staff/forgot-password', { identifier }).then((r) => r.data),
  staffResetPassword: ({ identifier, code, newPassword }) =>
    apiClient.post('/auth/staff/reset-password', { identifier, code, newPassword }).then((r) => r.data),
};
