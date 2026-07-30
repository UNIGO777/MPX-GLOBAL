# MPX Global — Category & Attribute Schema (Module 2)

> ## 🔴 Part A overrides (authoritative — supersede this reference doc)
> These decisions post-date this doc. Where they conflict with anything below, **Part A wins**.
> - **§A1 — `Product.status`** = `draft | active | inactive | archived` (4 values). `draft` is the create default and is **one-way** (a published product can never return to draft). **No `isActive` on Product or Category** — Product's lifecycle lives entirely in `status`; Category uses `active` + `prevActive`.
> - **§A2/§A6 — ownership & slugs.** `Product.exporterOrgId` (not the generic `orgId`); `SavedItem.buyerOrgId` (saving is **buyer-only** — see M3 §A13 / build-prompt A21). Unique, indexed **`slug`** on **Product, Category, Organisation** (on archive the product slug gets an archive marker — see SEO §A6).
> - **§A4 — Category** = `active` + **`prevActive`**. Cascade: deactivating a top category writes each sub's current `active` into `prevActive`, then sets subs inactive; reactivating restores each sub from `prevActive` (a sub the admin deliberately switched off stays off).
> - **§A11 — Category** gets an optional **`image`** (Cloudinary URL) for category cards.
> - **§A14 — "Other"** is seeded as two typed sub-categories (**Other goods** = `goods`, **Other services** = `service`). The seller never manually picks goods/service, and **`resolvedType` is NOT added to Product**. (Consequence: no leaf category is `either` — **`either` is removed from the `type` enum**; Category `type` = `'goods' | 'service'`.)
> - **§A16 — `type` lives on the leaf.** `type` is **required on sub-categories** (`parentId` set) and **not set on top categories** (`parentId: null` — left **absent**, no default, not optional-but-populated). A product always maps to a sub, so form fields resolve from the leaf; a top's own type was never read for product creation. A top's goods/services grouping on browse screens is **derived from its children's types at read time, never stored** (a mixed top appears under both — this is how "Other" works without an exception). **Seed must not set `type` on any of the 40 top categories.**
> - **§A19 — `Product.createdBy` is dropped** (exists in code, in no plan doc, superseded by AuditLog). Instead, **product create AND edit must write AuditLog entries** (actor + target + timestamp) — that is the replacement for `createdBy`, not an optional extra. A **separate error-log** (errors only; strict exclusion list — no KYC/tokens/passwords/OTPs/full bodies/contact) is also required; its storage = **MongoDB `errorLogs` with a 90-day TTL index**; AuditLog stays permanent (no TTL). *(M1 already keeps these out of logs via `select:false` + shaped errors + no body logging; extend pino `redact` as a build-time backstop.)*
> - **§A17** no free-form spec mechanism anywhere. **§A18** purge window = 180 days. **§A20** admin category edit uploads `image` on top cats too (deliberate exception to activate/deactivate-only).
> - **🔴 M2↔M3 — `Product.categoryId` = leaf/sub only** (`parentId` set); reject top categories (else M3 `type`/facets/form break). Form: top → sub (leaf stored). **`country` is NOT on Product** (as its own field) — M3's country facet uses the seller's `Organisation.country`, carried via **§A23's denormalised internal-only `sellerCountry` + `sellerVerified`** (Atlas `$search` cannot join; synced on org verify/demote/country-edit; never public). **§A24:** per-seller takedown count = persisted **`Organisation.takedownCount`** (increment-only; purge-proof).

> Best practice: **har category ka alag schema NAHI**. Ek `Category`, ek `Product`, aur category-specific fields ek alag `CategoryAttribute` model me (data-driven). 40 alag schemas = 40 collections, har naye category pe code change + migration + search nightmare. Data-driven me admin bina code touch kiye category add/edit karta hai.

---

## Kyun data-driven (alag schema nahi)

- **Ek naya category** = bas ek `Category` doc + kuch `CategoryAttribute` docs. Koi code change nahi, koi deploy nahi.
- **Search/filter** ek jagah — sab products ek collection me, attributes indexed.
- **Admin CRUD** se poora control — category aur uske fields dono runtime pe manage.
- Product model ek hi rehta hai (goods + services + Other, sab ek me — pehle decide hua tha "services same Product model me, no separate entity").

---

## 3 models

