# MPX Global — Web & Mobile App Progress Report

**Project:** MPX Global — B2B Import/Export Marketplace
**Prepared by:** NxtGenDigitals
**Date:** 17 August 2026
**Covers:** Web application and mobile application (Android/iOS) — Phase 1

---

## 1. Executive summary

Phase 1 of MPX Global is a **discovery and trust marketplace** — buyers and sellers can find
each other, build a verified profile, and browse a live product catalogue. No money moves in
this phase; payments, escrow and contracts are a separate, later phase by design.

Across the **web application**, every core Phase 1 journey is built and usable end to end:
account creation and login for buyers, exporters and staff; seller product listing and buyer
discovery with full search and AI-assisted search; the seller verification workflow from
document upload through staff review to a public "verified" tick; and a working staff console
for user management, category management, product moderation and audit logging.

Across the **mobile app**, the buyer and exporter account journeys are fully built — signup,
login, OTP verification, company profile, and the complete document-verification flow — along
with a buyer home screen surfacing real, live categories, suppliers and products. Product
browsing depth (viewing a single product or supplier in full) and direct messaging between
buyers and sellers are not yet built on mobile; these are the next scheduled slice of work.

Nothing described as "built" below is a mock-up or a placeholder unless explicitly marked as
one — every item listed has been exercised against live data on a real device or in a browser.

## 2. Scope of this report

This report covers **only the web application and the mobile app** — what a signed-in buyer,
exporter, staff member or a member of the public can actually see and do on each platform
today. It does **not** cover:

- The backend API build and its automated test results — these are documented in a separate
  Progress & QA report.
- **Quotation and negotiation** (a seller sending a formal quote, a buyer accepting or
  negotiating it) — this is scheduled for a later slice of Phase 1, not part of the current
  build, and is not counted as a gap below.
- Anything from a later commercial phase — escrow, milestone payments, payout approval,
  contract generation and e-signature, and deeper AI/analytics features. These are out of
  scope for Phase 1 entirely.

## 3. Delivery status at a glance

| Area | Web | Mobile App |
|---|---|---|
| Landing, signup & login | ✅ Built | ✅ Built (buyer & exporter only — see §6) |
| Seller product listing (add/edit/publish) | ✅ Built | ⏳ Scheduled |
| Buyer discovery & browsing | ✅ Built | 🟡 Partially built |
| Keyword search & filters | ✅ Built | ⏳ Scheduled (points to category browse today) |
| AI-assisted search | ✅ Built | ⏳ Scheduled |
| Product detail / supplier profile pages | ✅ Built | ⏳ Scheduled |
| Saved products & suppliers | ✅ Built | ⏳ Scheduled |
| Direct messaging / enquiries | ⏳ Scheduled | ⏳ Scheduled |
| Seller verification (upload → review → tick) | ✅ Built | ✅ Built |
| Company profile (view & edit) | ✅ Built | ✅ Built |
| Staff console (user mgmt, category mgmt, moderation, audit) | ✅ Built | — Not applicable |
| Staff verification review queue | ✅ Built | — Not applicable |
| Employee permission assignment | ✅ Built | — Not applicable |
| Oversight dashboard (analytics) | ⏳ Scheduled | — Not applicable |
| Promotional banner management | ⏳ Scheduled | — Not applicable |
| Notifications | 🟡 Sign-in codes only | 🟡 Sign-in codes; push wiring in place, not yet visible |
| Quotation & negotiation | ⏳ Scheduled — later phase | ⏳ Scheduled — later phase |

✅ Built and verified · 🟡 Partially built · ⏳ Scheduled, not started · — Not part of this
platform by design

## 4. Web application — what's built

**Landing, accounts & sign-in.** A public landing page; separate sign-in for buyers/exporters
(with a portal switch) and a fully separate sign-in for staff; multi-step signup that verifies
both email and mobile number before an account is created; forgot/reset password for both
audiences; a forced password-change screen for staff issued a temporary password.

**Seller product listing.** A full product management screen for exporters — list, add, edit,
publish, hide and delete listings, with clear limits shown to an unverified account and images
handled through a dedicated image manager.

**Buyer discovery.** A public category directory (40 categories), a category listing page with
filters, a full product detail page, and a public seller profile page. A buyer can save
products and suppliers to a personal list.

