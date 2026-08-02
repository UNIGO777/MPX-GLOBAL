/**
 * In-memory holder for the in-flight signup.
 *
 * ✅ It no longer holds a PASSWORD. Under A21 the password goes to the server at
 * step 1 (`/auth/signup/start`) and is hashed into the pending record there, so
 * the plaintext never has to survive the OTP round trip on the device. What
 * moves through here now is the opaque `signupToken` plus the server's MASKED
 * email and phone.
 *
 * 🔴 Still not a navigation param: the token is the handle to an in-flight
 * signup, and navigation params are part of React Navigation's state tree — they
 * surface in dev tools, state snapshots, and anything that serialises navigation
 * state later. A plain variable keeps it out of all of that: never written to
 * storage, never logged, and cleared the moment signup succeeds or is abandoned.
 */

let draft = null;

export const signupDraft = {
  set(value) {
    draft = value;
  },
  get() {
    return draft;
  },
  clear() {
    draft = null;
  },
};
