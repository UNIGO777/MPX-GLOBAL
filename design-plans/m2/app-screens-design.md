# M2 · Mobile App Screens — Design Brief

> **7 screens** for the M2 (Catalogue) milestone, **mobile app only** (React Native / Expo,
> iOS + Android): buyer browse + exporter catalogue management.
> This is a **design** document: what each screen contains, every field on it, and the states that
> need artwork. No API or code detail.
> Companion: `design-plans/m2/web-screens-design.md` — the two surfaces must feel like one product —
> and `design-plans/m1/app-screens-design.md`, whose shells (tabs, ScreenContainer, tokens) these
> screens live inside.
>
> **Scope rule:** only the screens named in `modules-in-detailed/m2-max-3to6days/M2.md` §6 (app,
> 2 roles) + `m2.png`, corrected by `docs/MPX-M2-M3-Build-Prompt.md` **Part A** and grounded in
> the shipped M2 backend (`build-plans/m2/backend-plan.md`, all phases ✅). Gaps are listed in
> §11, not silently filled.
>
> ⚠️ `Other-category-feilds.png`, `Models-Chart.png` and `Flow-Chart-Backend.png` show
> **pre-Part-A** designs (manual goods/service pick, free-form specs, `resolvedType`,
> "view-only" admin) — do not draw from them. The `.md` files + Part A win.

---

## 1. Before anything else — what the app is and isn't

**Two roles only: Buyer and Exporter.** There is **no admin or employee surface in the app,
ever** (M2.md §6: "Employee/Super Admin app me nahi"). Category management, product monitoring,
takedown, audit — all web-only. Nothing in this brief or any app milestone hints at moderation
tooling.

**M2 is where the app earns its place.** M1 was forms; M2 is the daily loop. For an exporter the
killer feature is **photographing a product and listing it from the warehouse floor** — camera
first, gallery second, file browser last. For a buyer it's browsing a visual catalogue on the
sofa. Design both around the phone's strengths, not as shrunken web pages.

**All M1 app foundations carry over unchanged** (`m1/app-screens-design.md` §1): shared tokens
with web, platform conventions, safe areas, keyboard handling as a design requirement, ≥44px
targets, two device sizes (~375pt / ~430pt), dark-mode decision, and **offline as a drawn state
on every data screen**. Product screens are **not** sensitive surfaces (unlike KYC) — no
background blur needed here.

### 1.1 The verified tick — same single convention

One badge: `success` check + "Verified". No "not verified" badge anywhere. In M2 it appears on
product cards (seller line), product detail (seller block) and the supplier profile. Driven by
the server's derived `verified` flag — **raw verification status never reaches a public
surface, and verification never hides or filters anything** (B7): unverified sellers' products
render identically, tick aside.

### 1.2 Product status vocabulary — the M2 addition (identical to web §1.2)

| Status | Colour | Seller-facing label | Meaning |
|---|---|---|---|
| Draft | `muted` | "Draft" | never published; seller-only |
| Active | `success` | "Live" | public in the catalogue |
| Inactive | `warning` | "Hidden" | seller hid it; can return |
| Archived | `muted`, quieted | "Archived" | deleted; kept but terminal |

**Blocked is an overlay, not a status** — an admin takedown stacks a `danger` "Taken down" chip
on top of whatever status the product holds. The seller sees the reason + date, **never who**
(§A9), and has **no appeal action** (D6 deferred).

Rules the artwork must not contradict: **Draft is one-way** (published never returns to draft —
no such action exists) · **Delete = Archive, terminal** (recovery = list again as new) · these
states are **private** — a buyer never sees any of them.

### 1.3 The caps — unverified exporters only (D1 · §A10 · §A15)

Max **3 Live** products and **10 Drafts** while unverified; verification lifts both; verified
accounts see **no cap UI at all**. 🔴 **Taken-down products do not count toward the 3** (§A10) —
the cap meter and every cap message must never imply a blocked product occupies a slot. This
aligns with the M1 exporter-home allowance notice (m1 app brief, screen 13), which already warns
against flat "3 products" copy.

---

## 2. Shared components to design once

All M1 components reuse (ScreenContainer, buttons, inputs, sheets, toasts, skeletons,
empty/error/offline states, pull-to-refresh, stack headers, tab bars). New for M2:

