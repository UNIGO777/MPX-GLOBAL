# M2 · Web Screens — Generation Prompts (11 screens)

> **What this is.** One ready-to-paste prompt per M2 web screen, for a UI generator (Stitch or
> similar). It is the *operational* companion to `m2/web-screens-design.md` — that file decides
> what each screen contains and why; this one turns those decisions into text a generator obeys.
>
> **Precedence unchanged:** `docs/MPX-M2-M3-Build-Prompt.md` Part A → the `modules-in-detailed/`
> plan docs → `web-screens-design.md` → this file. If a prompt here disagrees with any of them,
> they win and this file is the bug.
>
> **How to use.** For each screen, paste **§0.1** (design system) + **§0.2 or §0.3** (chrome) +
> the screen's own prompt block, in that order. The three together are self-contained; the screen
> block alone is not.
>
> **Grounded in the shipped backend.** Every field, limit and state below exists in
> `MPX-BACKEND-FULL-SAAS` today (M2 backend: all phases ✅). The sample content uses the real
> `Category.md` taxonomy — do not let a generator substitute invented categories.

---

## §0.1 — Design system · paste at the top of EVERY prompt

```
BRAND / DESIGN SYSTEM (follow exactly — this must look like one product):
- Primary royal blue #2A4DE0, darker #2340C4, deepest navy #1A2E8F
- Page canvas #EAEEFF; surfaces white; borders 1px #C5C6CF
- Card shadow 0px 4px 20px rgba(0,5,23,0.05)
- Radius 8px on cards, inputs and panels; buttons are fully rounded pills
- Success green, warning amber #F79009, danger red — each with a pale tint for
  backgrounds
- Type: clean geometric sans (Inter-like). ONE type scale across every screen.
- Tone: restrained, professional, confident. A cross-border trade platform where
  strangers transact — NOT a consumer shopping app. Generous whitespace on forms,
  tighter density in admin tables.
- Responsive at 1440 / 1024 / 768 / 375. No horizontal page scroll; wide tables
  scroll inside their own container.
- Accessibility is part of "done": real labels, visible focus rings, tap targets
  ≥44px, text contrast ≥4.5:1, never colour alone to carry meaning.
```

## §0.2 — Public chrome · screens 1–4 only

```
PAGE CHROME (guest-visible page — identical on every public screen):
- Sticky white header: "MPX Global" wordmark left; nav links "How it Works",
  "Categories", "Platform", "FAQ"; right side a "Sign In" text link and a dark
  navy "Get Started" pill. Below 1024px the nav collapses to a hamburger.
- Dark navy footer, four columns and nothing else:
  Marketplace: Categories · For Buyers · For Sellers
  Company: About Us · Careers · Contact
  Resources: Blog · Help Center · Trade Guides
  Legal: Privacy Policy · Terms of Service
  Copyright line: "© 2026 MPX Global. All rights reserved."
- The page works fully for a signed-out visitor. No login-only elements.
```

## §0.3 — Console shell · screens 5–11 only

```
APP SHELL (identical on every signed-in screen — do not redesign it):
- Fixed left sidebar, 260px, deep navy #1A2E8F, full height. An 88px block at the
  top holds the white MPX Global wordmark. Below it a vertical nav; the active
  item has a white left border, a subtly lighter background and white bold text.
  Inactive items are white at ~70% opacity.
- Top bar 88px, same navy, content right-aligned: the person's name, their role
  or company beneath it, and a sign-out control.
- The main area sits on canvas #EAEEFF with a LARGE 32px rounded top-left corner
  and a soft inset shadow along its top and left edges, so it reads as a panel
  lifted out of the navy. Page content is padded generously inside it.
- Below 1024px the sidebar becomes a slide-over drawer behind a hamburger.
```

## §0.4 — Vocabulary every prompt assumes

**The verified tick.** One badge: a success check + the word "Verified". There is **no**
"not verified" badge, no red cross, no warning chip — absence of the tick is the only signal. An
unverified seller's card, profile and listings look identical, minus the tick.

**Product status** — four seller-owned states, one visual language everywhere:

| Status | Colour | Label shown | Meaning |
|---|---|---|---|
| draft | muted | "Draft" | never published, seller-only |
| active | success | "Live" | public in the catalogue |
| inactive | warning | "Hidden" | seller hid it; can return |
| archived | muted, quieted | "Archived" | deleted; kept but terminal |

**Blocked is an overlay, never a fifth status.** An admin takedown stacks a danger "Taken down"
chip on top of whatever status the product holds. A product can read "Live · Taken down".

**The caps (unverified sellers only).** Max **3 live** products and **10 drafts**. Verified
accounts see **no cap UI at all**. 🔴 A taken-down product does **not** occupy a live slot, so cap
copy must never imply it does.

---

## §1 — Never draw, on any M2 screen

Give this list to the generator every time; marketplace mocks reach for all of it by reflex.

```
DO NOT INCLUDE ANYWHERE (each belongs to a later milestone or does not exist):
- Search box, filter sidebar, facets, price slider, sort control, "did you mean"
- Save / favourite / heart / wishlist controls
- "Send enquiry", "Contact supplier", "Message", "Request quote" buttons
- Star ratings, reviews, response times, transaction counts, "trusted" scores
- Supplier phone number, email address, street address or website
- Stock levels, delivery estimates, shipping calculators
- Featured / promoted / sponsored badges or banner slots
- Invented metrics of any kind ("1.5k suppliers", "242 members", "98% response")
- Any "not verified" badge, red cross or warning chip on an unverified seller
```

