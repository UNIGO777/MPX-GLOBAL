import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * Buyer signup step 1 (A21): identity only, checked before any server call; the
 * account is NOT created here — the server only starts a pending signup and the
 * next screen verifies both email and mobile.
 */
const api = vi.hoisted(() => ({ impl: async () => ({}), calls: [] }));
vi.mock('../../src/api/auth.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    authApi: {
      ...real.authApi,
      signupStart: (args) => {
        api.calls.push(args);
        return api.impl(args);
      },
    },
  };
});
vi.mock('../../src/layouts/AuthLayout.jsx', () => ({ AuthLayout: ({ children }) => <div>{children}</div> }));

const { BuyerSignup } = await import('../../src/pages/auth/BuyerSignup.jsx');

function app() {
  return render(
    <MemoryRouter initialEntries={['/signup/buyer']}>
      <Routes>
        <Route path="/signup/buyer" element={<BuyerSignup />} />
        <Route path="/signup/verify" element={<p>Verify both codes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fill(user, { password = 'longpassword1', confirm = password } = {}) {
  await user.type(screen.getByLabelText('Full name'), ' Nikita Rao ');
  await user.type(screen.getByLabelText('Email'), 'nikita@example.com');
  await user.type(screen.getByPlaceholderText('Number'), '98765 43210');
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
}

beforeEach(() => {
  api.calls = [];
  api.impl = async () => ({ signupToken: 'st', email: 'n••••@example.com', mobile: '+91 ••••• 3210' });
});

describe('Buyer signup — step 1', () => {
  it('checks every field before calling the server', async () => {
    const user = userEvent.setup();
    app();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter your full name.')).toBeTruthy();
    expect(screen.getByText('Enter your work email.')).toBeTruthy();
    expect(screen.getByText('Enter your mobile number.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('refuses mismatched passwords', async () => {
    const user = userEvent.setup();
    app();
    await fill(user, { password: 'longpassword1', confirm: 'longpassword2' });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('sends trimmed identity as a BUYER (no company yet) and moves to verification', async () => {
    const user = userEvent.setup();
    app();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(api.calls[0]).toEqual({
      name: 'Nikita Rao',
      email: 'nikita@example.com',
      mobile: { countryCode: '+91', number: '9876543210' },
      password: 'longpassword1',
      role: 'buyer',
    });
    expect(await screen.findByText('Verify both codes')).toBeTruthy();
  });

  it('an address already in use: the server\'s message plus "Sign in instead"', async () => {
    const user = userEvent.setup();
    const taken = Object.assign(new Error('409'), {
      response: { status: 409, data: { error: { message: 'An account with this email already exists.' } } },
    });
    api.impl = async () => {
      throw taken;
    };
    app();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/already exists/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toBeTruthy();
  });
});
