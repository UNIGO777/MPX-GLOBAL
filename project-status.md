# MPX Global — Web Platform Build Report

**As of 2026-08-17.** Scope: **the web platform only** — the mobile app is covered in its own
separate document.

Everything marked ✅ is built, connected to the live API, and checked in a real browser at
phone, tablet, laptop and desktop sizes. Section 6 lists, without softening, the few things
that appear on the site but are not yet switched on.

---

## 1. At a glance

| | |
|---|---|
| **Screens live** | **31** across the public site, buyer area, exporter area and admin console |
| **Milestones complete** | **Accounts & verification** · **Catalogue** · **Search & discovery** |
| **Design system** | 45 shared building blocks, so every screen looks and behaves consistently |
| **Devices** | Built mobile-first; verified at 390 / 768 / 1024 / 1440 px with real touch testing |
| **Next milestone** | Enquiry & Chat — the buyer-to-seller conversation |

---

## 2. The public website

No login needed. This is what a prospective buyer sees, and what search engines index.

### 2.1 Home page — `/`

The marketing front door, built to be indexed.

- **Hero** with a working search box that takes any query straight to results, and a separate
  **AI Search** button beside it for plain-language questions.
- **Live category grid** — the real 40-category tree pulled from the catalogue, each card
  showing its own photograph and sub-category count. Nothing is hardcoded, so the homepage
  keeps itself current as the catalogue grows.
- **"How it works"** three-step explanation, a **platform** section with tabbed feature panels,
  trust markers (human-verified sellers, real-time chat, AI-assisted search, web + mobile), and
  an expandable **FAQ**.
- **Buyer / seller split** call-to-action, and a footer with the marketplace links.
- Copy is written to what the platform can actually do today — it never advertises a capability
  that isn't built.

### 2.2 Category directory — `/categories`

The whole catalogue at a glance.

- All **40 top categories**, each with its own photograph, name, and its real sub-categories as
  clickable links (not decorative labels).
- **Quick-find box** that filters as you type across both top and sub-category names and
  reports "N of 40 match".
- Two purpose-built layouts: a **card directory on desktop** and a **grouped chip directory on
  phones**, so neither device gets a compromised version of the other.
- Loading skeletons, an error state with retry, and a "nothing matches" state.

### 2.3 Category page — `/category/:slug`

Works for both a top category and any sub-category.

- **Masthead** with the category name, a description line, and contextual chips — which parent
  it belongs to, how many specialisations it holds, and the live listing count — over a
  photograph that fades into the page.
- **Specialisations rail** (desktop): a sticky sidebar of photo rows for every sibling
  category, the current one clearly marked. On phones this becomes a selector card that opens a
  searchable, photographed picker sheet.
- **Filters** at every screen size — a side drawer on desktop, a full-screen sheet on phones:
  verified sellers only, a price range pre-filled with the real minimum and maximum of the
  current results, and the category's own specification filters (for fabrics that's GSM and
  width; other categories bring their own).
- **Sort** by newest or price, reflected in the web address.
- **Product grid** — a compact two-up card on phones, a wide horizontal card on desktop showing
  photograph, name, price, minimum order and key specifications.
- **All state lives in the URL**, so a filtered view can be bookmarked, shared, and survives the
  browser's back button.
- Complete set of states: skeletons matched to the card shape, a no-products state, and a
  separate "no match for these filters" state with a one-click clear.

### 2.4 Product page — `/product/:slug`

The page that has to sell the listing.

- **Image gallery** with thumbnails, an overflow counter and a full-screen lightbox (closes on
  Escape, backdrop or button). Listings without photographs get a designed panel rather than a
  broken frame.
- **Buying panel** — category link, product name, listing date, specification chips, and a
  price block covering all three commercial modes the platform supports: fixed price, price
  range, and "price on request" (treated as ordinary information, never as missing data).
- **Minimum order quantity** and **monthly supply ability**.
- **Trade specifications** — HS code, country of origin, lead time, packaging and payment terms
  for goods; the equivalent facts for services.
- **Supplier card** — logo, company name, verified tick, member-since year, country and
  business type, linking through to the full profile.
- **Description and Specifications** side by side on desktop, with long descriptions folded
  behind a "read more".