### 1. `Category`
```js
{
  name,            // "Textiles, Fabrics & Yarn"
  slug,            // "textiles-fabrics-yarn"  (unique)
  parentId,        // null = top-level; warna parent Category (tree)
  type,            // 🔴 §A14 'goods' | 'service' (no 'either'); §A16 REQUIRED on subs (parentId set), ABSENT on top cats (parentId null — derived from children at read time)
  active,          // Boolean (admin toggle)
  order,           // Number (display order)
  image            // 🔴 §A11 optional Cloudinary URL (card render; §A20 admin upload, top cats pe bhi) — purana `icon` naam isi me merge
}
```
- `type` form ka behaviour decide karta hai:
  - `goods` → MOQ + trade fields (HS code, origin, supply ability, lead time, packaging)
  - `service` → engagement type, delivery model, team size, pricing model, timeline (no MOQ)
  - ~~`either` → seller khud Goods/Service chune~~ — 🔴 REMOVED (Part A §A14): "Other" ab do typed subs (Other goods / Other services); type category se aata hai, seller manually nahi chunta.
- Tree `parentId` se banta hai. Products **leaf/sub-category** se map hon.

### 2. `CategoryAttribute`  (har category ke apne fields, as data)
```js
{
  categoryId,      // ref Category
  name,            // "GSM", "Material", "Purity %"
  key,             // "gsm"  (stable machine key — search/filter ke liye)
  inputType,       // 'text' | 'number' | 'select' | 'boolean'
  options: [],     // sirf select ke liye  ["Cotton","Silk",...]
  unit,            // optional  "gsm", "kg"
  required,        // Boolean
  filterable,      // Boolean — discovery filter me dikhe ya nahi
  order            // Number
}
```

### 3. `Product`  (common fixed + category-specific dynamic)
```js
{
  exporterOrgId,   // owner (ownership scoping)
  categoryId,      // ref Category  (type isi se resolve)

  // common (sab):
  name, description,
  images: [],      // Cloudinary URLs
  price: { mode: 'fixed'|'range'|'on_request', min, max, currency },

  // goods-only (category.type === 'goods'):
  moq, unit, hsCode, countryOfOrigin, supplyAbility, leadTime, packaging, terms,

  // service-only (category.type === 'service'):
  engagementType, deliveryModel, teamSize, pricingModel, timeline,

  // category-specific values (dynamic):
  attributes: [ { attributeId, key, value } ],

  status,          // 🔴 Part A §A1: 'draft' | 'active' | 'inactive' | 'archived' (draft = default, ONE-WAY). Seller toggle, no approval — B6. NO isActive on Product.
  slug,            // 🔴 Part A §A6: unique, indexed; archive marker appended on archive
  sellerCountry,   // 🔴 §A23 denormalised org.country (internal-only, NEVER public) — Atlas facet ke liye
  sellerVerified,  // 🔴 §A23 denormalised verified boolean (internal-only, NEVER public) — ranking boost; org verify/demote/country-edit pe sync
  createdAt, updatedAt
}
```

---

## Kaam kaise hota hai (flow)

1. Seller **category select** kare.
2. Us category ki **`CategoryAttribute` list** load ho → wahi fields form me render.
3. `category.type` se **goods/service** fields dikhein ('either' removed — Part A §A14).
4. Seller values bhare → `Product.attributes[]` me `{ key, value }` save.
5. Discovery/search **`attributes.key` + `value`** pe chale (indexed).

---

## Key design choices (best practice)

- **`attributes` = array of `{key, value}`, NOT plain object.**
  Array pe MongoDB index lagta hai (`attributes.key`, `attributes.value`) → fast filter. Plain object `{gsm:120}` me dynamic keys pe index nahi lagta → filter slow + ugly. **Array rakho.**
- **`key` stable rakho** (rename-safe). Display `name` badle to bhi `key` na badle — purane products tootenge nahi.
- **`type` category pe** — seller ko goods/service manually nahi poochna (sirf "Other" me poochhte hain).
- **D1 cap** status se juda: unverified exporter ke max 3 **active** products (inactive/draft count na karein).

---

## 2 chhote decisions (schema lock karne se pehle)

1. **`attributes.value` ka type** — sab string (simple, par numeric range filter "GSM 100–150" theek se nahi chalega) **ya** mixed string/number/boolean (numeric filter chalega). → Recommend: **mixed**.
2. **Naya product default state** — `active` (turant live) ya `draft` (seller publish kare tab live). → Recommend: **draft** (poora bhar ke publish), par ek extra state add karta hai.

Ye do tay hote hi teeno models ka **final Mongoose schema** (indexes + validation + ownership-scoping ke saath) likh dunga.

---

## Conflict-check (purane decisions ke against — clean)
- ✅ "Category product-level" — Product me `categoryId`, aligned.
- ✅ "Services same Product model" — ek Product model, `type` se differentiate. Aligned.
- ✅ "Category-specific fields structured (free-form nahi)" — `CategoryAttribute` model. Aligned.
- ✅ "Pricing fixed/range/on-request" — `price.mode`. Aligned.
- ✅ "B6 no approval, active/inactive toggle" — `status`. Aligned.
- Koi conflict nahi.