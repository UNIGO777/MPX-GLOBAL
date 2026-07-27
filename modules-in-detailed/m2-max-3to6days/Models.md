# MPX Global — Category & Attribute Schema (Module 2)

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
  type,            // 'goods' | 'service' | 'either'
  active,          // Boolean (admin toggle)
  order,           // Number (display order)
  icon             // optional
}
```
- `type` form ka behaviour decide karta hai:
  - `goods` → MOQ + trade fields (HS code, origin, supply ability, lead time, packaging)
  - `service` → engagement type, delivery model, team size, pricing model, timeline (no MOQ)
  - `either` → seller khud Goods/Service chune (sirf **"Other"** category ke liye)
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

  status,          // 'active' | 'inactive'  (seller toggle, approval nahi — B6)
  createdAt, updatedAt
}
```

---

## Kaam kaise hota hai (flow)

1. Seller **category select** kare.
2. Us category ki **`CategoryAttribute` list** load ho → wahi fields form me render.
3. `category.type` se **goods/service/either** fields dikhein.
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