---

## Screen 1 · Category browse — `/categories` · public

**Status: BUILT** (`web/src/pages/public/Categories.jsx`). Prompt kept as the reference for
regenerating or restyling it.

```
Design a public "Browse categories" page for MPX Global, a B2B import/export
marketplace connecting verified Indian exporters with international buyers.

- Page heading (h1) "Browse categories" with a supporting line: "Find specialised
  suppliers across 40 industries."
- A responsive grid of category cards: 4 columns at 1440, 3 at 1024, 2 at 768,
  1 at 375. Whole card is one target.
- Each card: a 16:9 image area, then the category name (bold, may wrap to two
  lines), then a muted line of 2–3 example sub-categories comma-separated and
  truncated, then a small muted count at the very bottom.
- EQUAL-HEIGHT CARDS: several names wrap to two lines, so every card in a row must
  be the same height with the count line pinned to the bottom edge and aligned
  across the row.

Show these 12 categories with exactly these sub-examples and counts. Do not
invent, rename or substitute any of them:
  Agriculture — Seeds & plants, Grains & cereals, Spices & herbs — 10 sub-categories
  Apparel & Garments — Men's clothing, Women's clothing, Ethnic wear — 8 sub-categories
  Textiles, Fabrics & Yarn — Cotton fabric, Silk fabric, Denim — 8 sub-categories
  Leather & Leather Products — Finished leather, Bags & wallets, Belts — 7 sub-categories
  Food & Beverages — Packaged food, Beverages, Dry fruits & nuts — 8 sub-categories
  Chemicals, Dyes & Solvents — Industrial chemicals, Dyes & pigments, Solvents — 10 sub-categories
  Pharmaceuticals & Medical — Formulations, Surgical instruments, Diagnostics — 7 sub-categories
  Electronics & Electrical — Consumer electronics, LED lighting, Wires & cables — 8 sub-categories
  Industrial Machinery & Equipment — Packaging machines, CNC & machine tools — 9 sub-categories
  Building & Construction — TMT bars & steel, Cement, Tiles & marble — 9 sub-categories
  IT, Software & AI Services — AI/ML development, Cloud & DevOps, Cybersecurity — 9 sub-categories
  Other — Other goods, Other services — 2 sub-categories

🔴 THE NO-IMAGE STATE IS THE MAIN LOOK, NOT AN EDGE CASE. Category images are
uploaded by admins over time, so at launch almost every card has none. Design the
empty image area as a deliberate, attractive placeholder — a soft brand-tinted
panel with a large centred monogram — so a full grid of them reads as calm and
intentional. NINE of the twelve cards must use it; only three carry a photograph.
A grey broken-image icon is a defect.

The only numeric on a card is its sub-category count.

ALSO RENDER AS SEPARATE FRAMES:
1. Loading — the same grid as skeleton cards, not a spinner
2. Empty — "No categories yet" panel
3. Error — centred panel, plain non-technical message, "Try again" button
```

**Reject if:** a search or filter control appears · the fallback looks broken rather than designed
· cards in a row have different heights · any count or metric other than the sub-category count.

---

## Screen 2 · Category product listing — `/category/:slug` · public

Introduces the **product card**, which screens 3 and 4 reuse.

```
Design a public category product listing page for MPX Global.

- Breadcrumb: Categories → Textiles, Fabrics & Yarn → Cotton fabric
- h1 "Cotton fabric", with a muted line beneath: "48 products"
- TWO-COLUMN BODY at desktop:
  · LEFT COLUMN ~240px: the sibling sub-categories as quiet pill-shaped links,
    the current one highlighted — Cotton fabric (current), Silk fabric, Synthetic
    & blended fabric, Yarn & thread, Home textiles, Dyed & printed fabric, Denim,
    Non-woven fabric
  · RIGHT COLUMN: the product grid, 3 columns at 1440, 2 at 1024, 1 at 375
- Pagination footer under the grid: page numbers plus prev/next. Newest first is
  the only order — do NOT draw a sort dropdown.
- On mobile the left column becomes a horizontally scrolling row of the same
  sibling chips directly under the h1.

PRODUCT CARD — design this once, it is reused on other screens:
  · cover image area, fixed 4:3 ratio
  · product name, bold, clamped to 2 lines
  · price line (see below)
  · a seller line: small company name, plus a green check and the word "Verified"
    ONLY when that seller is verified
  · a muted category name at the bottom
  No status chips, no badges, no ratings, no stock counts.

PRICE LINE — three forms, all equally normal:
  · fixed:      "INR 1,200 / meter"
  · range:      "INR 800 – 1,400"
  · on request: "Price on request"
  🔴 "Price on request" must read as ordinary INFORMATION, not as a missing or
  greyed-out value — many listings, especially services, use it by design.
  Currencies show exactly as the seller set them with no conversion, so include at
  least one USD and one EUR card alongside the INR ones.

SHOW 9 CARDS:
1. Combed Cotton Poplin Fabric — INR 220 / meter — Tirupur Knitwear Exports ✓verified
2. Organic Cotton Voile — INR 180 – 260 — Coimbatore Cotton Mills ✓verified
3. Cotton Cambric Roll, 60s — Price on request — Erode Textile House (no tick)
4. Bleached Cotton Twill — USD 3.40 / meter — Surat Weaving Co ✓verified
5. Cotton Flannel, brushed both sides — INR 310 / meter — Ludhiana Fabrics (no tick)
6. Yarn-Dyed Cotton Check — EUR 4.10 – 5.60 — Ahmedabad Mills ✓verified
7. Cotton Muslin, greige — Price on request — Salem Cotton Traders (no tick)
8. Handloom Cotton Khadi — INR 450 / meter — Jaipur Craft Collective ✓verified
9. Cotton Canvas 12oz — INR 390 – 520 — Panipat Home Textiles ✓verified

🔴 IMAGES ARE OFTEN MISSING — publishing does not require a photo. Give 4 cards a
fabric photograph and the other 5 a designed no-image placeholder: a soft
brand-tinted panel with a small centred line icon. Same visual language as the
category cards' monogram fallback.

ALSO RENDER AS SEPARATE FRAMES:
1. Loading — skeleton cards plus skeleton sibling chips
2. Empty category — a calm centred panel: "No products in this category yet", a
   short supporting line, and a "Browse all categories" button. This is a COMMON
   state at launch, not a rare one — design it as a real page.
3. Error — centred panel, plain message, "Try again"

LAYOUT NOTE: the left sibling column is where a filter rail lives in a later
milestone, so give it a real, comfortable width now — but draw nothing
filter-shaped in it today.
```