**Category picker — full-screen, two steps.** Step 1: the 40 top categories as a searchable
list (name + thumbnail + fallback). Step 2: that top's sub-categories. **The sub is the pick**
— tapping a top only drills in; there is no "select this top" action. Native back returns to
step 1. Used by the product form; the buyer browse screens use their own browse layouts, not
this picker.

**Dynamic attribute field renderer.** One control per `inputType`: `text` → input · `number` →
numeric keypad with the **unit shown inside the field** ("120 gsm") · `select` → picker sheet of
the defined options · `boolean` → switch / Yes–No segmented. Ordered, required-marked, helper
slot. Most of the product form is this component.

**Price input — three modes.** Segmented: **Fixed / Range / On request.** Fixed → amount +
currency; Range → min + max + one currency (inline min < max error); On request → amount fields
**disappear** (not disabled) with the line *"Buyers will see 'Price on request'."* Currency =
searchable sheet of ISO codes, numeric keypad on amounts.

**Product photo manager — the mobile centrepiece.** Add up to **5 images, 5 MB each,
JPG/PNG/WEBP**; limits shown *before* the first capture. Source order: **Camera → Gallery**
(no document/file browser — product photos, not PDFs). Thumbnail row with per-image progress,
retake, remove, drag-to-reorder; first image labelled **"Cover"**. Images upload immediately on
capture — progress is real, one failed upload never blocks the others, and a photo taken on
weak signal shows retry, not a spinner forever.

**Product card.** Cover image (fixed ratio + fallback) · name (2-line clamp) · price line
("₹1,200 / piece" · "₹800–1,400" · "Price on request") · seller name + tick. Public variant has
**no status chip**; the seller's own-list variant adds status chip + blocked overlay chip.

**Cap meter.** "2 of 3 live · 7 of 10 drafts" + *"Get verified to publish unlimited products."*
Rendered only while unverified.

**Attribute spec table.** Label–value rows for the buyer detail screen; booleans as Yes/No,
numbers with units.

**Blocked banner (seller-side).** `danger` banner: reason verbatim + takedown date. Never the
acting admin, never an appeal button.

---

## 3. Screen inventory — 7

| # | Screen | Role | Group | Named in |
|---|---|---|---|---|
| 1 | Category browse | buyer | buyer tabs | M2.md §6.2 "Category browse" |
| 2 | Category product listing | buyer | buyer | M2.md §6.2 "Catalogue browse (listing)" |
| 3 | Product detail | buyer | buyer | M2.md §6.2 "Product detail (image gallery, specs)" |
| 4 | Supplier profile + catalogue | buyer | buyer | M2.md §6.2 "Seller profile + verified tick" |
| 5 | My products | exporter | exporter tabs (Catalogue) | M2.md §6.1 "Product list" + cap indicator + status toggle |
| 6 | Category picker (add-product step 1) | exporter | exporter | M2.md §6.1 "category picker" · `m2.png` "Add product — category select" |
| 7 | Product form — add / edit | exporter | exporter | M2.md §6.1 "Add / edit product — dynamic form" + image upload + pricing |

Status toggle, publish and delete are **row/detail actions of screen 5 and header actions of
screen 7** (M2.md names them as capabilities, not screens). Image capture is a flow inside
screen 7 (the photo manager). No separate "draft view" — drafts are a segment of screen 5.

**Never design, in any milestone:** payment/escrow/approval screens (web-only by contract), or
any admin/moderation surface in the app.

**Not in this milestone (Do not design), with sources:**
- **Search, filters, sort, saved items** — Module 3 (M2.md §9). Screens 1–4 carry **no search
  box and no filter control**; the buyer tab named "Search" stays a placeholder until M3.
- **Enquiry / chat CTA** — Module 4 (M2.md §9 · §8: "enquiry M4 me"). Screens 3–4 ship without
  a "Send enquiry" button; M4's brief adds it. A forced placeholder follows the visible
  coming-soon + ledger rule.
- **Quotation** — deferred, Bucket A (`docs/month1-not-doing.md`).
- **Featured / banner content** — FINALIZE F5 (struck in M2.md §5.3).
- **Seller unblock-request** — D6 (~2026-08-28): no appeal path on blocked products.
- **Notifications UI** — D5 deferred (the M4 FCM slice has no M2 surface).
- **Level-3 categories** — two levels only, everywhere.

