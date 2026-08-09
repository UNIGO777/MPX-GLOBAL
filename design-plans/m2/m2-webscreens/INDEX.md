# M2 · Web screen exports — index

28 generated screen exports, reorganised 2026-08-09 into one folder per screen. Screen numbering
follows `design-plans/m2/m2-web-screen-details.md` (and `web-screens-design.md` §3).

Each leaf folder holds a `code.html` (the generated markup — the higher-fidelity source) and a
`screen.png` (a flattened preview).

> ⚠️ **These are all WEB screens.** The `mobile/` folders are the **responsive web** variants at
> ~375px — verified: they carry the web header/footer, and none has a native tab bar. They are
> **not** the React Native app screens. The mobile app is a separate 7-screen deliverable
> (`design-plans/m2/app-screens-design.md`), and nothing in this folder covers it.

## Layout

| Screen | Folder | Variants |
|---|---|---|
| 1 · Category browse `/categories` | `screen-01-category-browse/` | `desktop`, `mobile` |
| 2 · Category listing `/category/:slug` | `screen-02-category-listing/` | `desktop-all-states`, `mobile` |
| 3 · Product detail `/product/:slug` | `screen-03-product-detail/` | `desktop-all-states`, `mobile` |
| 4 · Supplier profile `/supplier/:slug` | `screen-04-supplier-profile/` | `desktop-all-states`, `mobile` |
| 5 · My products `/exporter/products` | `screen-05-my-products/` | `desktop`, `desktop-extended-states`, `mobile` |
| 6 · Add product `/exporter/products/new` | `screen-06-add-product/` | `desktop-operational-states`, `desktop-all-states-stacked`, `mobile` |
| 7 · Edit product `/exporter/products/:id/edit` | `screen-07-edit-product/` | `desktop-lifecycle`, `mobile` |
| 8 · Category manager `/admin/categories` | `screen-08-category-manager/` | `desktop`, `desktop-read-only`, `mobile` |
| 9 · Attribute manager `/admin/categories/:id/attributes` | `screen-09-attribute-manager/` | `desktop`, `desktop-lifecycle`, `mobile` |
| 10 · Product monitoring `/admin/products` | `screen-10-product-monitoring/` | `desktop-lifecycle`, `desktop-read-only-states`, `mobile` |
| 11 · Audit log `/admin/audit` | `screen-11-audit-log/` | `desktop`, `desktop-states`, `mobile` |
| — | `_design-system/` | `DESIGN.md` only — the design-system spec, not a screen |

Mapping was confirmed from each export's `<title>` / `<h1>` / `<h2>`, not from its original folder
name. Two would have been mis-filed on name alone: `mpx_global_catalogue_pages_all_states` and
`mpx_global_mobile_catalogue_page_corrected` are **product detail** (screen 3), not the catalogue
listing.

## Image quality — read this before reviewing the PNGs

**Nothing is corrupted.** All 28 PNGs decode, all 28 `code.html` files are complete, and there are
no `<FIFE Image failed to fetch>` placeholders (unlike the M1 export batch).

But every PNG is capped at **1600px on its longest side**, and the tall stacked-state exports lost
their width to that cap. Legibility by width:

| Width | Count | Usable? |
|---|---|---|
| 936–1600px | 6 | fully legible |
| 437–708px | 7 | legible, small text |
| 202–384px | 9 | structure only |
| 62–122px | 6 | effectively blank |

The six unreadable ones are all `mobile/` or many-states-stacked exports:
`screen-10/mobile` (62px) · `screen-07/mobile` (68px) · `screen-08/mobile` (83px) ·
`screen-01/mobile` (100px) · `screen-09/mobile` (108px) · `screen-02/mobile` (112px).

**Use `code.html` for those** — it is the actual generated markup and does not degrade. If you want
legible previews for your own review, re-export those as **one state per image** rather than
stacking states vertically; that keeps each under the cap at full width.