- **"More in this category"** row of related listings.
- **Save to your list** from the gallery.

### 2.5 Supplier profile — `/supplier/:slug`

A company's public shop window.

- **Cover banner** carrying the company logo, name and verified tick.
- **Fact pills** — member since, country, business type, and number of live listings.
- **"About the company"** description card.
- **Their catalogue** in a card grid with sorting and pagination.
- Contact details are deliberately never published — buyers connect through the platform.

### 2.6 Search — `/search`

The most heavily worked screen on the site. It behaves as two connected experiences.

**Before you search — a discovery stage**
- A large centred prompt, a prominent search bar, and the AI Search button.
- **Recent searches** you can re-run or remove individually.
- **Suggested searches** to get started.
- A **Recommended** feed of live listings below, so the page is never empty.

**After you search — a results workspace**
- The search bar moves **into the site header** and stays there as you scroll, so you can
  refine without scrolling back up.
- **A heading that narrates the search** — "Analysing your request…" while it runs, then
  "Results found for …" with a count, or "Did you mean …?" with the server's suggestion when a
  query finds nothing.
- **Related Categories panel** for browsing sideways, with counts — a list on desktop, a
  scrollable row on phones.
- **Filters panel** with verified sellers at the top and everything else behind a "More
  filters" control. Filters adapt to context: choose a category and its own specification
  filters appear; a filter that could not change your results is not shown at all.
- **Country chips** to narrow by where the supplier is based.
- **Applied filters** as removable chips with a single "clear all".
- **Products or suppliers** — supplier results show company, country, verified status and
  listing count.
- **Sorting** by relevance, newest or price, plus pagination.
- Starting a new search **clears previous filters**, so a fresh query never silently returns
  nothing.

### 2.7 AI Search — `/ai-search`

A dedicated assistant page for buyers who would rather describe what they need.

- **Its own focused screen** — back button, assistant identity, and a large composer for plain
  language ("cheap cotton fabric in bulk", "medicines under ₹500"). Enter sends; Shift+Enter
  adds a line.
- **Suggested prompts** demonstrating what it understands.
- **The AI replies in writing** — it restates what it understood and often adds a practical
  sourcing tip, such as which specification to check.
- **Real matching products appear underneath**, with a **Related Categories** panel beside them
  and a "View all results with filters" link into the normal search page.
- The composer **docks to the bottom** afterwards so the next question is one tap away.
- Limits are handled honestly: a daily usage cap is explained plainly, and if the AI is
  unavailable the search still runs as an ordinary keyword search rather than failing.

### 2.8 Page not found

A designed 404 for any dead or removed listing — never a silent bounce to the homepage.

---

## 3. Buyer area

| Screen | Route | What it does |
|---|---|---|
| **Sign up** | `/signup/buyer` → verify → company | Two-step registration with **both email and mobile verified by separate codes**, then company details. The account is created only once both are proved. |
| **Sign in** | `/signin`, `/otp` | Buyer sign-in with a one-time passcode. |
| **Forgot / reset password** | `/forgot`, `/reset` | Full recovery flow. |
| **Verification status** | `/buyer/verification` | A four-step progress journey showing exactly where the account stands, plus the documents already sent. Verification is presented as optional — the account works fully without it. |
| **Upload documents** | `/buyer/kyc` | Document upload with camera capture handled properly on phones. |
| **Company profile** | `/buyer/company` | View and edit company details. Fields checked against documents lock after verification; changing one re-opens verification rather than silently un-verifying. |
| **Saved items** | `/saved` | Everything saved — products and suppliers — with price, supplier identity, saved date, one-click removal and pagination. Listings that disappear are marked "currently unavailable" and stay removable. A live count sits on the sidebar. |

**Saving works across the whole site.** The heart appears on category cards, search results and
product pages, and updates everywhere at once. Anyone can see it; only buyers can save. A
visitor who isn't signed in is offered a login; someone signed in with a non-buyer account gets
a plain explanation.

---

## 4. Exporter area

