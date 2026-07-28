# MPX Global — Phase 1 · Module 3 · **SavedItem Model** (+ validations)

> ## 🔴 Part A overrides (authoritative — supersede this reference doc)
> - **§A13 — the ownership field is `orgId`, not `orgId`, and ANY org can save** (exporters buy too). Unique compound `(orgId, targetType, targetId)`, index on `orgId`, ownership-scoped reads/deletes (`findOne({ _id, orgId })`). Every `orgId` below now reads `orgId`.
> - **§A5 — seller delete is ALWAYS soft** (`status = 'archived'`) — **no** draft=hard / published=soft branching, **no** hard delete. The single exception is the admin **§A8** 90-day blocked-product purge (a cleanup job, not a user action).
> - **§A7 — archived rows are kept indefinitely.** Availability in the saved list: temporary-unavailable (inactive / taken-down / category deactivated) **stays**, flagged "currently unavailable"; **archived → removed** (cleanup).

> Discovery & Search ka **ekmatra naya model**. Buyer product ya supplier "save/favourite" kare. Baaki M3 (search, filters, AI search) koi naya model nahi — sab existing Product/Category/Organisation pe query.

---

## 1. Model — `SavedItem` (polymorphic)

```js
SavedItem {
  orgId,        // ref Organisation — kis buyer ne save kiya
  targetType,        // 'product' | 'supplier'
  targetId,          // ref Product (agar product) YA Organisation (agar supplier)
  savedAt,           // Date
  createdAt, updatedAt
}
```

**Polymorphic design kyun:** ek hi model dono cheezein handle karta hai —
- Product save → `targetType: 'product'`, `targetId: <productId>`
- Supplier save → `targetType: 'supplier'`, `targetId: <sellerOrgId>`

Alag `SavedProduct` / `SavedSupplier` models banane ki zaroorat nahi. Future me `targetType: 'category'` bhi easily add ho sakta hai.

---

## 2. Indexes

- **Unique compound:** `(orgId, targetType, targetId)` — ek buyer same cheez **do baar save na kar sake** (duplicate block).
- **`orgId`** — buyer ki saved-list fast aaye.

---

## 3. Validations & availability rules (ZAROORI)

Problem: buyer ne product save kiya, phir wo product **hat gaya / hide ho gaya** (seller, admin, ya future employee ki side se) — to saved-list me stale/dead entry nahi dikhni chahiye.

### 3.1 "Unavailable" kab maana jaaye (kisi bhi source se)
Ek saved product/supplier tab **saved-list me nahi dikhega** jab:
- Product `status` = `inactive` ya `draft` (seller ne hide/unpublish kiya)
- Product **takedown** ho (admin ne — ya future me permission wala employee ne — moderate kiya)
- Product ki **category deactivate** ho (cascade se hidden)
- Product **archived/removed** ho (soft-delete)
- Supplier (Organisation) **deactivate/suspend** ho

Yaani seller-side, admin-side, ya employee-side — **kahin se bhi** cheez unavailable hui, saved-list se effectively hat jaaye.

### 3.2 Temporary vs Permanent — do alag behaviour
| Product ko kya hua | Saved-item me | Buyer ko dikhta |
|---|---|---|
| **Inactive / hide** (temporary, wapas aa sakta) | **rahega** | "currently unavailable" |
| **Category deactivate / takedown** (temporary) | **rahega** | "currently unavailable" |
| **Soft-delete / archive** (permanently gaya) | **hata do (cleanup)** | list se gaayab |
| **Hard-delete** (🔴 §A5: only the admin §A8 90-day blocked purge — never a seller/draft delete) | **hata do (cleanup)** | list se gaayab |

- **Temporary gone** → saved-item me **raho**, product detail pe "currently unavailable" (buyer wait kar sakta hai, wapas active hone pe milega).
- **Permanently gone** → saved-item se **cleanup** (post-delete hook/cascade) — koi dead entry na bache.

### 3.3 Seller delete logic (🔴 Part A §A5 — supersedes the hard-vs-soft branching)
Seller apne product delete kar sakta hai. **Always soft — no branching:**
- **Any product (draft ya kabhi-live)** → **SOFT delete** = `status = 'archived'`. Seller ke liye gaayab + har jagah hidden, par record + references safe. Koi hard delete nahi (na draft pe).
- UI ek hi "Delete" dikhata hai; backend hamesha archive karta hai (published/refs check ki zaroorat nahi).
- **Chat/enquiry pe asar nahi** — archive me record rehta hai, chat history intact, product detail pe "not available".
- **Only exception:** admin **§A8** 90-day blocked-product purge (cleanup job, not a seller action).

### 3.4 Enforce kaise
- **Display:** saved-list read pe target ka current status lookup — temporary-unavailable ko "currently unavailable" tag ke saath dikhao.
- **Cleanup:** permanent delete (soft-archive ya hard) pe us product ke `SavedItem` rows **hata do** (Mongoose post-delete hook ya cascade).
- Ye seller/admin/(future) employee — kisi bhi source se delete ho, same tarike se handle hota hai.

## 4. Endpoints

- `POST /saved` — save (`{ targetType, targetId }`); duplicate → unique index se block
- `DELETE /saved/:id` — unsave (ownership-scoped: `findOne({ _id, orgId })`)
- `GET /saved` — buyer ki saved-list (**read-time availability filter applied**), optional `?targetType=product|supplier`
- Sab buyer-scoped, default-deny.

---

## 5. Conflict-check (locked decisions ke against) — ✅ clean
- SavedItem M3 me (M2 se yahan move kiya) — consistent.
- Admin = **takedown, not hard delete** (M2 locked) — is doc me respect kiya; "delete" ko soft-delete treat kiya. 🔴 **Except Part A §A8**: blocked > 90 days → purge (with audit snapshot).
- Temporary-unavailable saved rehta hai ("currently unavailable"); permanent-gone cleanup hota hai — B7/active-only/cascade rules ke consistent.
- Koi conflict nahi.

---

## 6. Resolved decisions
- Temporary-unavailable → saved-list me **greyed "currently unavailable"** (rakho).
- Permanent-gone (delete/archive) → saved-list se **hata do** (cleanup).
- Seller delete: **always soft** (`status: archived`) — no draft=hard branching (Part A §A5). Only hard delete = admin §A8 90-day blocked-product purge.