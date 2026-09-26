#!/usr/bin/env bash
#
# Build the Android release APK — and PROVE it is the one we meant to ship.
#
# 🔴 Why this exists rather than "just run gradlew assembleRelease".
#
# On 2026-09-25 the app's icons were replaced in `assets/` and a release was
# built straight afterwards. It produced a perfectly healthy build log and an
# APK carrying the OLD BLUE icons, because the launcher icons do not come from
# `assets/` at build time — they live in `android/app/src/main/res/mipmap-*`,
# which only `expo prebuild` regenerates. Those files were five weeks stale.
# Nothing failed; it just shipped the wrong artwork, and only unpacking the APK
# revealed it.
#
# The same class of trap applies to the other three things that silently go
# wrong in a release build, so this script checks all four after building:
#
#   1. the launcher icons are not older than `assets/icon.png`
#   2. the APK is signed with the UPLOAD key, not the debug key
#   3. the live API base url is inlined, and no dev/tunnel url is
#   4. the JS bundle is the production one
#
# Each of those has failed silently at least once on this project. A build that
# cannot be uploaded to Play, or one pointed at a developer's laptop, looks
# exactly like a good build until somebody opens it.
#
# Usage:  npm run build:android        (from app/)

set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
APK="android/app/build/outputs/apk/release/app-release.apk"

# `--verify-only` re-runs the checks against the APK already on disk. Without it
# a one-line fix to a check costs a full 16-minute rebuild, and a check that is
# expensive to correct is a check that stops being corrected.
VERIFY_ONLY=false
[ "${1:-}" = "--verify-only" ] && VERIFY_ONLY=true

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$*"; exit 1; }

# ── 1 · regenerate the native project from app.config.js + assets ───────────
# Without this the icons, splash, permissions and app name can all be stale.
# It also re-applies plugins/withReleaseSigning.js, which is the only reason
# release signing survives — `android/` is gitignored and thrown away here.
if [ "$VERIFY_ONLY" = false ]; then
say "1/4  expo prebuild (regenerating android/ from assets + config)"
npx expo prebuild --platform android --no-install

# `local.properties` is not tracked and prebuild does not write it.
if [ ! -f android/local.properties ]; then
  echo "sdk.dir=${ANDROID_HOME:-$HOME/Library/Android/sdk}" > android/local.properties
fi

# ── 2 · build ───────────────────────────────────────────────────────────────
# NODE_ENV=production is what makes Expo load `.env.production` — the live API —
# instead of the developer's `.env`.
say "2/4  gradle assembleRelease (NODE_ENV=production)"
( cd android && NODE_ENV=production ./gradlew assembleRelease )
fi

[ -f "$APK" ] || fail "no APK at $APK"

# ── 3 · verify the artefact, not the log ────────────────────────────────────
say "3/4  verifying the APK"

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
APKSIGNER="$(ls "$SDK"/build-tools/*/apksigner 2>/dev/null | tail -1)"
[ -n "$APKSIGNER" ] || fail "apksigner not found under $SDK/build-tools"

# 3a · signing key
SIGNER="$("$APKSIGNER" verify --print-certs "$APK" 2>/dev/null | grep -m1 'certificate DN' || true)"
case "$SIGNER" in
  *"Android Debug"*)
    fail "signed with the DEBUG key — Play will refuse it. Is app/credentials/keystore.properties present?" ;;
  *"CN="*)
    ok "signed with a release key:${SIGNER#*certificate DN:}" ;;
  *)
    fail "could not read the signer from the APK" ;;
esac

# 3b · launcher icons must not predate the source artwork
NEWEST_ICON="$(find android/app/src/main/res -name 'ic_launcher*' -newer assets/icon.png | head -1 || true)"
if [ -z "$NEWEST_ICON" ]; then
  fail "the launcher icons are OLDER than assets/icon.png — prebuild did not regenerate them (this is the 2026-09-25 blue-icon bug)"
fi
ok "launcher icons regenerated after assets/icon.png"

# 3c/3d · what the JS bundle points at
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unzip -o -q "$APK" -d "$WORK" assets/index.android.bundle
BUNDLE="$WORK/assets/index.android.bundle"

PROD_URL="$(grep -m1 '^EXPO_PUBLIC_API_BASE_URL=' .env.production | cut -d= -f2- | tr -d '\r"'"'"' ')"
PROD_HOST="${PROD_URL#*://}"; PROD_HOST="${PROD_HOST%%/*}"
[ -n "$PROD_HOST" ] || fail "no EXPO_PUBLIC_API_BASE_URL in .env.production"

grep -aq "$PROD_HOST" "$BUNDLE" || fail "the live API host ($PROD_HOST) is NOT in the bundle"
ok "live API baked in: $PROD_HOST"

# A release pointed at a developer's tunnel is the failure nobody notices until
# the client opens it.
#
# 🔴 Check the EXACT url from `.env`, not a pattern like /10\.0\.2\.2/.
# The first version of this check used patterns and cried wolf on its first run:
# `src/config/env.js` lists `10.0.2.2` and `192.168.` as LOOPBACK/PRIVATE
# constants — in the code that REJECTS cleartext dev urls. Those strings are in
# every bundle by construction. A check that fires on a correct build gets
# switched off, which is worse than not having it.
DEV_URL="$(grep -m1 '^EXPO_PUBLIC_API_BASE_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r"'"'"' ' || true)"
if [ -n "$DEV_URL" ] && [ "$DEV_URL" != "$PROD_URL" ]; then
  if grep -aqF "$DEV_URL" "$BUNDLE"; then
    fail "the DEV url from .env is in the bundle — this build points at a developer machine"
  fi
  ok "the dev url from .env is absent"
else
  ok "no separate dev url configured to check for"
fi

say "4/4  done"
ls -lh "$APK" | awk '{print "  APK: " $5 "  " $9}'
echo "  Copy it wherever you need, e.g.:  cp $APP_DIR/$APK ~/Downloads/mpx-global-release.apk"
