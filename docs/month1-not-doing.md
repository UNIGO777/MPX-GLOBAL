# MPX Global — Phase 1 · Month 1 me **KYA NAHI** (baad me)

> Ye wo sab hai jo **month 1 / first draft** me **nahi** ban raha. Do bucket:
> **(A)** Phase 1 hi hai par month-1-ke-baad · **(B)** Phase 2 (is phase me hai hi nahi).
> "Deferred" ka matlab **"kabhi nahi" NAHI** — bas is mahine / first draft me nahi.
>
> **Authoritative Phase-1 scope:** `docs/scope-of-work.md`. **D-items (never-build / on-hold):**
> `docs/Note.md`. **Enforcement:** `.claude/rules/scope-guard.md` (+ `remind.md`).
>
> 🔴 **Agar koi task is ledger ke kisi item ko chhuye — ya scope se bahar jaaye — pehle STOP,
> loud RED ALERT, explicit owner confirmation ke baad hi build.** (Rule: `scope-guard.md`.)
>
> _Content abhi backend-focused hai, par boundary poore build (backend + web + mobile) pe lagti hai._

---

## BUCKET A — Month-1-ke-baad (Phase 1, bas is mahine nahi)

### A1 · Quotation & Negotiation (Module 4) — poora
- Seller template quote banana + apni list se product select
- Buyer ko chat me quote → **Accept / Negotiate** buttons
- Negotiate → amount field → counter-offer seller ko wapas, back-and-forth
- Naya quotation → assigned employee ko email alert
- Quotation status + full history
- *(`Quotation` model skeleton hai — endpoints month 1 me nahi)*

### A2 · Employee panel — employee-specific pieces (Module 6)
> Shared operational endpoints (approve/verify, product monitoring, chat monitoring, buyer/seller
> mgmt, category, audit view) month 1 me **ban rahe hain** super admin ke liye. Wo deferred NAHI.
> Deferred sirf ye employee-only cheezein:

- **Ticket / query handling** — open/in-progress/resolved queue, assign/respond/resolve
  - ⚠️ **DECISION PENDING:** owner ko decide karna hai — minimal ticket create+list month 1 me
    chahiye ya poora deferred. **Abhi deferred maan ke rakha hai.**
- **Enquiry routing** — employee buyer ko seller se manually connect kare *(buyer khud
  enquiry+chat month 1 me hai; ye employee-routing layer baad me)*
- **Internal notes** — sellers / conversations pe
- **Per-employee "sirf mere assigned modules" dashboard**
- **Per-employee scoped reports**
- **Employee create + permissions assign ka UI** *(backend hard superadmin-gate hai, UI baad me)*

### A3 · Notification layer (Module 8) — OTP ke aage sab kuch
> ✅ **PARTIAL CARVE-OUT — 2026-07-31, owner ne explicitly confirm kiya:** **FCM push ab month 1 me
> hai**, M4 (Enquiry & Chat) ke andar. Ye **scope change NAHI** — notifications quote ka Module 8
> hai, Phase 1 me pehle se; sirf **schedule** aage khiska. **Sirf itna approved hai:**
> `firebase-admin` + `DeviceToken` model (register/unregister) + dead-token cleanup + **do event**
> (nayi enquiry → seller, naya message → doosri party). 🔴 **Baaki A3 ab bhi deferred hai aur
> red-alert maangta hai** — neeche ki list me se sab kuch chhod kar wo do event.

- `Notification` model + in-app notification centre
- ~~Push (Firebase FCM) — web + app~~ → ✅ **month 1 me le liya (upar dekhein)**; iske aage ka push
  (non-M4 events, admin controls) ab bhi deferred
- Email notifications (OTP ke alawa)
- WhatsApp notifications (approved provider + template approval)
- Admin control: har notification type enable/disable/edit
- Delivery-tracking + retry handling
- *(Month 1 me sirf OTP flows)* — see `docs/Note.md` **D5**.

### A5 · Seller "request unblock" for a taken-down product (Module 2 moderation)
- Admin ne product **takedown** kiya → seller **unblock request** bhej sake (appeal path).
- Admin approve/reject kare; approve = existing `POST /admin/products/:id/restore`.
- **Month 1 me nahi** — owner ne **~2026-08-28** (1 month baad) ke liye kaha (recorded 2026-07-28).
- Abhi month-1 me sirf itna: seller apni listing pe `takedown.reason` + date dekhta hai
  (Part A §A9, **`byUserId` kabhi nahi**) — koi request/appeal endpoint nahi.
- Full detail + build-time constraints: `docs/Note.md` **D6**.

