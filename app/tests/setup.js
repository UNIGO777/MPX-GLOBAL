// React Native defines `__DEV__`; Node does not. Default to a RELEASE build —
// the stricter case — and let a test flip it where it needs a dev build.
globalThis.__DEV__ = false;
