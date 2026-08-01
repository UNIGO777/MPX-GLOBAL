import { randomUUID } from 'node:crypto';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { env } from './config/env.js';
import { AppError } from './utils/AppError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rejectMongoOperators } from './middleware/rejectMongoOperators.js';
import { publicRoute, assertRoutesGuarded } from './config/routeGuard.js';
import { authRouter } from './routes/auth.routes.js';
import { employeeRouter } from './routes/employee.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { meRouter } from './routes/me.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { productRouter } from './routes/product.routes.js';
import { savedRouter } from './routes/saved.routes.js';
import { inquiryRouter } from './routes/inquiry.routes.js';
import { conversationRouter } from './routes/conversation.routes.js';

const JSON_BODY_LIMIT = '1mb';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Behind a reverse proxy/load balancer, trust the configured number of hops so
  // req.ip is the real client (correct rate-limit keys) and TLS is detected.
  if (env.TRUST_PROXY !== undefined) app.set('trust proxy', env.TRUST_PROXY);

  // qs-style parsing so nested query filters (e.g. product search) work. Any
  // request carrying a Mongo operator is rejected outright by
  // rejectMongoOperators below — not silently stripped.
  app.set('query parser', 'extended');

  // Assign a request id first so every downstream log line and error response
  // can be correlated. Only honour an inbound id when we sit behind a trusted
  // proxy (TRUST_PROXY set), and only if it's a sane token — otherwise any client
  // could spoof correlation ids. Generate one by default.
  app.use((req, res, next) => {
    const inbound = env.TRUST_PROXY !== undefined ? req.headers['x-request-id'] : undefined;
    const clean = typeof inbound === 'string' ? inbound.trim() : '';
    req.id = /^[A-Za-z0-9._-]{1,128}$/.test(clean) ? clean : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  // This service serves JSON only — no HTML, scripts or embedding. Lock the CSP
  // down accordingly and enforce HSTS for TLS.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'none'"],
        },
      },
      hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: non-browser clients (mobile app, curl, server-to-
        // server). CORS is a browser control, so allow these through — auth is
        // enforced separately on every endpoint.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(AppError.forbidden(`CORS: origin not allowed: ${origin}`, 'Origin not allowed.'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Reject any request whose body/query/params contain a Mongo operator ($…),
  // a dotted key, or a prototype-pollution key. Strict zod validation per route
  // is the second layer.
  app.use(rejectMongoOperators);

  app.get('/health', publicRoute, (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use(authRouter);
  app.use(employeeRouter);
  app.use(adminRouter);
  app.use(meRouter);
  app.use(publicRouter);
  app.use(categoryRouter);
  app.use(productRouter);
  app.use(savedRouter);
  app.use(inquiryRouter);
  app.use(conversationRouter);

  // Any unmatched route becomes a JSON 404 through the central handler.
  app.use((req, _res, next) => {
    next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  // Must be last.
  app.use(errorHandler);

  // Secure-by-default (auth-sessions A5): refuse to start if any route lacks an
  // access-control declaration (publicRoute / authenticate / permission guard).
  assertRoutesGuarded(app);

  return app;
}
