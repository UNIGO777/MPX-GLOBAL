# M5 · Mobile App Screens — Design Brief

> **0 screens.** M5 has **no mobile-app surface**, by design. This file exists so the milestone's
> design set is complete and so nobody infers the gap is an oversight.
> Companion: `design-plans/m5/web-screens-design.md` — the entire M5 console, 13 screens, web only.

---

## 1. Why there are no app screens

- **`modules-in-detailed/m5/m5.md` (header):** *"Surface: web only. Not in the mobile app."*
  `m5.md` §9 lists Mobile as out of scope with the reason **"Never — admin is web only."**
- **The app has two roles only — buyer and exporter** (`design-plans/m1/app-screens-design.md` §1).
  Employee and superadmin do not exist in the app: no staff login endpoint is reachable from it,
  no staff portal choice is offered, and nothing in the UI may hint at internal tooling.
- **Contractual rule:** approval and release capabilities are **web-only**; the mobile app never
  carries payment-release or governance capability (CLAUDE.md non-negotiable #6, and #5 — the
  app renders from server-supplied permissions and holds none of the staff ones).
- Practically: every M5 action (org block, takedown, verification, permission grants, audit
  reads) is a governance or audited-read surface. Putting any of it on a phone would duplicate
  the permission-filtered console shell for an audience of a handful of staff who have desks.

**Do not design, in any milestone:** an admin tab, a staff login screen, a moderation
notification, a "review this product" deep link, or any read-only staff viewer in the app. If a
future request asks for one, it is a scope change — red-alert first (`.claude/rules/scope-guard.md`).

## 2. What an M5 action means for the app (party-side effects only)

M5 actions land on app users as **ordinary party-side states that M1–M4 app screens already
design**. Nothing new to draw; listed so the console's effects are traceable:

| Console action | What the app user experiences | Designed where |
|---|---|---|
| **Org blocked** (cascade) | Every user of the org is signed out as their session invalidates; next launch lands on sign-in, where login fails as an inactive account. No special "you were blocked" screen exists or is designed | M1 app — splash/session-restore + login error states |
| **User deactivated** | Same: signed out on next request, login refused | M1 app |
| **Product taken down** | The seller sees the takedown **reason and date** on their own listing — never *who* acted. Buyers simply stop finding it | M2 catalogue screens (seller view) |
| **Chat blocked / org-block freeze** | Both parties see the thread frozen with its reason label; composer disabled | M4 chat screens |
| **Verification decided** | Tick appears (or rejection reason + resubmit path on the owner's own screens) | M1 app — verification status screens |
| **Category deactivated / featured content changed** | Content quietly appears or disappears from browse/landing surfaces | M2/M3 screens — no state needed |

The one design obligation these impose already exists in the M1/M4 briefs: **generic copy**. The
app never says "your account was blocked by an admin" on the login screen (it is the same
"Invalid credentials" / inactive-account handling as any other refusal), and a frozen chat shows
its reason label without naming the acting staff member.

## 3. Checklist

- [ ] No staff-facing screen, control, or copy anywhere in the app
- [ ] Session-invalidation (block/deactivate) falls through the existing sign-in flow gracefully
- [ ] Takedown and freeze reasons render verbatim where M2/M4 screens already place them —
      never the acting admin's identity
