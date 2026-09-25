import axios from 'axios';

import recorded from '../fixtures/recorded.json';

/**
 * A stand-in for `src/api/client.js` (wired in tests/setup.js).
 *
 * GETs are answered from `tests/fixtures/recorded.json` — real responses
 * recorded from the running app against the local TEST database on 2026-09-25
 * (signed file URLs replaced with placeholders; no tokens, passwords or codes).
 * A test can add or override answers with `fakeApi.on(method, path, reply)`.
 * Writes (POST/PATCH/PUT/DELETE) are recorded and answered with `{}` unless
 * overridden. Every GET the fixtures cannot answer is listed in `misses`.
 */
export const fakeApi = {
  // Recorded per viewer: the same endpoint answers a super admin, an employee
  // and a company differently, so each role replays its own recording.
  byRole: recorded.byRole,
  role: 'guest',
  overrides: [],
  calls: [],
  misses: [],
  /** Replay as this viewer: 'guest' | 'buyer' | 'exporter' | 'employee' | 'superadmin'. */
  as(role) {
    this.role = role ?? 'guest';
  },
  reset() {
    this.role = 'guest';
    this.overrides = [];
    this.calls = [];
    this.misses = [];
  },
  /** `reply` is a body, or `(req) => body`; throw an axios-shaped error to fail. */
  on(method, path, reply) {
    this.overrides.unshift({ method: method.toUpperCase(), path, reply });
  },
};

/** The same key the recorder wrote: `GET /path?a=1&b=2`, query sorted. */
export function keyFor(method, url, params) {
  const full = axios.getUri({ url, params });
  const qi = full.indexOf('?');
  const path = qi < 0 ? full : full.slice(0, qi);
  const query =
    qi < 0
      ? ''
      : [...new URLSearchParams(full.slice(qi + 1)).entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('&');
  return { key: `${method} ${path}${query ? `?${query}` : ''}`, path };
}

function httpError(status, body) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: body },
    isAxiosError: true,
  });
}

async function answer(method, url, config = {}, data) {
  const { key, path } = keyFor(method, url, config.params);
  fakeApi.calls.push({ method, path, key, data });
  const override = fakeApi.overrides.find(
    (o) => o.method === method && (o.path instanceof RegExp ? o.path.test(path) : o.path === path),
  );
  if (override) {
    const body = typeof override.reply === 'function' ? await override.reply({ path, key, data, params: config.params }) : override.reply;
    return { status: 200, data: body };
  }
  if (method !== 'GET') return { status: 200, data: {} };
  // This viewer's recording first, then the signed-out one (public data), exact
  // query first, then the same path with any query.
  const sources = [fakeApi.byRole[fakeApi.role] ?? {}, fakeApi.byRole.guest ?? {}];
  let hit;
  for (const src of sources) hit ??= src[key];
  for (const src of sources) hit ??= Object.entries(src).find(([k]) => k.split('?')[0] === `GET ${path}`)?.[1];
  if (!hit) {
    fakeApi.misses.push(key);
    throw httpError(404, { error: { message: 'Not found.' } });
  }
  if (hit.status >= 400) throw httpError(hit.status, hit.body);
  return { status: hit.status, data: structuredClone(hit.body) };
}

export const fakeClient = {
  defaults: { baseURL: '/api', headers: {} },
  interceptors: { request: { use() {} }, response: { use() {} } },
  get: (url, config) => answer('GET', url, config),
  delete: (url, config) => answer('DELETE', url, config),
  post: (url, data, config) => answer('POST', url, config, data),
  patch: (url, data, config) => answer('PATCH', url, config, data),
  put: (url, data, config) => answer('PUT', url, config, data),
};