**Reject if:** "Price on request" looks disabled or degraded · ratings/reviews/response times
appear · a sort or filter control appears · every currency is rendered as ₹.

---

## Screen 3 · Product detail — `/product/:slug` · public

The page a buyer judges the platform by.

```
Design a public product detail page for MPX Global.

LAYOUT — two columns at desktop, stacked at mobile:
- LEFT: image gallery — one large main image with a thumbnail strip beneath (up to
  5 images), arrows, and a lightbox on click.
- RIGHT: the product summary block.
- BELOW both, full width: description, then the specifications table.

IN THIS ORDER:
1. Breadcrumb: Categories → Textiles, Fabrics & Yarn → Cotton fabric
2. Product name as h1: "Combed Cotton Poplin Fabric, 120 GSM"
3. A small muted line: "Listed Mar 2026"
4. PRICE BLOCK, visually large: "INR 220 · per meter"
5. SELLER BLOCK — a bordered panel: company name "Tirupur Knitwear Exports", a
   green check + "Verified", country "India", and entity type "Business". The
   whole panel links to the supplier's page. It shows NO email, phone, address or
   website — those are never public.
6. TRADE FACTS STRIP — a compact label/value grid, only the fields that are
   filled: Minimum order 500 meters · HS code 5208.52 · Country of origin India ·
   Supply ability 40,000 meters per month · Lead time 2–3 weeks · Packaging Roll,
   poly-wrapped · Payment terms 30% advance, 70% on shipment
7. DESCRIPTION — several paragraphs of real prose at a readable measure (about 70
   characters per line), with a "Read more" fold if long.
8. SPECIFICATIONS — a two-column label/value table:
   Material — Cotton · GSM — 120 gsm · Weave — Poplin · Width — 44 inches ·
   Organic — Yes · Shrinkage — 3 %
   Numbers carry their unit; yes/no values read "Yes" or "No".

ALSO RENDER AS SEPARATE FRAMES:
1. SERVICE VARIANT — the same layout for a services listing, "Custom AI/ML Model
   Development" by "Bengaluru AI Labs" ✓verified, price "Price on request", and a
   facts strip of Engagement type Project-based · Delivery model Remote · Team
   size 6–10 engineers · Pricing model Fixed scope · Timeline 8–12 weeks.
   It has NO minimum order and NO trade fields.
2. SPARSE LISTING — no images at all, no description, and only one specification
   row. It must still look intentional and complete: the no-image panel, the
   facts strip and the seller block carry the page. This is what many early
   listings actually look like.
3. Loading — gallery and text skeletons
4. Error — centred panel, plain message, "Try again"

🔴 COPY CONSTRAINTS:
- Never render a status word (no "Active", "In stock", "Available")
- Never render "this seller is not yet verified" or any negative verification text
- No enquiry, contact, quote or message button anywhere — that arrives later
- The gallery shows only the seller's own images; never stock filler
- If there are no images, show one designed no-image panel, not an empty carousel
```

**Reject if:** an enquiry/contact CTA appears · a status or stock word appears · the sparse variant
looks broken · the service variant still shows MOQ or HS code.

---

## Screen 4 · Supplier profile + catalogue — `/supplier/:slug` · public

