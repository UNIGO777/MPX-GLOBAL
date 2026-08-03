/**
 * One-shot marker: "this session was just created by signing up".
 *
 * Why a flag and not a status check: the prompt must appear **once, after
 * signup** — not on every launch. Deciding from `kycStatus` alone would nag an
 * unverified company every single time they open the app, which for a buyer
 * (whose KYC is optional, D3) is exactly the pestering this flow must not do.
 *
 * It cannot be a navigation param either: signup completes by flipping
 * `isAuthenticated`, which swaps the whole navigator, so the signup screen is
 * unmounted before it could navigate anywhere.
 *
 * In memory only, consumed on read, never persisted — a relaunch is not a signup.
 */
let pending = false;

export const postSignupPrompt = {
  /** Called just before the session is established at the end of signup. */
  arm() {
    pending = true;
  },
  /** Reads AND clears — so the prompt can only ever fire once. */
  consume() {
    const was = pending;
    pending = false;
    return was;
  },
};
