import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

import { fakeApi, fakeClient } from './support/fakeApi.js';

// Every web test talks to the fake API client (tests/support/fakeApi.js) —
// never to a network. Tests that mock an api module directly still work: they
// replace the layer above this one.
vi.mock('../src/api/client.js', () => ({
  apiClient: fakeClient,
  refreshSession: async () => null,
}));

// The chat socket: an inert emitter. Nothing connects; handlers are kept so a
// test could fire a server event if it needed to.
vi.mock('socket.io-client', () => {
  const make = () => {
    const handlers = new Map();
    const s = {
      connected: false,
      auth: {},
      io: { on() {}, off() {} },
      on(ev, fn) { (handlers.get(ev) ?? handlers.set(ev, new Set()).get(ev)).add(fn); return s; },
      off(ev, fn) { handlers.get(ev)?.delete(fn); return s; },
      once(ev, fn) { return s.on(ev, fn); },
      emit(ev, payload, ack) { if (typeof ack === 'function') ack({ ok: true }); return s; },
      timeout() { return s; },
      connect() { return s; },
      disconnect() { return s; },
      removeAllListeners() { handlers.clear(); return s; },
    };
    return s;
  };
  return { io: make, default: make };
});

// jsdom lacks these browser APIs; the app uses them for layout and animation.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
}
class NoopObserver { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
window.IntersectionObserver ??= NoopObserver;
window.ResizeObserver ??= NoopObserver;
window.scrollTo = () => {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
Element.prototype.scrollTo ??= function scrollTo() {};
URL.createObjectURL ??= () => 'blob:fake';
URL.revokeObjectURL ??= () => {};

beforeEach(() => fakeApi.reset());
// Unmount whatever a test rendered, so one screen never leaks into the next.
afterEach(() => cleanup());
