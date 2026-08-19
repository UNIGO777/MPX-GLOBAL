/**
 * How an audit action is DESCRIBED — shared by the audit log viewer and the
 * dashboard's activity feed, so the same action can never read differently on
 * two screens.
 *
 * Tone is derived from the action's verb family, and the word always rides with
 * the colour (M4-19 discipline applies console-wide).
 */

/** Chip tint per action family. */
export function actionTone(action) {
  if (/takedown|reject|delete|deactivate|purge|block(?!.*un)/.test(action)) {
    return 'bg-danger-50 text-danger-700';
  }
  if (/restore|verify|approve|activate|publish|unblock/.test(action)) {
    return 'bg-success-50 text-success-700';
  }
  return 'bg-ink-100 text-ink-700';
}

/** The same families as a timeline dot. */
export function actionDot(action) {
  if (/takedown|reject|delete|deactivate|purge|block(?!.*un)/.test(action)) return 'bg-danger-500';
  if (/restore|verify|approve|activate|publish|unblock/.test(action)) return 'bg-success-500';
  return 'bg-ink-300';
}

// The auth family reads badly through the generic splitter ("Auth login",
// "Auth password change") — these are the account's own words instead.
const AUTH_LABELS = {
  'auth.login': 'Signed in',
  'auth.signup': 'Account created',
  'auth.signup.start': 'Signup started',
  'auth.password_change': 'Password changed',
  'auth.password_reset': 'Password reset',
  'auth.refresh.reuse': 'Refresh token reused',
};

/** Turn `product.takedown` into "Product takedown". */
export function actionLabel(action) {
  if (AUTH_LABELS[action]) return AUTH_LABELS[action];
  const [entity, ...rest] = action.split('.');
  const verb = rest.join(' ').replace(/[._]/g, ' ');
  const noun = entity.charAt(0).toUpperCase() + entity.slice(1);
  return `${noun} ${verb}`.trim();
}