**Search.** A dedicated search results page with keyword search, live filters and pagination.
Separately, a full AI-assisted search page lets a buyer describe what they need in plain
language and get back matched results — this is a single, cost-controlled request per search,
not an open-ended chat.

**Seller verification.** An exporter uploads identity/company documents against their entity
type and can track progress through a clear status screen; the same journey exists for buyers,
for whom verification is optional. Staff review submissions in a dedicated queue with a
document viewer, and can approve or reject with a reason. A rejected seller can correct and
resubmit. Once approved, a verified tick appears everywhere that seller is shown publicly.

**Company profile.** Buyers and exporters can view and edit their registered company details,
including a live preview of how the public profile appears, from one shared screen.

**Staff console.** A single console shared by staff and platform administrators, with what a
given staff member can see and do controlled entirely by permissions granted to them (not by
their job title). Built and working: the user directory, the verification review queue,
category and custom-field management, product moderation (including takedown and restore), and
a strictly read-only audit log of staff actions. Platform administrators additionally have a
screen to create staff accounts and assign their permissions.

## 5. Mobile application — what's built

**Landing, accounts & sign-in.** The mobile app mirrors the web account experience: a portal
choice screen, separate buyer and exporter sign-in, the same multi-step signup with email and
mobile verification, and forgot/reset password.

**Home & discovery.** A buyer's home screen surfaces real, live data — categories with their
own photos, verified suppliers, and recently listed products — pulled from the same search
system the web app uses, not a separate or simplified feed. A dedicated category browser lets
a buyer drill from a top-level category into its sub-categories, including two shortcut filters
for physical goods versus services.

**Seller verification.** The full document-upload and verification-status experience is built
for both buyers and exporters, matching the web journey step for step, including the
entity-type selection and document capture flow.

**Company profile.** An exporter or buyer can view their account and company details and sign
out; company-detail editing on mobile currently opens the same information the web screen
shows.

## 6. What's intentionally scheduled for later (not gaps)

The items below are not missing by oversight — they are sequenced deliberately, either because
they depend on something not yet ready or because the client has asked for them to follow
after the current slice:

- **Product detail and supplier profile screens on mobile** — a buyer can browse and see real
  listings on the home screen and category browser today, but tapping into a single product or
  supplier for full detail is the next scheduled piece of mobile work.
- **Direct messaging / enquiries** — neither platform has a live chat or enquiry thread yet.
  On mobile, the relevant tabs are visibly marked "on the way" rather than left blank or
  broken. The messaging groundwork (push notifications for a new enquiry or a new message) has
  already been built into the mobile app so it is ready to switch on the moment the messaging
  screens themselves ship.
- **Quotation & negotiation** — a seller sending a formal quote and a buyer accepting or
  negotiating it is scheduled for a later part of this phase.
- **Oversight dashboard and promotional banners** — the staff console's analytics dashboard and
  a screen for managing homepage banners are both scheduled but not yet built; the console
  currently shows a clear "coming soon" placeholder in their place rather than a broken link.
- **The mobile app has no staff experience by design** — employees and platform administrators
  use the web console only. This keeps the highest-privilege actions (approving a seller,
  managing permissions) on a single, more tightly controlled surface rather than spreading them
  across two apps.
- **Broader notifications** — email and WhatsApp notifications, and an in-app notification
  centre, are scheduled for later. Today, both platforms send only sign-in verification codes;
  the mobile app additionally has push-notification delivery already wired for two specific
  future events (a new enquiry, a new message) ahead of the screens that will trigger them.

## 7. Known limitations in the current build

- A buyer's mobile search tab currently redirects to category browsing rather than offering a
  dedicated keyword search — a real, useful substitute, but not the same as the full search
  experience already live on web.
- Staff cannot yet manage homepage promotional banners or view an oversight/analytics
  dashboard from the console; both currently show a "coming soon" screen.
- No third-party review of the finished web or mobile screens (accessibility audit, usability
  testing) has been performed yet — everything above has been verified functionally (does it
  do what it says, against real data, on a real device or browser) but not yet through a formal
  external review pass.

## 8. What's next

1. Product detail and supplier profile screens on mobile, bringing mobile discovery to parity
   with web.
2. Direct messaging and enquiries on both platforms, activating the push-notification wiring
   already in place on mobile.
3. Quotation & negotiation, once messaging is live.
4. The staff console's oversight dashboard and banner management.
5. Broader notifications (email, WhatsApp, in-app centre).