```
Design a public supplier profile page for MPX Global. It is one page: a company
header, then that company's catalogue.

COMPANY HEADER — a wide panel at the top:
- Company logo on the left (96px, rounded). When there is no logo, a monogram tile
  in a soft brand tint — same fallback language as the category cards.
- Company name as h1: "Tirupur Knitwear Exports"
- Immediately after the name, a green check and the word "Verified"
- A muted metadata line: India · Business · Established 2011 · Member since 2026
- A short company description paragraph, two or three sentences.
- A count: "24 products"
- NO contact details of any kind — no phone, email, address or website. NO
  ratings, no response time, no transaction history, no "message" button.

CATALOGUE — beneath the header:
- Heading "Products"
- The same product card and the same grid as the category listing page: 3 columns
  at 1440, 2 at 1024, 1 at 375. Cards here do not repeat the seller name, since
  every product on the page has the same seller.
- Pagination footer. No sort, no filter, no search.
- Six cards: Combed Cotton Poplin Fabric INR 220/meter · Organic Cotton Voile
  INR 180–260 · Cotton Cambric Roll Price on request · Bleached Cotton Twill
  USD 3.40/meter · Handloom Cotton Khadi INR 450/meter · Cotton Canvas 12oz
  INR 390–520. Give three of them photographs and three the no-image panel.

ALSO RENDER AS SEPARATE FRAMES:
1. UNVERIFIED SUPPLIER — identical in every way, simply WITHOUT the green check
   and the word "Verified". Add no badge, no grey chip, no "unverified" label and
   no explanatory text in its place. The absence is the only signal.
2. NO PRODUCTS YET — the header renders in full exactly as above; only the
   catalogue area carries a calm "No products listed yet" panel. This is normal:
   a supplier's profile is public from the day they sign up.
3. Loading — header and card skeletons
4. Error — centred panel, plain message, "Try again"

🔴 The product count and the visible grid must agree. Never show verification
status, verification history, or any wording about documents.
```

**Reject if:** an "unverified" badge or greyed chip appears on frame 1 · contact details appear ·
the zero-products frame hides or shrinks the header · a "Contact supplier" button appears.

---

## Screen 5 · My products — `/exporter/products` · exporter

The seller's control room, and the module's most important empty state.

```
Design the "My products" screen for an exporter inside the MPX Global app shell.

HEADER ROW:
- Page title "My products"
- A CAP METER on the right: two compact progress readouts — "2 of 3 live listings"
  and "7 of 10 drafts" — each with a quiet fill bar, and one line beneath:
  "Get verified to publish unlimited products." Tone is incentive, never scolding.
- A primary "Add product" pill button.

STATUS TABS with counts: All (14) · Live (2) · Hidden (3) · Drafts (7) · Archived (2)
🔴 There is NO "Blocked" tab. A taken-down product stays in its status tab and
wears an extra danger chip.

TABLE, one row per product:
  cover thumbnail · product name · category (the leaf, e.g. "Cotton fabric") ·
  price line · status chip · created date · a row actions control (⋮ menu)
Rows to show:
1. Combed Cotton Poplin Fabric · Cotton fabric · INR 220 / meter · Live · 12 Mar 2026
2. Organic Cotton Voile · Cotton fabric · INR 180 – 260 · Live · 09 Mar 2026
3. Cotton Cambric Roll, 60s · Cotton fabric · Price on request · Live + a danger
   "Taken down" chip beside the Live chip · 02 Mar 2026
4. Bleached Cotton Twill · Cotton fabric · USD 3.40 / meter · Hidden · 28 Feb 2026
5. Cotton Flannel · Cotton fabric · INR 310 / meter · Draft · 26 Feb 2026
6. Cotton Muslin, greige · Cotton fabric · — · Draft · 24 Feb 2026
7. Handloom Cotton Khadi · Cotton fabric · INR 450 / meter · Archived, the whole
   row visually quieted and with NO actions control

ROW ACTION MENUS (show one open):
  Draft → Publish · Edit · Delete
  Live → Hide · Edit · Delete
  Hidden → Publish · Edit · Delete
  Taken down → Edit · Delete only (no Publish, no Hide)
  Archived → no menu at all

ALSO RENDER AS SEPARATE FRAMES:
1. FIRST-RUN EMPTY — the most important frame. A friendly illustration, a heading
   "List your first product", one supporting sentence, a prominent "Add product"
   button, and one quiet line about the 3-live limit while unverified. It should
   feel like an invitation, not an error.
2. PUBLISH REFUSED — CAP: an inline notice on the row or a toast reading "You've
   reached 3 live products. Get verified to publish more." with a "Get verified"
   link.
3. PUBLISH REFUSED — MISSING SPECS: "Add Material and GSM before publishing."
   with a link into the edit form.
4. DELETE CONFIRMATION — a centred destructive dialog: "This archives the
   product. It disappears from the catalogue and can't be edited or restored — to
   sell it again later, create a new listing. Your product name and web address
   become free to reuse." Buttons: "Cancel" and a danger "Archive product".
   🔴 Never use the words "permanently deleted" — the data is kept.
5. TAKEN-DOWN DETAIL — the row expanded to show a danger banner carrying the
   admin's reason verbatim and the date: "Removed by the MPX team on 02 Mar 2026 —
   Images do not match the product described." 🔴 It never names which admin
   acted, and offers NO appeal or "request review" button.
6. VERIFIED SELLER — the same screen with NO cap meter at all. A verified account
   shows no cap UI anywhere.
7. Loading — skeleton rows · 8. Error — panel with "Try again"

🔴 There is no "revert to draft" action anywhere. Once published, a product can
never return to Draft.
```

**Reject if:** a Blocked tab appears · "permanently deleted" wording appears · the blocked banner
names an admin or offers an appeal · a revert-to-draft action appears · the verified frame still
shows a cap meter.

