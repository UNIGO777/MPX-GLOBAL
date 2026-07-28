# MPX Global — Phase 1 · Month-1 Backend · **Module Breakdown**

> Har module = ek **vertical slice**: us domain ki saari cheezein ek jagah — models, user/seller/buyer routes, aur us domain ke **super-admin/management + KYC + approval routes bhi isi module me**.
> Quote ke 8 client-facing modules inhi **5 backend domain-modules** me pack ho jaate hain.
> Status tags: ✅ done · 🔨 build (month 1) · ⏸ deferred

---

## Module 1 — Identity & Access
**(Auth + Users + Organisations + KYC + Verification + User Management)**

**Models:** `User`, `Organisation`, `AuditLog`

**Auth (sab panels)** — ✅ done
- Buyer & exporter self-signup; employee superadmin-created (not self)
- Login → OTP → access + refresh tokens; refresh rotate + reuse→family-revoke
- Logout, forgot/reset password, `/auth/me`
- Default-deny RBAC, ownership scoping, session invalidation

**Employee & permissions** — 🔨 build
- `POST /admin/employees` — superadmin banaye ✅ *(2026-07-28: `admin` role hata — superadmin-only)*
- Per-employee permission assignment — **hard superadmin-gate** (permission-flag nahi, warna privilege escalation)

**KYC process** — 🔨 build (ye tumhara main naya point)
- Document upload:
  - **Business hai** → business ID proof: company registration, GST/tax, certificates
  - **Business nahi hai** → personal ID proof (PAN / Aadhaar / passport type)
- Cloudinary **signed expiring URLs**; `kycDocuments` **select:false** (A7) — public URL store nahi
- `kycStatus`: `pending → submitted → verified / rejected`

**Verification & approval** — ✅ done + 🔨 extend
- Buyer approve/reject ✅ · Exporter verify/reject-with-reason ✅ → `kycStatus` flip + append-only AuditLog
- **Verified tick (B7)** — profile signup se public, verify pe tick (visibility gate nahi)
- **Resubmit after rejection** — 🔨 build (rejected → wapas pending)

**Super admin — user management** — 🔨 build
- Buyers / sellers / employees list + search
- Activate / deactivate
- KYC docs view (permissioned)

**Hardening** — 🔨 build
- `mustChangePassword` enforce (employee first login pe reset)
- Auth-event audit (login/signup/refresh-reuse → AuditLog)
- Real OTP delivery provider (abhi terminal-only)

**Guards:** A2 nuance (buyer/exporter self-register → `mustChangePassword: false`; employee → `true`); default-deny; not-found → 404 not 403

---

## Module 2 — Catalogue
**(Categories + Products + Monitoring)**

**Models:** `Category`, `Product` — 🔨 build

**Seller-facing** — 🔨 build
- Product create / edit / apni list
- Images — Cloudinary (web + app camera/gallery)
- Fields: name, description, `categoryId`, specs, price, currency, MOQ, unit
- Active / inactive toggle (seller ka apna)

**Categories** — 🔨 build
- Public read (discovery + product form ke liye)
- Admin CRUD (managed tree)

**Super admin / employee — monitoring** — 🔨 build
- Naye products + kaunse seller ke (view-only)

**Guards:** **B6** — koi approval state nahi (sirf monitored); **D1** — unverified seller max **3 active products**, verify pe cap hatta; tenant-scoped by `orgId`

---

## Module 3 — Discovery & Search
**(Public browse + Filters + AI search + Saved items)**

**Models:** `Product`/`Organisation` use + `SavedItem` (favourites) — 🔨 build

**Public (bina login)** — 🔨 build
- Product listing + text search
- Filters: category, **country (ISO alpha-2)**, price range, MOQ
- Product detail page data
- Public seller/exporter profile + uska catalogue
- **B7** — `kycStatus` response me, koi filter nahi (tick ke liye)

**Buyer** — 🔨 build
- Saved items (products & suppliers) save / unsave / list

**AI search** — 🔨 build
- `POST /search/ai` — **single OpenAI call**: query → keywords/filters (category tree pe map) → normal search → `{ results, explanation }`
- Sirf OpenAI, embeddings nahi, per-user rate-limit, fail pe normal search pe **fallback**

---

## Module 4 — Enquiry & Chat
**(Enquiry + Conversation + Messages + Live chat monitoring)**

**Models:** `Inquiry`, `Conversation`, `Message` — 🔨 build *(chat models pehle confirm karo exist karte hain ya nahi)* — sab **B1 parties-scoped**

**Buyer / seller** — 🔨 build
- Buyer enquiry raise (product ya seller pe) → **conversation khule**
- Seller enquiries dekhe / respond kare
- Real-time chat (Socket.io) — live messages, unread indicators, image/doc attachments
- Message history (REST, pagination)

**Socket** — 🔨 build
- Authed handshake (JWT + `tokenVersion`)
- Har event pe **parties membership server-side re-check** (client trust nahi)

**Super admin / employee — live chat monitoring** — 🔨 build
- Read-only, permission-gated (`chat:monitor`); month 1 me super admin

**Guards:** **B1** — `findOne({ _id, parties: req.user.orgId })`, IDOR-safe

---

## Module 5 — Admin Console
**(Cross-cutting governance — jo kisi ek domain ka nahi)**

🔨 build

- Master dashboard + overview counts (buyers, sellers, products, enquiries, verification breakdown) + basic analytics
- Audit log viewer — read-only, cross-domain (`AuditLog`)
- Featured / banner content (minimal, landing/discovery ke liye)
- Notification settings — **placeholder only** (poora notification layer ⏸ deferred, D5)

**Guards:** hard superadmin gate; audit view read-only

---

## Quote-modules → backend-modules mapping

| Quote module | Kahan gaya |
|---|---|
| 1 · Landing & Auth | Module 1 (Identity & Access) |
| 2 · Catalogue & Discovery | Module 2 + Module 3 |
| 3 · Chat & AI search | Module 4 + Module 3 (AI search) |
| 5 · Super Admin | Har module ka admin/management section + Module 5 (console) |
| 7 · Seller verification | Module 1 (KYC + verification) |
| 4 · Quotation · 6 · Employee panel · 8 · Notifications | ⏸ month-1-ke-baad |

---

## Net
Month-1 backend = **5 domain modules**. Module 1 (Identity) ka auth already ✅; baaki sab (KYC docs, user management, catalogue, discovery, chat, admin console) 🔨 build. Har module apne domain ke admin/management routes khud carry karta hai — alag "super admin sab kuch" module nahi, sirf cross-cutting console.