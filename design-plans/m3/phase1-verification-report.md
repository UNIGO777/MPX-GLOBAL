# M3 · Phase 1 Verification Report — shipped screens 4–7

> **Run:** 2026-08-14, live dev servers, Playwright (1440 desktop + 390 touch contexts), plus
> targeted read-only API/code inspection. **Audit only — zero changes were made** (owner
> instruction). Checklist source: `design-plans/m3/web-build-plan.md` Phase 1 ↔ the corrected
> brief `web-screens-design.md`.
> **Verdict: all four screens PASS their promises. 4 findings (no defects requiring code
> changes; 2 doc corrections + 1 data gap + 1 owner judgment call), listed at the bottom.**

## Screen 4 — `/categories` · ✅ PASS (all checks)

- Desktop: 40 cards · photo thumb · 6 sub-links per card (`DESKTOP_SUB_LIMIT`) · "Explore
  category · +N more" ✓
- Phone: grouped chip directory, **301 real links**, zero overflow ✓ (committed tall-scroll
  state — by owner decision, not re-audited)
- Quick-find: "denim" → 1 of 40 (sub-name matching ✓, server order preserved, count line ✓);
  zero-match state ✓
- Both markups in DOM at every width ✓ · one `h1` ✓ · title "Categories Index — MPX Global" ✓
- Error state + Try again render when the API is blocked ✓ (note: appears after React Query's
  ~7s retry backoff — a first probe with a 1.5s wait false-failed)

## Screen 5 — `/category/:slug` (top + leaf) · ✅ PASS

- **Masthead** (top + leaf): display name · promise line · real-data chips ("9 specialisations",
  "4 listings"; "Part of {top}" on leaf) · masked photo ✓
- **Rail** (lg+): "Specialisations" heading, 9 rows, sticky, current row `aria-current` + check,
  "All {top}" lead row on leaf ✓ · **<lg**: selector card ("Change ⌄", `aria-haspopup`) →
  searchable sheet, current row marked ✓
- **Filters drawer**: verified switch · 4 number inputs (price + GSM-style ranges) · applied
  chip + Clear All ✓ · toggling writes `?verified=1`, **drops `page`**, adds `noindex,follow`,
  canonical stays clean ✓
- **Sort** (`SortMenu`): pick writes `?sort=…` ✓ · **cold-URL round-trip** restores badge
  ("Filters 1") + sort label ✓
- **SEO**: clean page has NO robots meta (indexable) ✓; filtered = noindex ✓; canonical always
  clean ✓; bad slug → shared NotFound ✓
- **States**: zero-filter-match (+Clear filters) ✓ · genuine-empty (agriculture) ✓ · skeletons ✓
- **Copy**: no forbidden status/verification words on either variant ✓

## Screen 6 — `/product/:slug` · ✅ PASS

- Buy panel: eyebrow category link · h1 · Listed date · price block · supplier card
  (member-since **year only**, country, entityType, tick) ✓
- "Send Enquiry" present + `disabled` ✓ (the one door M4 wires — owner ruling)
- Description | Specifications **side-by-side at 1440** (top-aligned, measured) ✓
- Lightbox opens and Esc-closes ✓ · "More in {category}" uses the shared card (seller row
  visible) ✓ · bad slug → NotFound ✓
- No contact leakage (the probe's "website" hit was the *"Website development"* product's name —
  false positive, verified against the search payload) · no forbidden words ✓

## Screen 7 — `/supplier/:slug` · ✅ PASS

- Title **"{name} — Supplier | MPX Global"** ✓ (fixed earlier today) · cover band ✓ · stat
  chips ✓ · count chip renders as **"6 Active Listings"** (probe regex false-failed on the word
  order) · product grid 6 links ✓ · bad slug → NotFound ✓
- "Start Conversation" present + `disabled` ✓ (stays so — owner ruling)
- No email/phone/website anywhere ✓ · no "unverified/pending/rejected" anywhere ✓

---

## Findings (no changes made — for owner/build-time action)

| # | Finding | Type | Recommended action |
|---|---|---|---|
| F1 | **`/product/:slug` has NO save-heart placeholder.** Only `ProductListCard` carries one (single UiWebNotes row). The m3 brief §2 note, the m4 doc's "screen 6 shipped heart" line, and build-plan Phase 5 ("flip their rows ×2") all overstate. | doc inaccuracy | Correct the three docs; Phase 5 must **add** the product-page heart, not flip it. |
| F2 | **Attribute pill UI cannot be exercised against dev data** — every filterable attribute today is `number` (gsm, width → range inputs); no select/text attribute with options exists in any category. Pill code verified in source + earlier component harness only. | data gap | Seed one select attribute (or accept verification deferred to real content entry). |
| F3 | Specialisation sheet marks the current row `aria-current="true"`; the rail uses the more precise `"page"`. Functionally fine; a one-word a11y nicety. | minor a11y | Optional tidy in any future pass — not worth its own change. |
| F4 | Supplier chip copy **"N Active Listings"** — the brief's copy rule bans status words ("Live/Available/In stock… noise at best, leak at worst") since only active products are ever queryable. "Active" arguably belongs to that family; "N Listings" would say the same thing. | owner judgment | Owner call: keep or drop the word "Active". |

**False positives in my own probes, documented so nobody re-chases them:** error-state (retry
backoff timing) · "website" (product name) · product-count regex (word order) · member-since
(concatenated innerText).