### A6 · Automated KYC document verification (Module 1 / 5 — verification)
- **Owner ne 2026-08-03 ko "ek mahine baad" ke liye kaha** (~2026-09-03). Month 1 me nahi.
- **Aaj kya hota hai:** upload pe sirf **magic-byte** check (`file-type`) hota hai — wo saabit karta
  hai ki file sach me PDF/JPG/PNG/WEBP hai, **ye bilkul nahi ki usme document hai**. Koi bhi photo
  pass ho jaayegi. Asli verification **insaan** karta hai — Employee `kyc:view` se signed URL khol
  ke verify/reject karta hai. Wahi poora control hai, aur wo **kaam kar raha hai** — ye gap nahi,
  design hai.
- **Baad me kya add hoga (kamzor → mazboot):**
  1. **OCR + format validation** — PAN `[A-Z]{5}[0-9]{4}[A-Z]`, GSTIN 15-char (usme chhupa PAN
     company ke PAN se match), naam ka org-name se match. Galat tasveer pakadta hai, **forged
     document nahi**.
  2. **Government / aggregator API** — **GSTIN lookup pehle** (legal name + status wapas aata hai,
     B2B exporters ke paas GST hota hi hai → sabse sasta, sabse zyada faayda). Phir PAN (Protean/
     NSDL), CIN (MCA). Aggregators: Signzy · IDfy · Karza(Perfios) · HyperVerge · Digio.
  3. **DigiLocker** — issuer-signed document, cryptographically verifiable. Sabse mazboot, sabse
     bhaari. Realistically Phase 2.
- ⚠️ **OCR akela mat lagana** — wo *bharosa* deta hai bina *suraksha* diye, aur reviewer dhyaan
  dena kam kar dega. Uske saath verification ka koi asli source hona chahiye.
- 🔴 **Ye scope change hai, koi bhi API lene se pehle client se baat:** nayi dependency + **per-
  verification recurring cost** + vendor contract. Quote me "verification" hai, par wo **employee
  manual review** hai — automated document verification kahin likha nahi.
- 🔒 **Aadhaar ka compliance sawaal ISME NAHI hai** — wo alag aur pehle wali cheez hai, aur
  `docs/Note.md` ki **project-close checklist** me hai. Ise is item ke saath mat taalna.

### A4 · Cross-cutting (close se pehle)
- **TOTP 2FA (D4)** — 🆕 **2026-08-23: owner ne isse MONTH 2 me daala** ("ye chodna h isse after
  1 month me dalo"). Yaani ab ye ek **scheduled Bucket-A item** hai, khula sawaal nahi — **month 1
  me iska alert nahi chahiye**, auth chhune pe baar-baar mat uthao.
  🔴 Jo **nahi** badla: ye **deferral hai, cancellation nahi**, aur `auth-sessions` **A4** ka
  committed control hai. Month 2 bhi bina iske nikal gaya to **close pe phir uthana hoga**
  (`docs/Note.md` project-close checklist wahi guard rakhti hai). Tab tak staff **OTP** pe hain —
  yaani control kamzor hai, gayab nahi. Detail: `docs/Note.md` **D4**.
- App store submission, demo accounts, privacy policy / data-safety (M3)
- Tuning, corrections, edge-case fixes, device testing

---

## BUCKET B — Phase 2 (is Phase me hai hi nahi — alag quote)

- Escrow & milestone payments
- Payout governance & approval queue
- AI contract generation & eSign
- Semantic AI search (embeddings)
- Trust score & deeper verification
- GPT chat-analysis (suspicious activity flagging)
- Platform chatbot
- Full AI suite (matchmaking / advisor / concierge)
- Order management + shipment tracking
- Directories, investment & trade financing
- Premium network, subscriptions & monetisation
- Deep analytics
- Further employee-panel enhancements

**Ye models skeleton pade hain — na chhuna, na delete karna:**
`Escrow` · `Contract` · `Order` · `Shipment` · `PayoutAccount` · `PayoutRequest` · `Milestone` ·
`TrustScore` · `Investment` · `Incentive` · `Subscription` · `PremiumApplication`

---

## Net
Month 1 / first draft se **bahar**: **Quotation (Module 4)**, employee-only pieces (Module 6 ka
hissa), **Notifications (Module 8)**, **seller unblock-request (A5)** — sab month-1-ke-baad. Aur poora **Phase-2** stack (Bucket B).
Month 1 me **ban raha**: Module 2 (catalogue/discovery), Module 3 (chat + AI search), Module 5
(super admin) + shared employee-ops endpoints.

_(Naya deferral aaye to yahan add karo. Behaviour/never-build guards → `docs/Note.md`.)_