---

## Screen 6 · Add product — `/exporter/products/new` · exporter

The longest form in the product. One page, three zones revealing in order — **not** a wizard.

```
Design the "Add product" form for an exporter inside the MPX Global app shell.
One long page, sectioned, with a sticky in-page section nav at desktop listing:
Category · Details · Pricing · Specifications.

ZONE A — CATEGORY (visible first, always):
  · "Category" — a searchable select of 40 top categories. Required.
    Helper: "Pick the closest match — 'Other' is there if nothing fits."
  · "Sub-category" — a select that fills from the chosen top. Required. Disabled
    until a top is picked. Helper: "This decides which details we'll ask for."
🔴 Until a sub-category is chosen, zones B and C are ABSENT — not greyed out, not
present-but-disabled. In their place one quiet line: "Choose a category to
continue."
🔴 The seller NEVER picks goods vs service. There is no such toggle anywhere. The
sub-category decides it silently.

ZONE B — DETAILS (appears once a sub-category is chosen):
  · "Product name" — text, max 200. Required.
  · "Description" — textarea with a live character counter, max 5,000. Optional.
    Helper: "Details, use cases, certifications…"
  · "Images" — a drag-and-drop area plus a browse button. State all three limits
    BEFORE the first pick: "Up to 5 images · 5 MB each · JPG, PNG or WEBP".
    Show three thumbnails already added: one uploaded, one mid-upload with a
    progress bar, one failed with a retry control. The first thumbnail is labelled
    "Cover". Thumbnails can be reordered and removed.
  · "Price" — a segmented control: Fixed · Range · On request. Show the FIXED
    state: one amount field plus a searchable currency select (INR selected).

ZONE C — TRADE DETAILS + SPECIFICATIONS (goods variant):
  · "Minimum order quantity" — a number field and a "Unit" text field shown as one
    labelled pair (e.g. 500 · meters)
  · HS code — text, helper "Harmonised System code, if you know it"
  · Country of origin — searchable country select
  · Supply ability — text, placeholder "e.g. 10,000 units per month"
  · Lead time — text, placeholder "e.g. 2–3 weeks"
  · Packaging — text
  · Payment terms — text, placeholder "e.g. 30% advance, 70% on shipment"
  · Then a "Specifications" sub-section rendering this category's own fields:
    Material (text) · GSM (number, with the unit "gsm" shown INSIDE the field on
    the right) · Weave (text) · Width (number, unit "inches") · Organic (a Yes/No
    toggle) · Shrinkage (number, unit "%")
  All of these are optional — mark the few REQUIRED fields rather than labelling
  everything else "optional".

ACTIONS, pinned at the bottom: a primary "Save draft" and a text "Cancel".
🔴 "Save draft" is the only way to create — publishing is a separate, deliberate
act from the product list. Required specifications are NOT enforced here.

ALSO RENDER AS SEPARATE FRAMES:
1. PRE-CATEGORY — the page with only Zone A and the "Choose a category to
   continue" line. Nothing else on screen.
2. SERVICE VARIANT of Zone C — Engagement type (placeholder "Project / hourly /
   dedicated team") · Delivery model (placeholder "Remote / onsite / hybrid") ·
   Team size · Pricing model · Timeline. NO minimum order, NO HS code, NO country
   of origin.
3. PRICE — ON REQUEST: the amount and currency fields are GONE entirely, replaced
   by one line: "Buyers will see 'Price on request'."
4. PRICE — RANGE with an inline error: a minimum and a maximum field, the minimum
   greater than the maximum, and the message "Minimum must be less than maximum."
5. DRAFT CAP REACHED — a blocking notice shown BEFORE the seller fills anything
   in: "Draft limit reached (10). Publish or delete a draft, or get verified." The
   form beneath it is not offered.
6. CATEGORY CHANGE WARNING — a small dialog: "Changing category clears the
   specifications you've filled in." with Cancel and Continue.
7. Saving state · 8. Field validation errors
```

**Reject if:** a goods/service toggle appears · zones B and C are greyed rather than absent before
a category is picked · the image limits appear only after a failed upload · "optional" is stamped
on every field.

---

## Screen 7 · Edit product — `/exporter/products/:id/edit` · exporter

Screen 6's form, pre-filled, plus lifecycle controls. Keep them visually identical.

```
Design the "Edit product" screen for an exporter inside the MPX Global app shell.
It is the Add-product form, pre-filled, with these differences.

HEADER STATUS STRIP, above the form: the product name, its current status chip
("Live"), and the contextual actions — a "Hide" button, a "Delete" button. For a
draft the contextual action is "Publish" instead.

THE FORM below is identical to Add product, populated with:
  Category: Textiles, Fabrics & Yarn → Cotton fabric (with a "Change" control)
  Name: Combed Cotton Poplin Fabric, 120 GSM
  Description: filled, counter showing 412 / 5,000
  Images: four thumbnails, the first labelled "Cover"
  Price: Fixed · INR · 220, with a "per meter" unit
  Trade details and specifications all filled

🔴 RENAME NOTE: when the name field has been edited, one quiet line appears
directly beneath it: "Your product's web address stays the same." Show this state.
It exists because the public URL never changes on a rename, and without the line
that gets reported as a broken-link bug later.

Primary action is "Save changes".

ALSO RENDER AS SEPARATE FRAMES:
1. TAKEN-DOWN VARIANT — a danger banner pinned at the very top of the page,
   carrying the reason verbatim and the date: "Removed by the MPX team on 02 Mar
   2026 — Images do not match the product described." Beneath it the form fields
   remain fully EDITABLE (the seller must be able to fix the problem), but the
   Publish and Hide actions are disabled with the explanation "This product was
   removed by the MPX team and can't be changed until it's restored." Delete stays
   available. 🔴 The banner never names the admin and offers no appeal button.
2. ARCHIVED — this screen never opens for an archived product. Instead show a
   terminal notice panel: "This product is archived", one supporting sentence
   explaining it can't be edited or restored, and a "Create a new listing" button.
   No form at all.
3. PUBLISH BLOCKED — the header's Publish pressed, showing "Add Material and GSM
   before publishing." with links to the missing fields.
4. Loading — form skeleton · 5. Saving · 6. Not found — a plain "Not found" page
```

