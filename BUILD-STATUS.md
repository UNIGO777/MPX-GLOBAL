# MPX Global — what is built

**As of 2026-08-03.** Every line below was checked against the code, not from memory.
Backend test suite at time of writing: **934 tests across 61 files, all passing.**

Legend: ✅ built · 🟡 partly built · ❌ not built

> **A placeholder is not a feature.** The mobile app's tab bar looks complete, but four of its five
> tabs are empty shells waiting for M2–M4. They are marked ❌ here.

---

## 1 · What a person can actually do today

A buyer or an exporter can **create an account** (proving both their email and their phone),
**sign in**, **reset a forgotten password**, and **submit KYC documents** for verification. Staff
can **review and verify** those companies, **manage the catalogue and categories**, **moderate
products and chats**, and **read the audit trail**, all on the web console. The public catalogue,
**search and AI search**, saved items, and the full **enquiry + chat** system exist as a working
API. What no one can do yet is browse that catalogue or chat **from the mobile app** — those
screens are not built.

**No money moves anywhere.** Escrow, payouts, orders and contracts are Phase 2 and are not being
built in this phase.

---

## 2 · Backend

The API is the most complete part of the project — **94 endpoints** across 10 route files, and it
is what the 934 tests cover.

| Module | Endpoints | What it enforces |
|---|---|---|
| **Auth** (`auth.routes.js`) | 17 | Two-step signup with **both** channels verified · portal-scoped login · separate staff login · OTP with a 5-attempt/15-min lock · rotating refresh tokens |
| **Admin console** (`admin.routes.js`) | 20 | User directory, organisation list/detail, block & unblock, employee permissions, audit viewer, error-log viewer, featured landing content |
| **Categories** (`category.routes.js`) | 14 | Category tree, attributes, synonyms, images — all permission-gated |
| **Chat** (`conversation.routes.js`) | 12 | Two-party conversations, messages (append-only), freeze/unfreeze, staff moderation reads |
| **Products** (`product.routes.js`) | 9 | Seller catalogue, drafts, takedown/restore, the 3-active/10-draft cap while unverified |
| **Public** (`public.routes.js`) | 9 | Catalogue browse, product/supplier detail, **search + facets**, **AI search**, featured content, sitemap/robots |
| **Employee** (`employee.routes.js`) | 5 | Buyer approval, exporter verification, KYC document viewing (audited) |
| **Self** (`me.routes.js`) | 4 | KYC upload, own verification status, push-device registration |
| **Saved items** (`saved.routes.js`) | 3 | Buyer-only saved products/suppliers |
| **Enquiries** (`inquiry.routes.js`) | 1 | Buyer opens an enquiry, which creates the conversation |

**Also built and running:** Socket.io live chat delivery, FCM push on two events, a daily purge job
for taken-down products, Redis-backed rate limiting, and an append-only audit trail.

### Three things worth understanding

**Signup proves both channels before an account exists.** `/auth/signup/start` → verify email →
verify mobile → `/auth/signup/complete`. Nothing is written to the database until both codes pass.
The old one-call signup endpoints were **removed**, not deprecated: because email and phone are
uniquely indexed per role, creating the account first let anyone permanently burn a stranger's
email or phone with no proof they owned it — and the victim could then never register.

**KYC is not a gate.** A buyer is fully active from the moment they sign up, and buyer KYC is
optional. An exporter's profile is public from signup too. The only real consequence of being
unverified is the exporter's **3 active listings / 10 drafts** cap. Nothing is "locked", nothing is
"pending approval".

**KYC documents are never sent back to any client.** They are stored private, and only staff can
view them through a 120-second signed URL, which is itself audited. Apps and browsers receive only
metadata — document type and date. That is deliberate, not a missing feature.

---

## 3 · Web (React + Tailwind)

| Area | Status |
|---|---|
| Landing page | ✅ |
| Sign in · staff sign in · forgot · reset · change password | ✅ |
| Signup — account → verify → company | ✅ (both portals) |
| Buyer / exporter KYC upload + verification status | ✅ |
| Admin — users, employees, verification queue, KYC viewer | ✅ |
| Admin — everything else | 🟡 `ComingSoon.jsx` |
| Catalogue, search, enquiries, chat screens | ❌ Not started |

---

## 4 · Mobile app (React Native / Expo)

**Auth and KYC are built. Everything else is a placeholder.**

| Screen | Status |
|---|---|
| Splash · Welcome (portal choice) | ✅ |
| Login · OTP · Forgot · Reset | ✅ |
| Signup — account → verify email → verify phone → company | ✅ |
| KYC — prompt, hub (4 states), entity type, document choice, capture/upload | ✅ |
| Profile — identity + **sign out** | 🟡 company profile, biometric unlock and change password still to come (§A22) |
| **Home · Search/Catalogue · Enquiries · Messages** | ❌ Placeholders — M2–M4 |

The app's KYC upload was confirmed working end to end on a physical device: camera → multipart
upload → server validation → private storage → status moves to *in review*.

---

## 5 · Not built — and why

**Deferred by decision**
- Quotation & negotiation (quote Module 4) — after month 1
- Employee-only panel pieces: tickets, enquiry routing, per-employee dashboards
- Notifications beyond OTP and the two push events — email, WhatsApp, in-app centre
- Super Admin TOTP 2FA — built but on hold; staff use OTP. **Must be restored before launch**
- Automated KYC document checking (OCR → GST/PAN lookup → DigiLocker) — deferred to ~2026-09-03

**Phase 2 — not this phase**
Escrow, payouts, contracts/eSign, orders, shipments, trust score, subscriptions, deep analytics.

**Next up**
The mobile app's catalogue, search, enquiry and chat screens — the API for all of them already
exists and is tested.

---

## 6 · Waiting on the client

| | |
|---|---|
| **Real OTP delivery** (SMS + email) | Codes currently print to the developer's terminal. **Nothing can go live without this.** |
| **40 top-category synonyms** | Keyword→category search only half works without them |
| **40 category images** | Category cards cannot render without them |
| **Production VPS + MongoDB** | Needs auth enabled, backups, and the append-only audit grant |
| **Girish's written sign-off** | On two deliberate deviations from the quote: buyers get full access with no approval gate, and unverified exporters get a 3-product trial |

*(Cloudinary, OpenAI and Redis credentials have been supplied and are working.)*

---

## 7 · Known gaps and risks

- **Most of the app is tested through the API, not on a phone.** Signup, KYC upload and sign-out
  were driven on a real device; login, forgot/reset, the OTP lockout and the post-signup prompt
  have only been proven by the automated suite.
- **Rotate two credentials before launch.** The Firebase service-account key and the seeded
  superadmin password both passed through a chat transcript and must be treated as compromised.
- **`TRUST_PROXY` must be set on the production server.** Without it every visitor shares one
  rate-limit bucket and audit rows record the proxy's address instead of the caller's.
- **Run `npm run indexes:sync` before production traffic.** Indexes are not created automatically
  in production — and one of them is the TTL that expires error logs after 90 days.
- **Decide the Aadhaar question.** We accept and store Aadhaar images. Storage is technically
  correct (private, signed URLs) but storing Aadhaar copies is legally restricted in India. The
  cheapest fix is to drop Aadhaar from the accepted list — PAN and passport already cover it.
- **Organisation "claim" is not built.** Signup always creates a new company; a second person from
  the same firm gets a second organisation.
