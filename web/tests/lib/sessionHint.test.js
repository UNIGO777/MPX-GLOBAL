import { describe, it, expect, beforeEach, vi } from 'vitest';

import { markSignedIn, markSignedOut, shouldTryRestore } from '../../src/auth/sessionHint.js';

describe('session hint — skips the refresh probe only for a known signed-out browser', () => {
  beforeEach(() => window.localStorage.clear());

  it('no hint (first visit, or a session from before the hint existed) → still tries', () => {
    expect(shouldTryRestore()).toBe(true);
  });

  it('signed out → skips; signed in again → tries', () => {
    markSignedOut();
    expect(shouldTryRestore()).toBe(false);
    markSignedIn();
    expect(shouldTryRestore()).toBe(true);
  });

  it('stores a bare flag — never a token, id or role', () => {
    markSignedIn();
    expect(Object.keys(window.localStorage)).toEqual(['mpx_session_hint']);
    expect(window.localStorage.getItem('mpx_session_hint')).toBe('1');
  });

  it('blocked storage → falls back to trying, never throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(shouldTryRestore()).toBe(true);
    spy.mockRestore();
  });
});