**Reject if:** the blocked variant locks the form fields · an appeal/request-review button appears
· archived opens the form · the rename note is missing.

---

## Screen 8 · Category manager — `/admin/categories` · staff

Two-pane tree. This screen shows **inactive rows** — the public pages hide them, this must not.

```
Design the "Categories" management screen inside the MPX Global admin app shell.
Dense, table-first, authoritative.

TWO-PANE LAYOUT:
- LEFT PANE, ~320px, scrollable: the 40 top categories as a list. Each row: a
  small image thumbnail (or a monogram tile when empty), the name, a sub-count,
  and a small state marker. The selected row is highlighted. Two rows in the list
  are INACTIVE and render visibly muted but fully readable — never hidden.
- RIGHT PANE: the selected top category, "Textiles, Fabrics & Yarn".

RIGHT PANE — TOP CATEGORY CONTROLS (a top category cannot be created, renamed
structurally, or deleted — only these):
  · An "Active" toggle, currently on
  · An IMAGE UPLOAD field with the current image and a replace control. Limits
    stated: "1 image · 5 MB · JPG, PNG or WEBP"
  · Name and display-order fields
  · "Synonyms" — a tags input holding chips: textiles, fabric, kapda, cloth. A
    helper reads: "Keywords buyers might type — e.g. medicine, pharma, dawai."
    Show one empty synonyms input too: most categories have none yet.

RIGHT PANE — SUB-CATEGORY TABLE beneath, columns:
  name · a type chip reading "Goods" or "Service" · an Active toggle · attribute
  count (e.g. "6 fields") · image thumbnail · order · actions (Edit · Fields · Delete)
  Rows: Cotton fabric (Goods, active, 6 fields) · Silk fabric (Goods, active,
  6 fields) · Synthetic & blended fabric (Goods, active) · Yarn & thread (Goods,
  active) · Home textiles (Goods, active) · Dyed & printed fabric (Goods, active)
  · Denim (Goods, INACTIVE — muted row) · Non-woven fabric (Goods, active)

A small footer note on the screen: "Changes are recorded."

ALSO RENDER AS SEPARATE FRAMES:
1. SUB-CATEGORY SIDE PANEL (edit) — a right-hand drawer with: Parent shown as a
   read-only value · Name (text, max 120) · beneath it the slug shown READ-ONLY
   with the note "The web address is fixed once created" · Type as a read-only
   value with "Can't change: products exist in this category" · Synonyms tags ·
   Order · Image upload. Save and Cancel at the bottom.
2. CASCADE CONFIRMATION — a destructive dialog shown when switching a top
   category OFF: "This hides Textiles, Fabrics & Yarn and all 8 of its
   sub-categories from the catalogue. Every product in them disappears from public
   view until you reactivate. Sub-categories you had already switched off
   individually will stay off when you reactivate." Buttons Cancel and a danger
   "Turn off category".
3. DELETE REFUSED — an inline message, not a generic error: "Can't delete — 12
   products use this category. Deactivate it instead." with a "Deactivate" action
   in the same message.
4. ACTIVATION REFUSED — "Turn on Textiles, Fabrics & Yarn first — a sub-category
   can't be active under an inactive parent."
5. READ-ONLY VARIANT — the same screen for a staff member with view-only rights:
   every toggle, upload field, side panel and action button is simply ABSENT. It
   reads as a browsing view, NOT as a wall of greyed-out buttons.
6. Loading skeleton · 7. Error panel
```

**Reject if:** inactive rows are hidden · the read-only frame shows disabled buttons instead of
omitting them · a top category gets create/delete controls · the image upload is missing from the
top category (it is a deliberate exception).

---

## Screen 9 · Attribute manager — `/admin/categories/:id/attributes` · staff

The per-sub-category field designer. **Sub-categories only** — a top has no fields.

