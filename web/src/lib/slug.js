/**
 * The backend's slug rule (MPX-BACKEND-FULL-SAAS/src/utils/slug.js), mirrored
 * so a form can PREVIEW the public address a name will get. The server still
 * assigns the slug — this only shows it. Keep the two in step.
 */
export function slugify(input) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
