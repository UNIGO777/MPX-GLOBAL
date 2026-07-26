import { describe, it, expect } from 'vitest';
import express from 'express';

import { createApp } from '../src/app.js';
import { assertRoutesGuarded, publicRoute } from '../src/config/routeGuard.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { requirePermissions } from '../src/middleware/authorize.js';

describe('startup route access-control check (A5)', () => {
  it('the real app passes — every route is declared', () => {
    expect(() => createApp()).not.toThrow();
  });

  it('refuses a route with NO public/auth/permission declaration', () => {
    const app = express();
    app.post('/danger/unguarded', (_req, res) => res.json({}));
    expect(() => assertRoutesGuarded(app)).toThrow(/danger\/unguarded/);
  });

  it('accepts an explicitly public route', () => {
    const app = express();
    app.get('/open', publicRoute, (_req, res) => res.json({}));
    expect(() => assertRoutesGuarded(app)).not.toThrow();
  });

  it('accepts an authenticated / permissioned route', () => {
    const app = express();
    app.get('/me', authenticate, (_req, res) => res.json({}));
    app.post('/admin', authenticate, requirePermissions('x:do'), (_req, res) => res.json({}));
    expect(() => assertRoutesGuarded(app)).not.toThrow();
  });
});