```
Design the "Fields" management screen inside the MPX Global admin app shell. It
defines the form fields sellers fill in for ONE sub-category.

HEADER: a breadcrumb "Categories → Textiles, Fabrics & Yarn → Cotton fabric",
the sub-category name as the page title, and a "Goods" type chip beside it.
A primary "Add field" button.

TABLE, columns: Name · Key (in a monospace muted style) · Type · Unit · Options ·
Required · Filterable · Order · actions (Edit · Delete)
Rows:
  Material · material · Text · — · — · No · No · 1
  GSM · gsm · Number · gsm · — · Yes · Yes · 2
  Weave · weave · Text · — · — · No · No · 3
  Width · width · Number · inches · — · No · Yes · 4
  Organic · organic · Yes/No · — · — · No · Yes · 5
  Finish · finish · Select · — · 4 options · No · Yes · 6

ALSO RENDER AS SEPARATE FRAMES:
1. CREATE PANEL — a right-hand drawer: Display name (text, max 120, required,
   helper "What sellers and buyers see — safe to change later") · Key (lowercase
   with underscores, max 60, required, with a small "Generate from name" control)
   · Type (a select: Text / Number / Yes–No / Select) · Unit (text, max 20, helper
   "e.g. gsm, kg, % — shown inside the seller's field") · a "Required" toggle
   (helper "Sellers must fill this before publishing") · a "Filterable" toggle
   (helper "Available as a buyer filter (arrives with search)") · Order.
2. EDIT PANEL — the same drawer for an existing field, where Key and Type are now
   READ-ONLY values, each with its reason:
     Key — "Fixed so existing products keep working"
     Type — "Type can't change later. To convert an existing field, delete it and
             create a new one with a different key."
   🔴 This teaching copy is load-bearing: nearly every seeded field is a Text
   field that an admin will want to turn into a Select, and without this they will
   report it as a bug.
3. SELECT TYPE — the create panel with Type = Select, revealing an options editor:
   a chip/tag list holding Mercerised, Sanforised, Bio-washed, Calendered, with an
   input to add more.
4. DELETE CONFIRMATION — "Products that already have GSM keep their saved value —
   it just stops being asked for on new listings." Cancel and a danger "Delete
   field".
5. EMPTY — "No fields yet", one line reading "Sellers will only see the standard
   product form", and an "Add field" button.
6. READ-ONLY VARIANT — table only; no Add button, no row actions, no panel.
7. Loading · 8. Error
```

**Reject if:** Key or Type are editable on the edit panel · the type-immutability explanation is
missing · options appear on a non-Select field.

---

## Screen 10 · Product monitoring — `/admin/products` · staff

The moderation surface. Takedown and restore are dialogs on this screen, not screens.

```
Design the "Products" moderation screen inside the MPX Global admin app shell.
Dense and table-first. Moderation is a serious act and should look like one.

FILTER BAR across the top:
  · a text search on product name, placeholder "Search product name"
  · Category — a select (top category, then an optional sub-category)
  · Status — a select with EXACTLY three options: Active · Inactive · Blocked
  · Seller — a company search/select
  · "Nearing purge" — a toggle
  · Rows per page — 20 / 50 / 100
  · a "Clear filters" text action
🔴 There is no Draft or Archived option anywhere in this filter bar, and no way to
list those products. They are deliberately invisible to moderation.

TABLE, columns: thumbnail · product name · seller company · category · status ·
listed date · actions (⋮)
Rows:
1. Combed Cotton Poplin Fabric · Tirupur Knitwear Exports · Cotton fabric · a
   success "Live" chip · 12 Mar 2026
2. Cotton Cambric Roll, 60s · Erode Textile House — and beside the company name a
   small danger-tinted counter reading "3 takedowns" · Cotton fabric · a "Live"
   chip PLUS a danger "Taken down · 02 Mar 2026" chip, and beneath it a small
   amber line "Purges in 24 days" · 02 Mar 2026
3. Bleached Cotton Twill · Surat Weaving Co · Cotton fabric · a warning "Hidden"
   chip · 28 Feb 2026
4. Yarn-Dyed Cotton Check · Ahmedabad Mills · Cotton fabric · "Live" chip ·
   19 Feb 2026
5. Cotton Canvas 12oz · Panipat Home Textiles · Cotton fabric · "Live" plus a
   danger "Taken down · 10 Sep 2025" chip and a red "Purges in 4 days" line

ROW ACTION MENU (show one open): View · Take down (in danger red) — and on an
already-blocked row instead: View · Restore.

ALSO RENDER AS SEPARATE FRAMES:
1. TAKE DOWN DIALOG — a destructive dialog with one required textarea labelled
   "Reason", a character counter reading "0 / 500", and the helper "This is shown
   to the seller — say what's wrong and what would fix it." Beneath, a consequence
   paragraph: "The product disappears from the public catalogue immediately. The
   seller keeps it and sees this reason. If it stays blocked for 180 days it is
   permanently deleted." Buttons Cancel and a danger "Take down".
2. RESTORE DIALOG — "The product returns to exactly the state the seller left it
   in (live products go live again). The seller's takedown count is not reduced."
   Cancel and a primary "Restore".
3. BLOCKED ROW DETAIL — a drawer showing, for staff only, WHO took the product
   down and when: "Taken down by Priya Sharma · 02 Mar 2026", the reason, and the
   purge countdown. 🔴 This admin identity is staff-only and must never appear in
   anything the seller sees.
4. NO MATCHES — an empty state that names the active filters and offers "Clear
   filters", rather than a bare "no results".
5. ALREADY HANDLED — a small inline notice: "This product is no longer in that
   state" with a "Refresh" action, for when another moderator acted first.
6. READ-ONLY VARIANT — a staff member who may view but not moderate: the table
   renders with NO action menus at all, not disabled ones.
7. Loading skeleton rows · 8. Error panel
```

