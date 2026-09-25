import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeApi } from '../support/fakeApi.js';
import { renderPage, writes } from '../support/renderPage.jsx';

/**
 * The account flows (A21) end to end on the screen: what each step sends, and
 * where it goes next. The server decides everything; these pin that the
 * screens send the right thing and never leak which accounts exist.
 */
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: auth.user,
    restoring: false,
    sessionNote: null,
    completeSignIn: async (result) => result.user,
    applyNewTokens: () => {},
    signOut: async () => {},
  }),
}));

const load = async (file, name) => (await import(`../../src/pages/auth/${file}.jsx`))[name];
const refusal = (status, message) =>
  Object.assign(new Error(String(status)), { response: { status, data: { error: { message } } } });
const typeCode = async (user, code) => {
  const boxes = screen.getAllByLabelText(/^Digit \d$/);
  await user.click(boxes[0]);
  await user.keyboard(code);
};

describe('Staff sign in', () => {
  it('sends no portal (a staff email is exclusive) and goes to the code screen', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/staff/login', { loginToken: 't', method: 'otp' });
    await renderPage(await load('StaffSignIn', 'StaffSignIn'), { auth, url: '/signin/staff' });
    await user.type(screen.getByLabelText('Email or mobile'), 'asha@mpx.test');
    await user.type(screen.getByPlaceholderText(/•/), 'longpassword1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(writes('POST', '/auth/staff/login')[0].data).toEqual({ identifier: 'asha@mpx.test', password: 'longpassword1' });
    expect(await screen.findByText('Went to /otp')).toBeTruthy();
  });
});

describe('Forgot / reset password', () => {
  it('forgot: sends the identifier and the portal', async () => {
    const user = userEvent.setup();
    await renderPage(await load('Forgot', 'Forgot'), { auth, url: '/forgot', state: { portal: 'exporter' } });
    await user.type(screen.getByLabelText('Email or mobile'), 'seller@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));
    const sent = writes('POST', '/auth/forgot-password')[0].data;
    expect(sent.identifier).toBe('seller@example.com');
    expect(['buyer', 'exporter']).toContain(sent.portal);
  });

  it('forgot for staff uses the staff endpoint', async () => {
    const user = userEvent.setup();
    await renderPage(await load('Forgot', 'Forgot'), { auth, url: '/forgot?staff=1', pattern: '/forgot' });
    await user.type(screen.getByLabelText('Email or mobile'), 'asha@mpx.test');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(writes('POST', '/auth/staff/forgot-password')).toHaveLength(1);
    expect(writes('POST', '/auth/forgot-password')).toHaveLength(0);
  });

  it('reset: refuses a mismatch locally, then sends code + new password with the portal', async () => {
    const user = userEvent.setup();
    await renderPage(await load('Reset', 'Reset'), { auth, url: '/reset', state: { portal: 'buyer', identifier: 'nikita@example.com' } });
    await typeCode(user, '123456');
    await user.type(screen.getByLabelText('New password'), 'brandnewpass1');
    await user.type(screen.getByLabelText('Confirm new password'), 'different123');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(writes('POST', '/auth/reset-password')).toHaveLength(0);

    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'brandnewpass1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() =>
      expect(writes('POST', '/auth/reset-password')[0]?.data).toEqual({
        identifier: 'nikita@example.com',
        code: '123456',
        newPassword: 'brandnewpass1',
        portal: 'buyer',
      }),
    );
    expect(await screen.findByRole('button', { name: 'Go to sign in' })).toBeTruthy();
  });

  it('reset: a wrong code shows the server message and clears the boxes', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/reset-password', () => {
      throw refusal(400, 'Invalid or expired code.');
    });
    await renderPage(await load('Reset', 'Reset'), { auth, url: '/reset', state: { portal: 'buyer', identifier: 'n@example.com' } });
    await typeCode(user, '000000');
    await user.type(screen.getByLabelText('New password'), 'brandnewpass1');
    await user.type(screen.getByLabelText('Confirm new password'), 'brandnewpass1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Invalid or expired code.')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Digit \d$/).every((b) => b.value === '')).toBe(true);
  });
});

