import { apiClient } from './client.js';

/**
 * M4-H · FCM device registration.
 *
 * The server stores a RAW FCM token (`device.validators.js`: a 20–4096 char
 * opaque string) and sends to it through `firebase-admin`. So the app must hand
 * over the NATIVE device token — `Notifications.getDevicePushTokenAsync()` —
 * not an Expo push token, which only Expo's own relay can deliver to.
 *
 * Registration is an UPSERT server-side: a token survives reinstalls and can
 * change hands between accounts, so re-registering the same token simply
 * re-points it rather than erroring.
 */
export const devicesApi = {
  register: ({ token, platform }) =>
    apiClient.post('/me/devices', { token, platform }).then((r) => r.data),

  /** Called on logout so the next person on this device gets nothing of ours. */
  unregister: (token) => apiClient.delete(`/me/devices/${encodeURIComponent(token)}`).then((r) => r.data),
};
