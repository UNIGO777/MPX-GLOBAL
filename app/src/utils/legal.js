import { Alert, Linking } from 'react-native';

import { env } from '../config/env.js';

/**
 * Open a legal document on the website.
 *
 * 🔴 The app does NOT ship its own copy of the Terms or the Privacy Policy.
 * Two copies of a legal document drift the moment one is edited, and the app
 * stores require a publicly reachable privacy-policy URL regardless — so the
 * website is the single source and both the signup screen and Profile link out
 * to it. See `config/env.js` for how the origin is resolved.
 *
 * Extracted rather than written twice for the same reason: two call sites, two
 * chances to point at different paths.
 *
 * A failure is surfaced, never swallowed — these rows replaced a disabled one,
 * and silently doing nothing would put us back where we started.
 */
export const LEGAL_PATHS = { terms: '/terms', privacy: '/privacy' };

export async function openLegal(path) {
  const url = `${env.webBaseUrl}${path}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Couldn’t open the page', `Visit ${url} in your browser.`);
  }
}