**Reject if:** a Draft or Archived filter appears · the status filter has more or fewer than three
options · the takedown reason is optional · the purge consequence line is missing · the read-only
frame shows disabled action buttons.

---

## Screen 11 · Audit log — `/admin/audit` · staff

Strictly read-only. This is the record that protects the platform in a dispute.

```
Design the "Audit log" screen inside the MPX Global admin app shell. It is a
read-only ledger of governance and catalogue actions.

FILTER ROW: a date-range control · an "Action" select · an "Actor" select ·
a "Clear filters" action.

TABLE, newest first, columns: Timestamp · Actor · Action · Target · Reason
Rows:
  08 Mar 2026, 14:22 · Priya Sharma (Employee) · Product taken down · Cotton
    Cambric Roll, 60s (Product) · "Images do not match the product described"
  08 Mar 2026, 11:04 · Priya Sharma (Employee) · Exporter verified · Tirupur
    Knitwear Exports (Organisation) · —
  07 Mar 2026, 18:47 · Rahul Menon (Super Admin) · Permissions changed · Priya
    Sharma (Employee) · —
  07 Mar 2026, 09:15 · Arun Kumar (Exporter) · Product published · Organic Cotton
    Voile (Product) · —
  06 Mar 2026, 22:00 · System · purge job · Product purged after 180 days ·
    "Counterfeit listing" — and in the Target cell the SNAPSHOTTED names
    "Bleached Cotton Twill — Surat Weaving Co", shown as plain text rather than a
    link, because the product no longer exists
  06 Mar 2026, 16:31 · Rahul Menon (Super Admin) · Category deactivated · Denim
    (Category) · —

A row opens a read-only detail drawer showing the recorded before/after values for
safe fields only.

Pagination footer.

🔴 STRICTLY READ-ONLY. There is NO edit control, NO delete control, NO "clean up"
or "archive log" action, and NO export button anywhere on this screen. Audit
records are append-only by design — an interface that implies otherwise is wrong.

ALSO RENDER AS SEPARATE FRAMES:
1. EMPTY RANGE — "No activity in this period", with the selected range named and
   a "Clear filters" action.
2. Loading skeleton rows · 3. Error panel
```

**Reject if:** any edit, delete, export or cleanup control appears · the purge row links to a
product that no longer exists · KYC values, tokens or contact details appear in the detail drawer.

---

## §12 — Corrections found while writing these prompts

Recorded here rather than silently applied, because they change `web-screens-design.md`.

| # | Finding | Detail |
|---|---|---|
| 1 | **Admin product search is SUBSTRING, not prefix** | `web-screens-design.md` §10 says to label the search *"Starts with…"*. The shipped backend does the opposite on purpose: `adminProducts.service.js` builds `new RegExp(escapeRegex(q), 'i')` with **no `^` anchor**, and its comment records the decision — *"a moderator searching 'cotton' expects to find 'Premium Cotton Fabric'"*. The prompts above therefore use a plain "Search product name" placeholder. **The brief's label is stale and should be corrected.** |
| 2 | **A category carries no sub-count or description** | `Category.PUBLIC_FIELDS` is `name · slug · image · parentId · type` only. Screen 1's per-card count and teaser must come from the nested `subs` array on `GET /categories`; there is no count field to bind to, and `/categories/top` would render both blank. |
| 3 | **Screens 1–4 have no in-app entry point** | Owner decision (2026-08-07): no "Browse" item in the buyer sidebar. These four pages are reached from public/landing links only, which is why they wear the public chrome and never the console shell. |
| 4 | **Every seeded attribute is optional and none are Selects** | §A25.2: the seed marks `required: false` everywhere and never invents select options, so at launch the dynamic form is 5–8 optional text/number/boolean fields per leaf. The "missing required specs" refusal is real but rare until an admin marks something required — design it honestly rather than as the common path. |
| 5 | **Seeded attributes are inherited per sub, not per top** | `seed/catalogue.js` writes one copy of the top's attribute set onto **each** sub-category, so every leaf under "Textiles" starts with the same six fields. Screen 9 edits one leaf's copy — changing "Cotton fabric" does not change "Silk fabric". |

---

## §13 — Judging any generated screen

Run this before accepting output, in this order:

1. **Did it invent data?** Ratings, review counts, response times, "1.5k suppliers", stock levels,
   delivery estimates — all fabricated, all must go. We have none of it.
2. **Did it invent categories?** Only the `Category.md` taxonomy is real. "Trade Finance",
   "Global Logistics" and similar are not ours, and finance-shaped copy is actively wrong on a
   platform that moves no money in Phase 1.
3. **Is there a negative verification signal?** Any "unverified" badge, grey chip or explanatory
   text is a defect. Absence of the tick is the only signal.
4. **Did a later milestone leak in?** Search, filters, sort, save/favourite, enquiry or contact
   buttons — see §1.
5. **Does the no-image state look intentional?** It is the launch reality on category cards,
   product cards and supplier logos alike.
6. **Do the read-only staff variants OMIT actions** rather than disabling them?
7. **Does any seller-facing surface name the admin who acted, or offer an appeal?** Both are
   forbidden.
8. **Are all four states drawn** — loading, empty, error, success — plus the screen's own special
   states?
