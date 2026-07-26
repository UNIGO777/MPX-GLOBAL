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
- `Notification` model + in-app notification centre
- Push (Firebase FCM) — web + app
- Email notifications (OTP ke alawa)
- WhatsApp notifications (approved provider + template approval)
- Admin control: har notification type enable/disable/edit
- Delivery-tracking + retry handling
- *(Month 1 me sirf OTP flows)* — see `docs/Note.md` **D5**.

### A4 · Cross-cutting (close se pehle)
- **TOTP 2FA (D4)** — bana hua par on-hold; close se pehle restore
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
hissa), **Notifications (Module 8)** — sab month-1-ke-baad. Aur poora **Phase-2** stack (Bucket B).
Month 1 me **ban raha**: Module 2 (catalogue/discovery), Module 3 (chat + AI search), Module 5
(super admin) + shared employee-ops endpoints.

_(Naya deferral aaye to yahan add karo. Behaviour/never-build guards → `docs/Note.md`.)_
