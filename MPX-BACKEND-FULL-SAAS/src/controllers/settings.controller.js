import * as settingsService from '../services/settings.service.js';

/**
 * D8 · Platform settings (§3.5). Superadmin-only at the route — platform
 * governance is never a grantable employee permission (CLAUDE.md Roles).
 *
 * Thin: validation is the route's zod schema, the rules live in
 * settings.service.js.
 */

// Local, like every other controller here — `clientMeta` is deliberately not a
// shared util in this codebase, and this is not the change that makes it one.
function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function getSettings(req, res) {
  res.json({ settings: await settingsService.getSettings() });
}

export async function updateSettings(req, res) {
  const settings = await settingsService.updateSettings({
    actor: req.user,
    patch: req.body,
    meta: clientMeta(req),
  });
  res.json({ settings });
}

/** Public: the support contact + the company footer block — published copy only. */
export async function getSupportContact(req, res) {
  const [support, company] = await Promise.all([
    settingsService.getSupportContact(),
    settingsService.getCompanyDetails(),
  ]);
  res.json({ support, company });
}