---

## 4. Buyer screens (1–4)

Read-only, browse-shaped. A signed-in buyer reaches them from the buyer tab bar (see §8 —
entry-point gap flagged). **Nothing here may reveal:** product status, takedown, raw
verification status, seller contact, or internal ids. Unavailable products (draft / hidden /
archived / taken down / dead category) simply don't exist in these screens — a stale deep link
gets the standard not-found state.

### 1 · Category browse

**Contains:** header ("Browse categories") · the ~40 top categories as a scrollable list or
2-column grid — image (with fallback — **most will lack images at launch; design the fallback
as the primary look**), name · tapping a top → its sub-category list (same screen pattern,
drill-in with native back) · tapping a sub → screen 2.

**Goods/services grouping is derived, never stored** (§A16): if grouped headings are used, a
mixed top ("Other") appears under both. A flat ordered list is the simplest compliant design.

**States:** loading (skeleton grid) · loaded · offline (retry) · error. Pull-to-refresh.

**Design note:** `order` arrives pre-sorted from the server — no client-side alphabetising.

---

### 2 · Category product listing

Products of one sub-category (or a top aggregating its subs), newest first.

**Contains:** header = category name, back to screen 1 · product card grid/list (§2 public
variant) · infinite scroll or paging · sibling sub-category chips in a horizontal scroller
under the header for lateral movement.

**States:** loading (skeleton cards) · results · **empty category** — common at launch:
*"No products in this category yet"* + back-to-categories action · offline · error ·
category-gone (standard not-found, back to screen 1). Pull-to-refresh.

**🔴 No filter rail, no sort control, no search field** — M3 designs those. Leave the header
uncluttered rather than reserving visible dead space.

---

### 3 · Product detail

The screen buyers judge the platform by.

**Contains, top to bottom:**
- **image gallery** — full-width swipeable pager with dots/counter ("2/5"), pinch-zoom or
  tap-to-fullscreen; designed no-image fallback (images are optional at publish)
- **name** + listed-date line ("Listed Mar 2026")
- **price block**, large: fixed ("₹1,200 · per piece", using the goods unit when present) ·
  range ("₹800 – 1,400") · "**Price on request**" as information, not absence
- **seller card** — company name + verified tick + country + entity type → taps through to
  screen 4. Never email/phone/address/website
- **facts strip** — the filled fixed fields for this product's type: goods → MOQ (+unit),
  HS code, country of origin, supply ability, lead time, packaging, payment terms · service →
  engagement type, delivery model, team size, pricing model, timeline. Only filled fields render
- **description** (up to 5,000 chars — collapsed after ~6 lines with "Read more")
- **specifications** (§2 spec table) — the category's dynamic attributes

**States:** loading (gallery + text skeleton) · loaded · sparse listing (no images/description —
must still look intentional; the facts strip and seller card carry it) · offline · not found
(covers every unavailable case indistinguishably) · error.

**🔴 Copy constraints:** no status word, no "seller not yet verified" line, no enquiry CTA (M4).
Share (native share sheet of the public URL) is acceptable only if the public web page exists at
that URL — it does (`/product/:slug`); keep it a plain OS share, nothing custom.

---

### 4 · Supplier profile + catalogue

The buyer-facing view of a seller. Renders through the same public projection as web — same
fields, nothing more.

**Contains:** header — logo (monogram fallback), company name + **verified tick**, country,
entity type, description · **"N products"** (live listings only; taken-down excluded
server-side) · the seller's live products as product cards, paginated/infinite.

**States:** loading · loaded · **zero live products** — profile renders fully (sellers are
public from signup); catalogue area gets a calm *"No products listed yet"* · offline · not
found · error.

**🔴 Copy constraints:** absence of tick = nothing (no "unverified"). Never contact details,
never website, never verification status/history. Count and grid must agree (both exclude
taken-down items).

---

## 5. Exporter screens (5–7)

Live in the exporter tab bar — the **Catalogue tab goes live** with this milestone (it was a ⏳
placeholder in the M1 shells; if placeholders were hidden per that brief's recommendation, the
tab now appears).

