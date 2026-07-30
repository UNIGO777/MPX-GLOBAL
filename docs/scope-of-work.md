# MPX Global — Phase 1 Scope of Work (authoritative)

Source: NxtGen × MPX Global Phase 1 Quotation (24 Jul 2026), INR 7,70,000, MERN +
React Native, web + mobile on one backend. This file is the authoritative scope. Anything
**not** listed here is out of Phase-1 scope → change request or Phase 2. If a request goes
outside this scope, Claude red-alerts first (see `.claude/rules/remind.md`).

## In scope — 8 modules
1. **Landing & Auth** — landing page; buyer + seller self-registration; JWT + OTP login;
   forgot/reset; role-based redirect; session handling with token refresh.
2. **Catalogue & discovery** — seller catalogue (add/edit products, images, MOQ, category
   tree); buyer discovery (filters, product detail, seller profiles, favourites, enquiry).
3. **Real-time chat & AI search** — buyer↔seller live chat (Socket.io); AI-assisted search
   (single cost-controlled OpenAI call: plain-language → keywords/filters + friendly reply).
4. **Quotation & negotiation** — seller quote (template); buyer accept / negotiate; history;
   employee email alert on new quotation.
5. **Super admin dashboard** — buyer/seller/employee management, category, banners, oversight.
6. **Employee panel** — assignable permissions; seller verification; buyer approval; product
   monitoring (view-only); ticket/query queue; enquiry routing; live-chat monitoring (granted).
7. **Seller manual verification** — sign-up → profile live but unverified → employee review →
   approve/reject with reason → **resubmit after rejection** → verified tick.
8. **Notifications** — push (Firebase), email, WhatsApp (partial), in-app centre.

Plus: web application, mobile application (Android/iOS, Expo).

## Deferred to Phase 2 (NOT Phase 1)
Escrow & milestone payments · payout governance & approval queue · AI contract generation &
eSign · semantic AI search (embeddings) · deep analytics & trust score · directories,
investment & premium network.

## Stack
React + Tailwind · Node + Express · MongoDB + Mongoose · React Native (Expo) · JWT + OTP ·
Cloudinary · Socket.io · OpenAI GPT · Firebase FCM.

## Security controls committed (quote p.16)
Auth (password hashing, JWT with rotation, OTP limits, session invalidation) · Access control
(server-side permissions, ownership checks, assignable employee permissions) · Application
(input validation, injection protection, security headers, upload checks, rate limiting) ·
Data (HTTPS, signed document URLs, secret hygiene, secure token storage on device).

## Milestones
- **M1 — Authentication** (all four panels) · ₹2,00,000 · advance **received** ← current work.
- **M2** — continued build after auth · ₹3,00,000.
- **M3** — before delivery, after client testing · ₹2,70,000.

---

## ✅ Confirmed decisions / deviations from the base quote
These are owner-confirmed and stable. Details + guards in `docs/Note.md`.

- **Buyer** — self-registers, **fully active from signup**, no approval gate. Employee
  approval is a recorded status only (flips `kycStatus` → verified for the tick).
- **Exporter/seller** — self-registers, **profile public immediately** (`kycStatus: pending`);
  verified = a **tick** (`kycStatus === 'verified'`; no "not verified" badge).
- **Unverified seller product limit** — unverified seller may hold **at most 3 ACTIVE (published)
  products** (taken-down products excluded from the count — Part A §A10) **plus max 10 drafts**
  (§A15); the cap lifts after an Employee verifies them. (Replaces the quote's hard
  "verify-before-sell" gate. The older "may add at most 3 products" total-upload wording is stale —
  the cap is on LIVE listings.)
- **Roles = 4** — `buyer` · `exporter` · `employee` · `superadmin`. **No separate `admin`
  role** (removed 2026-07-28; the quote names only a "Super admin dashboard" and an
  "Employee panel", so this aligns the build to the quote — not a scope change).
- **Admin access** — **superadmin = all-access**; employees need the specific granted
  permission.
- **Auth 2FA** — the superadmin currently logs in via **OTP**; TOTP is on hold (restore
  before close).
- **On hold now** — all notifications incl. **WhatsApp** (Module 8).
