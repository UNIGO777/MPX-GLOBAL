# Phase 1 — Model Design Decisions

Ye full-engagement wale model-decisions ka **Phase 1 version** hai. Fark sirf itna:
Phase 1 me escrow, payment, contract, order, shipment, milestone hain hi nahi —
to unse jude decisions (B1, B2, B3, B5, aur C3 ka payment context) yahan badle
gaye hain. Baaki (User/Org/AuditLog, eslint, argon2, dev DB) waise ke waise hain,
kyunki auth Phase 1 me bhi utna hi zaroori hai.

Ye file `docs/model-decisions.md` me rakho.

---

## Phase 1 me kaunse models active hain

**Active (in par kaam karo):**
`User` · `Organisation` · `AuditLog` · `Product` · `Category` · `Inquiry` ·
`Quotation` · `Lead` · `Ticket` · `Notification` · (+ chat ke liye `Conversation`
+ `Message`)

**Skeleton — Phase 2 ke, abhi chhuo mat, delete bhi mat karo:**
`Escrow` · `Contract` · `Order` · `Shipment` · `PayoutAccount` · `PayoutRequest` ·
`Milestone` · `TrustScore` · `Investment` · `Incentive` · `Subscription` ·
`PremiumApplication`

---

## PART A — User / Organisation / AuditLog (Phase 1 me bhi same)

Ye saare full-engagement wale jaise hi hain. Auth Phase 1 ka core hai, to inme
koi change nahi. Sirf ek chhoti baat A2 me — neeche.

**A1 · Mobile number ka shape** — same.
`countryCode`, `number`, aur normalized `e164`. Unique index aur saare lookups
`e164` pe. Buyers international hain, plain string me duplicate detection tootegi.

**A2 · Password required** — same, par ek Phase 1 nuance.
`passwordHash` required, saath me `mustChangePassword` (default false).
- **Buyer aur exporter/seller** Phase 1 me KHUD self-register karte hain — wo
  apna password khud set karte hain, `mustChangePassword: false`.
- **Employee** account admin banata hai credentials ke saath →
  `mustChangePassword: true`, first login pe reset force.
(Fark full-engagement se: wahan exporter bhi employee banata tha. Phase 1 me
exporter self-register karta hai, to uske liye mustChangePassword true nahi.)

**A3 · Platform staff ka orgId** — same.
Ek `Organisation` `type: 'platform'` banao, employee + superadmin sabko uska
orgId do. orgId kabhi null/optional nahi — ownership scoping (A6) ke middleware me
special case na aaye.

**A4 · 2FA backup codes** — same.
Hash karke, `{ codeHash, usedAt }` array, use pe usedAt set (delete nahi),
poora field `select: false`. Super Admin ke 2FA ke liye.

**A5 · Organisation name uniqueness** — same.
Name pe unique index NAHI. Chahiye to `{ registrationNumber, country }` pe
compound unique **sparse**, aur verification ke waqt enforce, signup pe nahi.

**A6 · Address ka shape** — same.
Structured subdoc: line1, line2, city, state, postalCode, country.
country **ISO 3166-1 alpha-2** (`IN`, `AU`, `AE`). Discovery me country filter hai.

**A7 · kycDocuments select:false** — same.
`select: false`, aur documents alag permissioned endpoint se, Cloudinary **signed
expiring URL** se — public URL store nahi. (Verification ke liye seller documents
upload karta hai.)

**A8 · Audit timestamp vs createdAt** — same.
Dono: `occurredAt` (service set kare) + `createdAt` (mongoose). Index occurredAt pe.

---

## PART B — Scoping aur skeleton decisions (Phase 1 ke hisaab se BADLE)

**B1 · Two-party scoping — Phase 1 me sirf Inquiry aur Quotation pe**

Full-engagement me Deal/Contract/Order/Shipment/Escrow sab two-party the. Phase 1
me un me se koi nahi. Phase 1 me buyer↔seller ke beech sirf ye hain:
**Inquiry, Quotation, Conversation/Message.**

To in par same `parties` pattern lagao:
- `buyerOrgId`, `exporterOrgId` (role-specific logic ke liye)
- **`parties: [orgId]`** — indexed array, dono ka

Ownership scoping ka query hamesha `parties` pe:
`findOne({ _id: id, parties: req.user.orgId })`

Wajah wahi — single clean field query, har controller me `$or` repeat na ho,
ek jagah bhool jaane se IDOR na bane. Bas ab ye **Inquiry, Quotation,
Conversation, Message** pe lagta hai, deal-chain pe nahi (wo Phase 2).

**B2 · Escrow cardinality — Phase 1 me LAAGU NAHI**

Phase 1 me escrow hai hi nahi. Escrow model skeleton pada rahega, uspe koi kaam
nahi. Ye decision Phase 2 ke liye park kar do (jab escrow banega tab: ek Escrow
per Deal).

**B3 · Milestones — Phase 1 me LAAGU NAHI**