### 5 · My products — the Catalogue tab

The seller's control room on the go.

**Header:** "My products" · **cap meter** (§2 — unverified only) · **"+ Add product"** (floating
action button or header action — one, not both).

**Segments:** All · Live · Hidden · Drafts · Archived (counts on each). Blocked products are
**not a segment** — they appear inside their status segment wearing the blocked overlay chip.

**Row (own-list card variant):** thumbnail · name · price line · status chip · blocked chip
when taken down · category · created date. Tap → screen 7 (edit). Long-press or trailing "…" →
**action sheet**, contents by state:

- Draft → **Publish** · Edit · Delete
- Live → **Hide** · Edit · Delete
- Hidden → **Publish** · Edit · Delete
- Archived → *(no actions — row visually quieted, tap shows a terminal notice, not the form)*
- Blocked (any) → Edit · Delete only; Publish/Hide absent, with the row's blocked chip
  explaining why

**Publish from the sheet** runs the real checks; design both refusals as toasts/inline notices
with a next step:
- **Cap (3 live, unverified):** *"You've reached 3 live products. Get verified to publish
  more."* + "Get verified" action → the M1 KYC screen. Never implies a blocked product uses a
  slot (§A10).
- **Missing required specs:** *"Add Material and GSM before publishing"* + opens screen 7
  scrolled to the first missing field.

**Delete — confirmation sheet** (destructive variant): *"This archives the product. It leaves
the catalogue and can't be edited or restored — to sell it again, create a new listing."*
Button: "Archive product".

**Blocked row detail:** opening a blocked product shows the **blocked banner** (reason verbatim
+ date — never who, §A9) above the form. Copy for the disabled lifecycle: *"Removed by the MPX
team. It can't be published or hidden until it's restored."* No appeal action (D6).

**States:** loading (skeleton rows) · populated · **first-run empty** — the state that decides
whether a new exporter lists: friendly illustration + *"List your first product"* + Add CTA +
one cap line for unverified sellers · per-segment empty · row action in-flight · **cap-blocked
add** (at 10 drafts unverified, the Add action explains rather than silently failing: *"Draft
limit reached (10). Publish or delete a draft, or get verified."*) · offline (list cached if
cheap; actions clearly blocked offline) · error. Pull-to-refresh.

---

### 6 · Category picker — add-product step 1

Full-screen picker (§2 component) that starts the add flow. On a phone the category choice is
its own screen, not a dropdown pair.

**Step 1:** the 40 tops, searchable by name (client-side filter of the loaded list — this is
not M3 search), thumbnail + name. **Step 2:** the chosen top's subs; tapping a sub proceeds to
screen 7. Native back: sub-list → top-list → cancel add.

**Helper copy:** step 1 header — *"What are you listing?"* with the sub-line "Pick the closest
match — 'Other' is at the end if nothing fits." Step 2 header — the top's name, sub-line "This
decides which details we'll ask for."

**🔴 The seller never picks goods vs service** — the sub decides it silently (§A14/§A16),
including "Other" (two ordinary subs: Other goods / Other services). No type toggle exists
anywhere in the flow.

