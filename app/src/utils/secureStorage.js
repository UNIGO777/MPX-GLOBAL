import * as SecureStore from 'expo-secure-store';

import { logger } from './logger.js';

/**
 * The ONLY place a token or credential is persisted on device (G1).
 *
 * Backed by the Android Keystore and the iOS Keychain. AsyncStorage is not a
 * dependency of this app and must not become one: on a rooted or jailbroken
 * device its contents are readable plain text. The same goes for a persisted
 * store written to disk, a plain file, or a cache directory.
 *
 * Nothing in this module logs a value — only whether an operation failed.
 */

const KEYS = {
  accessToken: 'mpx.accessToken',
  refreshToken: 'mpx.refreshToken',
  // Not a secret, but it lives here so the app has exactly one persistence
  // surface and no second store can drift into holding something sensitive.
  biometricEnabled: 'mpx.biometricEnabled',
};

// iOS-only; ignored on Android.
// `WHEN_UNLOCKED` — the app is only usable on an unlocked device, so there is no
// reason for a token to be readable while it is locked. `THIS_DEVICE_ONLY`
// keeps tokens out of an iCloud Keychain backup, so a restore onto another
// handset cannot carry a live session with it.
const OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function setItem(key, value) {
  try {
    await SecureStore.setItemAsync(key, value, OPTIONS);
  } catch (error) {
    logger.error('secureStorage: write failed', { key, error });
    throw error;
  }
}

async function getItem(key) {
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch (error) {
    // A read failure is recoverable — treat it as "no value" and let the caller
    // fall back to signed-out. Never swallow it silently.
    logger.warn('secureStorage: read failed', { key, error });
    return null;
  }
}

async function removeItem(key) {
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch (error) {
    logger.warn('secureStorage: delete failed', { key, error });
  }
}

export const secureStorage = {
  async getTokens() {
    const [accessToken, refreshToken] = await Promise.all([
      getItem(KEYS.accessToken),
      getItem(KEYS.refreshToken),
    ]);
    return { accessToken, refreshToken };
  },

  async setTokens({ accessToken, refreshToken }) {
    await Promise.all([
      accessToken ? setItem(KEYS.accessToken, accessToken) : removeItem(KEYS.accessToken),
      refreshToken ? setItem(KEYS.refreshToken, refreshToken) : removeItem(KEYS.refreshToken),
    ]);
  },

  /** Wipes every token. Called on logout and on an unrecoverable refresh. */
  async clearTokens() {
    await Promise.all([removeItem(KEYS.accessToken), removeItem(KEYS.refreshToken)]);
  },

  async isBiometricEnabled() {
    return (await getItem(KEYS.biometricEnabled)) === 'true';
  },

  async setBiometricEnabled(enabled) {
    await setItem(KEYS.biometricEnabled, enabled ? 'true' : 'false');
  },
};