describe('Sign-in code (OTP)', () => {
  const FLOW = { loginToken: 'lt', method: 'otp', sentTo: '+91 ••••• 3210', identifier: 'n@example.com', backTo: '/signin' };

  it('without a login in progress it goes back to sign in', async () => {
    await renderPage(await load('Otp', 'Otp'), { auth, url: '/otp' });
    expect(screen.getByText('Went to /signin')).toBeTruthy();
  });

  it('six digits → verified → the buyer lands on their home', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/verify-otp', { user: { id: 'b', role: 'buyer', permissions: [] }, accessToken: 'x' });
    await renderPage(await load('Otp', 'Otp'), { auth, url: '/otp', state: FLOW });
    await typeCode(user, '123456');
    await waitFor(() => expect(writes('POST', '/auth/verify-otp')[0]?.data).toEqual({ loginToken: 'lt', code: '123456' }));
    expect(await screen.findByText('Went to /buyer/verification')).toBeTruthy();
  });

  it('a temporary password sends the person to set a new one first', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/verify-otp', { user: { id: 'e', role: 'employee', permissions: [], mustChangePassword: true } });
    await renderPage(await load('Otp', 'Otp'), { auth, url: '/otp', state: FLOW });
    await typeCode(user, '123456');
    expect(await screen.findByText('Went to /change-password')).toBeTruthy();
  });

  it('a wrong code shows the server message and stays', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/verify-otp', () => {
      throw refusal(401, 'Invalid or expired code.');
    });
    await renderPage(await load('Otp', 'Otp'), { auth, url: '/otp', state: FLOW });
    await typeCode(user, '999999');
    expect(await screen.findByText('Invalid or expired code.')).toBeTruthy();
    expect(screen.queryByTestId('went')).toBeNull();
  });
});

describe('Signup — verify both codes (A21, 2026-08-03)', () => {
  const FLOW = { signupToken: 'st', email: 'n••••@example.com', mobile: '+91 ••••• 3210', role: 'buyer', signupPath: '/signup/buyer' };

  it('email first, then phone, then the company step — each with its own code', async () => {
    const user = userEvent.setup();
    let n = 0;
    fakeApi.on('POST', '/auth/signup/verify', () => {
      n += 1;
      return n === 1 ? { emailVerified: true, mobileVerified: false, complete: false } : { emailVerified: true, mobileVerified: true, complete: true };
    });
    await renderPage(await load('SignupVerify', 'SignupVerify'), { auth, url: '/signup/verify', state: FLOW });
    await typeCode(user, '111111');
    expect(await screen.findByRole('button', { name: 'Verify phone' })).toBeTruthy();
    await typeCode(user, '222222');
    expect(await screen.findByText('Went to /signup/company')).toBeTruthy();
    expect(writes('POST', '/auth/signup/verify').map((c) => [c.data.channel, c.data.code])).toEqual([
      ['email', '111111'],
      ['mobile', '222222'],
    ]);
  });
});

describe('Exporter signup — step 1', () => {
  it('starts an EXPORTER signup with identity only', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/signup/start', { signupToken: 'st', email: 'x', mobile: 'y' });
    await renderPage(await load('ExporterSignup', 'ExporterSignup'), { auth, url: '/signup/exporter' });
    await user.type(screen.getByLabelText('Full name'), 'Priya Picker');
    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByPlaceholderText('Number'), '9876543210');
    await user.type(screen.getByLabelText('Password'), 'longpassword1');
    await user.type(screen.getByLabelText('Confirm password'), 'longpassword1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const sent = writes('POST', '/auth/signup/start')[0].data;
    expect(sent.role).toBe('exporter');
    expect(sent).not.toHaveProperty('company');
    expect(await screen.findByText('Went to /signup/verify')).toBeTruthy();
  });
});

describe('Change password', () => {
  it('refuses a mismatch locally; sends current + new; lands on the role home', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/auth/change-password', { accessToken: 'x' });
    await renderPage(await load('ChangePassword', 'ChangePassword'), {
      auth,
      role: 'employee',
      url: '/change-password',
      user: { id: 'e', role: 'employee', permissions: [], mustChangePassword: true },
    });
    await user.type(screen.getByLabelText('Temporary password'), 'temp-pass-123');
    await user.type(screen.getByLabelText('New password'), 'brandnewpass1');
    await user.type(screen.getByLabelText('Confirm new password'), 'mismatch1234');
    await user.click(screen.getByRole('button', { name: 'Change password and continue' }));
    expect(writes('POST', '/auth/change-password')).toHaveLength(0);

    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'brandnewpass1');
    await user.click(screen.getByRole('button', { name: 'Change password and continue' }));
    await waitFor(() =>
      expect(writes('POST', '/auth/change-password')[0]?.data).toEqual({ currentPassword: 'temp-pass-123', newPassword: 'brandnewpass1' }),
    );
    expect(await screen.findByText('Went to /staff/dashboard')).toBeTruthy();
  });
});
