import { apiClient } from './client.js';

/**
 * D8 · Platform settings (§3.5). Superadmin-only server-side — a hard role gate,
 * never a grantable employee permission, so there is no permission to check in
 * the client. The sidebar row is `superadminOnly` for the same reason.
 *
 * → { aiGuestDailyMax, envAiGuestDailyMax, supportEmail, supportPhone,
 *     updatedAt, updatedBy }
 *
 * `aiGuestDailyMax: null` means NO override — the effective ceiling is then
 * `envAiGuestDailyMax` (the `AI_GUEST_DAILY_MAX` the process booted with). Both
 * are returned so the screen can show which one is actually in force rather than
 * leaving the reader to guess.
 *
 * 🔴 Nothing here is ever a secret, and nothing secret may be added: the server
 * schema is `.strict()`, so an unknown key is refused rather than ignored.
 */
export const settingsApi = {
  get: () => apiClient.get('/admin/settings').then((r) => r.data.settings),

  /** Partial — send only what changed. `null` (or '') clears a field. */
  update: (patch) => apiClient.patch('/admin/settings', patch).then((r) => r.data.settings),
};

export const settingsKeys = {
  platform: ['admin', 'settings'],
};