**States:** loading · lists · filter-no-match ("Nothing matches — try 'Other'") · offline
(retry — the flow can't start offline) · error.

---

### 7 · Product form — add / edit

One long form screen, sectioned; the category came from screen 6 (add) or is shown editable-
with-warning (edit). This is the app's biggest form — keyboard behaviour and section rhythm
make or break it.

**Section 1 — Category (summary row).** "Textiles → Cotton fabric" + "Change" — change re-opens
screen 6 and, if specs were filled, warns first: *"Changing category clears the specifications
you've filled in."*

**Section 2 — Details**

| Label | Type | Required | Helper |
|---|---|---|---|
| Product name | text, max 200 | ✔ | — |
| Description | textarea + counter, max 5,000 | ○ | "Details, use cases, certifications…" |
| Photos | product photo manager (§2) — camera first, max 5 × 5 MB | ○ | "First photo is the cover" |

**Section 3 — Price.** The price input (§2). Numeric keypads, currency sheet.

**Section 4 — type-driven fixed fields** (all optional):
*Goods:* MOQ (number) + Unit (text, one labelled pair) · HS code · Country of origin (searchable
country sheet) · Supply ability · Lead time · Packaging · Payment terms.
*Service:* Engagement type · Delivery model · Team size · Pricing model · Timeline — text inputs
with example placeholders ("Project / hourly / dedicated team", "Remote / onsite").

**Section 5 — Specifications.** The dynamic attribute renderer (§2) with this sub-category's
fields in order, required ones marked. Required specs are enforced **at publish, not at
draft-save** — the form must let a seller save half-finished work without a fight.

**Actions:** **"Save draft"** (add) / **"Save"** (edit) pinned above the keyboard · on edit, a
header status strip: current status chip + contextual Publish / Hide + Delete (same rules and
copy as screen 5's action sheet).

**Edit-mode specifics:**
- 🔴 **Rename note:** when the name has been edited, one quiet line — *"Your product's web
  address stays the same."* (slug immutable, §A6).
- **Blocked variant:** blocked banner on top; fields stay **editable** (the seller can fix
  content while blocked); Publish/Hide absent; Delete available.
- **Archived never opens the form** — a terminal notice with "Create a new listing".

**States:** default · saving · field errors (scroll-to-first-error) · publish-blocked (cap /
required specs — same copy as screen 5) · photo capturing / uploading / per-photo failed ·
**draft cap hit on add** (blocking notice before filling: the 10-draft copy) · **backgrounded
mid-form → nothing lost** (photos already uploaded, text preserved) · offline mid-form (text
edits held locally with a visible "offline — will save when back" bar, or a clear block; never a
silent loss) · success → back to screen 5 with a toast offering **"Publish now"** (add) · not
found (someone else's or a gone product — standard not-found, never a permission message).

**Design notes:** sticky section labels or an in-form progress rail help on ~375pt. Number
fields show units inline. Camera flow: capture → crop/confirm → auto-upload with progress →
retake without losing the rest. Draft-save requires only name + category + a valid price shape
— everything else can wait. Mark the few **required** fields rather than scattering "optional".

---

## 6. What M2 changes on existing M1 screens

Not new screens — touchpoints the designer must update in the M1 artwork:

- **Exporter home (m1 screen 13):** the "product allowance notice" and the catalogue
  placeholder card now link to screen 5. The notice's copy already respects §A10/§A15 (active
  cap only, drafts separate) — keep it in sync with the cap meter's numbers.
- **Exporter tab bar:** Catalogue tab ⏳ → live (m1 §8 table).
- **Buyer tab bar:** unchanged — Search stays ⏳ (M3). See §11 for the browse entry gap.

---

## 7. Navigation map

```
Buyer tabs:    Home ✔ · Search ⏳(M3) · [browse entry — §11 gap] · Profile ✔
  Categories (1) → Sub-list (1) → Listing (2) → Product detail (3) → Supplier (4) → their products (3…)

Exporter tabs: Home ✔ · Catalogue ✔(5) · Enquiries ⏳(M4) · Profile ✔
  My products (5) → [Add] → Category picker (6) → Form (7) → back to 5
  My products (5) → row tap → Form-edit (7)
```

Stack headers with native back everywhere; the add flow (6→7) is a modal stack that confirms
before discarding a dirty form ("Discard this product?").

---

## 8. Cross-screen checklist before handing designs over

**Status & lifecycle**
- [ ] Status vocabulary (§1.2) identical to web; Blocked always an overlay chip, never a status
- [ ] No "revert to draft" action anywhere; Archived rows have no actions and never open the form
- [ ] Delete copy = "archive, terminal, re-list as new" — never "gone forever", never "restore later"
- [ ] Blocked: reason + date shown, acting admin never, no appeal action; fields still editable
- [ ] Publish refusals name the exact blocker (cap vs missing specs) with a tappable next step

**Caps (D1 · §A10 · §A15)**
- [ ] Cap meter only for unverified sellers; verified accounts show no cap UI
- [ ] Copy never implies a taken-down product occupies a live slot
- [ ] 10-draft block appears before the seller invests effort, not at save

**Public surfaces**
- [ ] No status chip, takedown trace, verification status, or seller contact on screens 1–4
- [ ] Verified tick only as a tick; unverified sellers browse identically minus it (B7)
- [ ] "Price on request" renders as a normal state on cards and detail
- [ ] Every unavailable product/category collapses into one indistinguishable not-found state
- [ ] No search box, filter, sort or enquiry CTA anywhere (M3 / M4)

**Form & media**
- [ ] Camera is the first photo source; limits (5 × 5 MB, JPG/PNG/WEBP) shown before capture
- [ ] Per-photo progress, retake, reorder, cover label; one failed photo never blocks the form
- [ ] No goods/service toggle anywhere; the sub-category silently decides the field set
- [ ] Category change warns before clearing filled specs
- [ ] Rename shows "web address stays the same"
- [ ] Draft-save succeeds with required specs missing; publish is where they're enforced
- [ ] Save button reachable above the keyboard on ~375pt; scroll-to-first-error works

**App-wide**
- [ ] Loading, empty, error **and offline** drawn for every screen; first-run empty on screen 5 is a designed moment
- [ ] Backgrounding mid-form loses nothing
- [ ] No admin/employee affordance anywhere in the app
- [ ] Checked on ~375pt and ~430pt; touch targets ≥ 44px
- [ ] Any control shown but not functional is visibly "coming soon" and ledgered

---

## 9. Decisions

### ✅ Backend is ahead of design

The M2 backend shipped in full (backend-plan: all phases ✅, 186/186 tests) — every state here
is real. Quoted limits (name 200 · description 5,000 · attributes ≤50 · images 5 × 5 MB ·
JPG/PNG/WEBP) are enforced server values; design error states against them.

### Still open

1. **Brand palette / dark mode** — same open items as the M1 app brief; decide once for both
   milestones' artwork.
2. **Buyer browse entry** — see §11 gap 1; needs an owner call before the buyer tab bar is
   final.
3. **Offline draft handling depth** — this brief mandates "never silently lose text" but the
   choice between local hold-and-sync vs a clear offline block is an implementation-cost call;
   design the visible bar either way.
4. ~~**Restore-over-cap**~~ — ✅ **DECIDED 2026-08-07 — owner: leave as-is.** Invisible in the app
   except that cap copy must not promise "never more than 3 live"; already worded accordingly.
   Do not re-raise.

---

## 10. Security / trust notes specific to these screens

- The app renders from server data only: caps, statuses, blocked flags and the verified tick
  all arrive computed — the app never derives "can publish" locally beyond disabling a button
  the server would refuse anyway (`mobile-app.md` trust boundary).
- Product photos are public Cloudinary assets — no KYC-style background blur needed; never mix
  the KYC capture flow's sensitive-surface treatment into this one.
- Public share URLs are the web slugs; nothing shareable exposes ids or status.

---

## 11. Gaps the sources leave — flagged, not silently filled

| Gap | Detail | What this brief did |
|---|---|---|
| **Buyer browse entry point** | M2.md §6.2 gives the buyer four browse screens, but the M1 tab bar (m1 app brief §8) has no Browse/Catalogue tab — only Home ✔, Search ⏳, Enquiries ⏳, Messages ⏳, Profile ✔. No doc names where screens 1–4 hang. | ✅ **DECIDED 2026-08-07 — owner: leave it.** No Browse tab is added. Screens 1–4 keep no named tab-bar entry; revisit only if the owner reopens it. Do not re-raise. |
| **Exporter own-product detail** | M2.md names list + add/edit + toggles; it never names a read-only "my product detail/preview" screen. | Not designed. Row tap opens edit (7); a "view as buyer" preview would be new scope — listed here, not drawn. |
| **Category images at launch** | §A20: admin uploads arrive over time; no doc defines the app-side fallback look. | Fallback treated as the primary launch look on screens 1, 6; visual design decides the tile. |
| **Currency for buyers** | Prices show the seller's ISO currency, no conversion in Phase 1 (§A27.1); no buyer-side currency aid is specified. | Raw currency code shown; nothing else designed. |
| **Sibling-chip navigation on screen 2** | Convenience navigation not named in any doc (web brief has the same pattern). | Kept minimal and identical to web; drop without loss if challenged. |
| **Search-within-picker on screen 6** | The client-side filter of 40 tops isn't named anywhere; a 40-row scroll without it is genuinely painful on a phone. | Included as a local list filter, explicitly **not** M3 search. Flagged so it isn't mistaken for scope creep. |