| Screen | Route | What it does |
|---|---|---|
| **Sign up** | `/signup/exporter` → verify → company | The same two-step, two-channel verification, plus the company's legal entity type. |
| **Verification status** | `/exporter/verification` | Progress, documents sent, and what remains outstanding. |
| **Upload documents** | `/exporter/kyc` | Including re-submission when company details change. |
| **Company profile** | `/exporter/company` | Company details, logo and description, with a preview of how the public profile will look. |
| **My products** | `/exporter/products` | The seller's catalogue as count-forward tiles that double as filters (live, drafts, taken down). Each row carries thumbnail, name, category and price with inline publish/hide. Listing allowances show as progress bars, so a seller always knows where they stand. |
| **Add / edit product** | `/exporter/products/new`, `/…/:id/edit` | The full listing form: name, category, description, images, price mode, minimum order, units, trade details, and the category's own specification fields. |

---

## 5. Admin console

Loaded as a separate bundle, so public visitors never download staff screens.

| Screen | Route | What it does |
|---|---|---|
| **Verification queue** | `/admin/verification` | Companies awaiting review, ordered by priority, with safeguards when two staff open the same case. |
| **Document viewer** | `/admin/verification/:orgId/kyc` | Review submitted documents and approve or decline with a recorded reason. |
| **Users** | `/admin/users` | Search and inspect accounts. |
| **Categories** | `/admin/categories` | Create, rename, reorder, photograph and deactivate categories and sub-categories, with ordering that re-sequences correctly across the whole list. |
| **Category specifications** | `/admin/categories/:id/attributes` | Define the fields each category offers — GSM, width, material and so on — including which appear as buyer-facing filters. |
| **Product monitoring** | `/admin/products` | Oversight of every listing, including taking one down with a recorded reason. |
| **Employees & permissions** | `/admin/employees` | Super-admin only: create staff accounts and grant individual permissions. |
| **Audit log** | `/admin/audit` | A permanent, append-only record of who did what. |
| **Staff sign-in** | `/signin/staff` | Separate from buyer and exporter login. |
| **Dashboard, Settings** | `/admin/dashboard`, `/admin/settings` | Placeholder pages — not yet built. |

---

## 6. Visible but not yet switched on

Each of these appears in a clearly inactive state, so nobody mistakes it for working.

**Waiting on the Enquiry & Chat milestone (next up)**
- "Send Enquiry" on the product page — the single entry point that milestone will activate
- "Inquiry" on category and search cards — intentionally inactive in favour of the above
- "Start Conversation" on supplier profiles — awaiting your decision on company-level messaging
- "Enquiries" and "Chat" entries in the buyer and exporter sidebars

**Content still to be supplied**
- Landing page testimonials
- Footer link columns (About, Careers, Contact, Blog, Help Centre, Trade Guides)
- Terms of Service and Privacy Policy pages
- App Store / Google Play badges (awaiting the app's store listings)

**Admin**
- Dashboard and Settings screens

---

## 7. Build quality

- **Responsive** — every public screen verified at 390 / 768 / 1024 / 1440 px with real tap
  testing on a touch device. No horizontal scrolling anywhere.
- **Never a blank screen** — every list and action has a designed loading, empty, error and
  zero-result state, with retry and a reference code when something fails.
- **Accessible** — keyboard navigable end to end, visible focus, labelled controls, 44px touch
  targets, and reduced motion respected.
- **Search-engine ready** — per-page titles, canonical addresses on every indexable page,
  readable URLs throughout, and search pages correctly excluded from indexing.
- **Privacy by construction** — public pages receive only whitelisted public fields. A
  supplier's verification documents, contact details and internal status never reach the
  browser; buyers see a verified tick and nothing more.
- **Security posture** — sign-in tokens are held in memory only, every action is re-authorised
  by the server, and the browser is never what grants access.
- **Consistency** — one design system across all 31 screens; no page carries bespoke one-off
  styling.

---

## 8. Platform behind the web client

Every endpoint the web platform needs is live — accounts and verification, catalogue, search,
filtering, AI search, saved items and the admin tools — covered by an automated test suite of
over 1,000 tests spanning security, ownership, permissions and every public-facing response.

---

## 9. What comes next

1. **Enquiry & Chat** — buyer-to-seller messaging, which activates the enquiry buttons already
   placed throughout the site.
2. **Remaining admin screens** — dashboard and settings.
3. **Content pages** — terms, privacy, and the marketing sections listed in section 6.
4. **Pre-launch hardening pass** — the standard security and configuration review before
   go-live.
