import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * Party sign-in (A21): the chosen PORTAL travels with the credentials, and any
 * refusal reads as the same generic "Invalid credentials" the server sends — the
 * screen never hints that the account exists on the other portal.
 */
const api = vi.hoisted(() => ({ impl: async () => ({}), calls: [] }));
vi.mock('../../src/api/auth.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    authApi: {
      ...real.authApi,
      login: (args) => {
        api.calls.push(args);
        return api.impl(args);
      },
    },
  };
});
vi.mock('../../src/auth/AuthContext.jsx', () => ({ useAuth: () => ({ sessionNote: null }) }));
vi.mock('../../src/layouts/AuthLayout.jsx', () => ({ AuthLayout: ({ children }) => <div>{children}</div> }));

const { SignIn } = await import('../../src/pages/auth/SignIn.jsx');

function app() {
  return render(
    <MemoryRouter initialEntries={['/signin']}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/otp" element={<p>Enter the code</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fill(user, { identifier = 'buyer@example.com', password = 'longpassword1' } = {}) {
  await user.type(screen.getByLabelText('Email or mobile'), identifier);
  await user.type(screen.getByPlaceholderText('••••••••••'), password);
}

beforeEach(() => {
  api.calls = [];
  api.impl = async () => ({ loginToken: 't', method: 'otp', sentTo: '+91 ••••• 3210' });
});

describe('Sign in', () => {
  it('asks for both fields before calling the server', async () => {
    const user = userEvent.setup();
    app();
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText('Enter your email or mobile, and your password.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('sends the chosen portal — buyer by default, exporter when picked', async () => {
    const user = userEvent.setup();
    app();
    await user.click(screen.getByRole('radio', { name: 'Exporter' }));
    await fill(user, { identifier: '  seller@example.com ' });
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(api.calls[0]).toEqual({ identifier: 'seller@example.com', password: 'longpassword1', portal: 'exporter' });
    expect(await screen.findByText('Enter the code')).toBeTruthy();
  });

  it('shows the server\'s generic refusal and stays on the page', async () => {
    const user = userEvent.setup();
    const refusal = Object.assign(new Error('401'), {
      response: { status: 401, data: { error: { message: 'Invalid credentials.' } } },
    });
    api.impl = async () => {
      throw refusal;
    };
    app();
    await fill(user);
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText('Invalid credentials.')).toBeTruthy();
    expect(screen.queryByText('Enter the code')).toBeNull();
  });
});
