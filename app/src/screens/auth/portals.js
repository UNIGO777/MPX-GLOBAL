/**
 * Portal identity, in one place.
 *
 * The portal is a route param threaded through the whole auth flow (welcome →
 * login/signup → OTP → reset), because §A21 makes buyer and exporter separate
 * accounts and every party endpoint carries a `portal`. Defining the labels
 * once stops "Exporter" and "Seller" drifting apart across eight screens.
 *
 * The wire values are `buyer` and `exporter` — never the display labels.
 */
export const PORTALS = { buyer: 'buyer', exporter: 'exporter' };

export const PORTAL_LABEL = {
  buyer: 'Buyer',
  exporter: 'Exporter',
};