Phase 1 me payment milestones nahi (project ke commercial milestones aur baat hai
— wo code me nahi). Milestone model skeleton pada rahega. Ye decision Phase 2 ke
liye park.

**B4 · Tenant vs Platform documents — same, Phase 1 subset ke saath**

Do categories, har model explicitly declare kare:

| Type | Phase 1 ke active models | Scoping |
|---|---|---|
| **Tenant documents** | Product, Inquiry, Quotation, Conversation, Message, Ticket | `parties` ya `orgId` se scoped |
| **Platform documents** | Lead, Category, Notification, AuditLog | org se scope nahi, sirf **permission** se |

**Zaroori (same as before):** ownership helper ko har model ka type pata ho, aur
jis model ne declare nahi kiya uspe helper **error throw kare** — chup-chaap
unscoped na chhode. Default deny, "bhool gaye" pe fail.

Lead platform-owned hai par `assignedTo` (employee) rakhta hai — routing usi se.

**B5 · Investment/Incentive — Phase 1 me LAAGU NAHI**

Ye directories Phase 2 ki hain. Models skeleton pade rahenge, koi kaam nahi.
Park for Phase 2.

**B6 · (Naya, Phase 1) Product ka approval nahi, monitoring hai**

Product model me koi "approval" state machine mat banao. Phase 1 me employee sirf
**monitor** karta hai (kaunsa naya product, kaunse seller ka) — approve/reject
nahi. To Product pe bas normal active/inactive (seller ka apna toggle) rakho, koi
employee-approval field nahi.

**B7 · (Naya, Phase 1) Seller verification = kycStatus pe, visibility gate NAHI**

Exporter/seller signup pe `kycStatus: pending`. Employee verify kare →
`verified`. **Par public visibility ko verified ke peeche mat rakho** — Phase 1 me
(Girish sir ke decision se) sab sellers public dikhte hain, verified ko sirf tick
milta hai.

To: public product/seller queries me `kycStatus` **filter mat karo** — sab
laao, aur `kycStatus` field response me **bhejo** taaki frontend verified tick
dikha sake. `KYC_STATUS` enum (`pending/submitted/verified/rejected`) already
iske liye theek hai.

---

## PART C — Standing blockers (zyada same, C3 ka framing badla)

**C1 · eslint** — same.
Flat config, dev dependency. Custom rule: `findById` agar controllers/services me
dikhe to build fail — ownership scoping ka automated guard. (Ye already ho chuka.)

**C2 · argon2 native build** — same.
`npm approve-scripts argon2` khud chalao. Dikkat aaye to `@node-rs/argon2` —
same algorithm, prebuilt binaries, native compile nahi.

**C3 · Request sanitization — reject-not-strip (ye already ho chuka, framing note)**

Ye already reject-not-strip approach me ban chuka hai aur supertest se verified
hai — koi change nahi. Sirf ek framing note: full-engagement me ye "payment-
adjacent isliye extra zaroori" kaha gaya tha. Phase 1 me payment nahi, par ye
control **phir bhi utna hi zaroori** hai — `{"$gt":""}` type NoSQL injection se
login bypass har system me hota hai, escrow ho ya na ho. To ise Phase 1 me bhi
poori tarah rakho, kisi bhi tarah kamzor mat karo.

**C4 · Local MongoDB aur Redis** — same.
Docker se:
```
docker run -d -p 27017:27017 --name mpx-mongo mongo:7
docker run -d -p 6379:6379 --name mpx-redis redis:7
```
Mongo chalu hone ke baad database.js ko server.js me wire. Production me Atlas.

**C5 · Local .env** — same.
`.gitignore` me confirm, `git log` me kabhi commit nahi. `gitleaks`/`trufflehog`
history pe ek baar chala lena.

---

## Iske baad Claude Code se ye bolna

> Phase 1 ke decisions upar hain. Active models: User, Organisation, AuditLog,
> Product, Category, Inquiry, Quotation, Lead, Ticket, Notification, aur chat ke
> liye Conversation + Message. Baaki (Escrow, Contract, Order, Shipment, Payout*,
> Milestone, TrustScore, Investment, Incentive, Subscription, PremiumApplication)
> Phase 2 ke skeletons hain — inpe kaam mat karo, delete bhi mat karo.
>
> 1. Confirm karo User/Organisation/AuditLog A1–A8 ke hisaab se hain (mostly ban
>    chuke — bas A2 ka Phase 1 nuance check karo: buyer aur exporter dono
>    self-register, mustChangePassword false; sirf employee ke liye true).
> 2. Inquiry, Quotation, Conversation, Message pe `parties` scoping (B1) lagao.
> 3. Product pe koi approval state nahi (B6), aur public queries kycStatus filter
>    na karein — kycStatus response me bhejein (B7).
> 4. Phir Step 7 (token layer) pe badho.
>
> Har model ke baad batana kaunse tracker IDs cover hue.