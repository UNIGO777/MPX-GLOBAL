import { logger } from '../utils/logger.js';

// Explicit "this route is intentionally public" marker (no auth). Anything that
// is neither public nor access-controlled is treated as a developer mistake.
export function publicRoute(_req, _res, next) {
  next();
}
publicRoute.__public = true;

// A handler counts as an access-control declaration if it is the public marker,
// the authenticate middleware (__auth), or a permission guard (__rbac).
function isDeclared(handler) {
  return Boolean(handler && (handler.__public || handler.__auth || handler.__rbac));
}

function walk(stack, out) {
  for (const layer of stack) {
    if (layer.route) {
      const handlers = layer.route.stack.map((l) => l.handle);
      out.push({
        methods: Object.keys(layer.route.methods).map((m) => m.toUpperCase()),
        path: layer.route.path,
        declared: handlers.some(isDeclared),
      });
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      walk(layer.handle.stack, out); // nested router
    }
  }
}

// Startup guarantee (auth-sessions A5): every route must EITHER be explicitly
// public, or carry authentication / a permission guard. A route that declares
// nothing is refused at boot — the server does not start and names the route,
// so the mistake is caught before deploy, never served unprotected.
//
// Limitation: this proves access control EXISTS and public is intentional; it
// does not verify the *correct* permission is on each route (that's code review).
export function assertRoutesGuarded(app) {
  const stack = app.router?.stack ?? app._router?.stack ?? [];
  const routes = [];
  walk(stack, routes);

  const undeclared = routes.filter((r) => !r.declared);
  if (undeclared.length > 0) {
    const list = undeclared.map((r) => `${r.methods.join(',')} ${r.path}`).join('; ');
    throw new Error(
      `Route access-control check failed — declare publicRoute or a permission guard on: ${list}`,
    );
  }
  logger.info({ routes: routes.length }, 'route access-control check passed');
}
