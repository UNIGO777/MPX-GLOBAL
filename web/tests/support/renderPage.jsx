import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { ChatDockProvider } from '../../src/chat/ChatDockContext.jsx';
import { fakeApi } from './fakeApi.js';

/** The signed-in people the recordings were made as (tests/fixtures/recorded.json). */
export const IDS = {
  beta: '6ab3fa2261a10d563d5cd903',
  delta: '6ab3ff4853c66bbe08c87832',
  product: '6ab4122cda7bcd5fad8b2b9e',
  leaf: '6ab3f9ceea23c9777a40ec3c',
  conv: '6ab41c41fb0608c385b05ed3',
  buyerConv: '6ab4ff1a86dc6e9cb2c8b417',
  lead: '6ab4ff0686dc6e9cb2c8b412',
  buyerTicket: '6ab4ef328bd8b4e3136d61ab',
  staffTicket: '6ab50f6301c1ac72fe8b3902',
  quote: '6ab650b4f8c4aabfa62c9cdb',
};

export const USERS = {
  guest: null,
  buyer: { id: 'u-buyer', name: 'Nikita Rao', email: 'ucm_192532@example.com', role: 'buyer', orgId: IDS.delta, permissions: [] },
  exporter: { id: 'u-exporter', name: 'Priya Picker', email: 'uia_873388@example.com', role: 'exporter', orgId: IDS.beta, permissions: [] },
  superadmin: { id: 'u-admin', name: 'Local Admin', email: 'localadmin@example.com', role: 'superadmin', orgId: null, permissions: [] },
  employee: { id: 'u-asha', name: 'Asha Menon', email: 'walk.staff.025633@example.com', role: 'employee', orgId: null, permissions: ['support:read', 'support:reply', 'support:status'] },
};

/** Let queries resolve and effects settle. */
export async function settle(rounds = 6) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
  }
}

/**
 * Render one page the way the app would: as `role` (the caller's AuthContext
 * mock reads `auth.user`), on that role's recorded data, at `url` matched by
 * `pattern`, with optional router `state`. Anything the page navigates to
 * renders "Went to <path>", so a test can assert where it went.
 */
export async function renderPage(Page, { auth, role = 'guest', url = '/', pattern, state, user } = {}) {
  if (auth) auth.user = user ?? USERS[role];
  fakeApi.as(role);
  const [pathname, search = ''] = url.split('?');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname, search: search ? `?${search}` : '', state }]}>
        <ChatDockProvider>
          <Routes>
            <Route path={pattern ?? pathname} element={<Page />} />
            <Route path="*" element={<Went />} />
          </Routes>
        </ChatDockProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await settle();
  return { ...utils, client };
}

function Went() {
  const { pathname } = useLocation();
  return <p data-testid="went">Went to {pathname}</p>;
}

/** Writes the page sent, newest last: [{ method, path, data }]. */
export const writes = (method, path) =>
  fakeApi.calls.filter((c) => c.method === method && (path instanceof RegExp ? path.test(c.path) : c.path === path));

const PAGE_MODULES = import.meta.glob('../../src/pages/**/*.jsx');

/** `loadPage('support/MyTicket', 'MyTicket')` → the component. */
export async function loadPage(file, name) {
  const mod = PAGE_MODULES[`../../src/pages/${file}.jsx`];
  if (!mod) throw new Error(`no page ${file}`);
  return (await mod())[name];
}
