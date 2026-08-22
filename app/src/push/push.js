import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { devicesApi } from '../api/devices.js';
import { logger } from '../utils/logger.js';

/**
 * M4-H · Push notifications (FCM).
 *
 * 🔴 SCOPE: this is the D5 carve-out the owner approved on 2026-07-31 — FCM
 * push on exactly two events (new enquiry → seller, new message → counterparty).
 * The rest of the notification layer (email beyond the approved set, WhatsApp,
 * the in-app centre, admin per-type controls) is still deferred.
 *
 * 🔴 EVERY export here is FIRE-AND-FORGET. Push is an accessory to the app, not
 * a prerequisite: a denied permission, a missing Firebase config, an emulator
 * with no Play Services, or a dead network must never block a login or break a
 * screen. Failures are logged and swallowed.
 *
 * We send the NATIVE FCM token (`getDevicePushTokenAsync`), not an Expo push
 * token — the server delivers through `firebase-admin` directly, so an Expo
 * token would be accepted by the API and then never deliver anything.
 */

// The token this device last registered, so logout can unregister exactly it.
// A module-level ref rather than storage: it is cheap to re-fetch on the next
// launch, and a stale token in storage would be worse than none.
let registeredToken = null;

/**
 * Foreground presentation. Without this a notification that arrives while the
 * app is open is delivered to the JS handler and shown nowhere — which reads as
 * "push is broken" during exactly the testing everyone does first.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for permission and register this device against the signed-in account.
 * Safe to call repeatedly — registration is an upsert.
 *
 * Returns the token on success, or null on any failure/denial.
 */
export async function registerForPush() {
  try {
    // Android 13+ requires a runtime permission; below that the getter simply
    // reports granted. iOS always prompts.
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      // 🔴 Only ASK once per install-ish: `canAskAgain` false means the user
      // has denied it permanently, and re-prompting is both useless and
      // annoying.
      if (existing.canAskAgain === false) return null;
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      // A channel is REQUIRED on Android 8+; without one the system drops the
      // notification silently rather than showing it.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Enquiries & messages',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token || typeof token !== 'string') return null;

    await devicesApi.register({ token, platform: Platform.OS });
    registeredToken = token;
    // Never log the token itself — it addresses a specific device.
    logger.info('push device registered');
    return token;
  } catch (error) {
    // Includes the ordinary case of a build with no Firebase config, and an
    // emulator without Play Services. Neither is an error worth surfacing.
    logger.warn('push registration skipped', { message: error?.message });
    return null;
  }
}

/**
 * Drop this device's token on logout, so the next person to sign in here does
 * not receive the previous account's enquiries.
 *
 * Best-effort: the session is being cleared regardless. The server also prunes
 * dead tokens when FCM rejects them, so a missed unregister self-heals.
 */
export async function unregisterFromPush() {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await devicesApi.unregister(token);
  } catch (error) {
    logger.warn('push unregister failed; server prunes dead tokens anyway', {
      message: error?.message,
    });
  }
}
