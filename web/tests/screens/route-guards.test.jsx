import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const auth = vi.hoisted(() => ({ value: { user: null, restoring: false } }));
vi.mock('../../src/auth/AuthContext.jsx', () => ({ useAuth: () => auth.value }));

const { RequireAuth } = await import('../../src/auth/RequireAuth.jsx');
const { RequireRole } = await import('../../src/auth/RequireRole.jsx');

/** Route guards are UX, not security (the server checks every call) — but a
 *  wrong redirect strands people, so the paths are pinned here. */
function app(start) {
  return render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/signin" element={<p>Sign-in page</p>} />
        <Route path="/change-password" element={<p>Set a new password</p>} />
        <Route path="/buyer/verification" element={<p>Buyer home</p>} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireRole roles={['exporter']} />}>
            <Route path="/exporter/products" element={<p>Exporter products</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth / RequireRole', () => {
  it('waits while the session is being restored — no bounce to sign-in', () => {
    auth.value = { user: null, restoring: true };
    app('/exporter/products');
    expect(screen.queryByText('Sign-in page')).toBeNull();
  });

  it('signed out → sign-in', () => {
    auth.value = { user: null, restoring: false };
    app('/exporter/products');
    expect(screen.getByText('Sign-in page')).toBeTruthy();
  });

  it('must change password → the set-password screen, whatever was asked for', () => {
    auth.value = { user: { role: 'exporter', mustChangePassword: true }, restoring: false };
    app('/exporter/products');
    expect(screen.getByText('Set a new password')).toBeTruthy();
  });

  it('wrong role → that person\'s own home', () => {
    auth.value = { user: { role: 'buyer' }, restoring: false };
    app('/exporter/products');
    expect(screen.getByText('Buyer home')).toBeTruthy();
  });

  it('right role → the page', () => {
    auth.value = { user: { role: 'exporter' }, restoring: false };
    app('/exporter/products');
    expect(screen.getByText('Exporter products')).toBeTruthy();
  });
});
