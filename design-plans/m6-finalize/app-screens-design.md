# M6 · FINALIZE — App Screens — Design Brief

> **Short answer: FINALIZE adds no app screens.** Every FINALIZE surface with real UI is
> admin-side, and admin is **web-only** on this platform (governance and moderation never ship in
> the app; note also CLAUDE.md rule 6's web-only posture for approvals). The mobile app is
> party-side (buyer / exporter), and no F-item gives a party a new screen.
>
> **Sources:** `modules-in-detailed/m6-Finalization/MPX-FINALIZE-Module.md` ·
> `build-plans/m6-finalize/backend-plan.md` · `docs/Note.md`. Companion:
> `design-plans/m6-finalize/web-screens-design.md` (which carries everything FINALIZE does design).

---

## 1. Screen inventory

None. Do not design any app screen for M6.

---

## 2. Where FINALIZE behaviour is *visible* in the app — designed elsewhere

These are effects an app user can experience because of FINALIZE work. None needs new artwork
here; each is a state of a screen that belongs to another module's brief.

| FINALIZE item | What the app user sees | Where it is designed |
|---|---|---|
| **F1 · account block — sessions** | A user of a blocked company is signed out everywhere and their next login fails with the same generic **"Invalid credentials"** as any other failure. No "your account is blocked" screen exists, and none should be invented — the generic message is deliberate | M1 login screens (generic-error rule) |
| **F1-B · products into takedown** | A blocked exporter's listings disappear from public search/browse; the exporter's own catalogue shows them taken down with the block reason ("Account blocked by MPX Global") | M2/M3 catalogue + discovery briefs — takedown states already exist there; the block only supplies a reason string |
| **F1-B · chats freeze** | Conversations involving a blocked company freeze with a third freeze reason, `account`, alongside the existing per-thread and per-product freezes | **M4's brief** — frozen-thread states are designed there once, covering all freeze reasons. Cross-reference; do not duplicate. Only check that its frozen-state copy is generic enough to cover an account-level freeze without leaking why |
| **F5b · featured landing content** | *Potentially* a curated home feed: `GET /public/featured` is public and returns banners + featured products/categories/suppliers in one call, so an app home screen could mirror the web landing strips | The app home belongs to whichever milestone designs the app's public/discovery screens — not M6. If built, follow the web brief §4a rules: same public cards as everywhere else, empty groups hidden, self-healing silent |
| **F-A · error log viewer** | Nothing directly — but the viewer's value depends on app error states showing the **support reference code** (`requestId`), which is what staff search for. A component-level convention, not a screen | Each module's app error states |

## 3. Do not design

- **Anything admin** — error viewer, featured manager, block controls, cascade status. Web-only.
- **D4 TOTP screens** — ON HOLD (`docs/Note.md` D4); staff log in on the web anyway, so even when
  D4 is restored at close it is expected to need **no app screens**.
- **A "your account is blocked" screen or banner** — the block deliberately presents as generic
  invalid credentials (F1); a dedicated screen would leak the block's existence.
- **F6 / thresholds, F2 / purge, D5 / notification centre, D6 / request-unblock** — closed,
  cancelled or on hold; see the web brief §5 for sources.

## 4. Gaps

1. Whether the app gets a featured-content home strip at all is an open product question for the
   app milestone — FINALIZE only guarantees the endpoint exists.
2. An M4 app brief carrying the frozen-chat states was assumed above; if it does not exist yet,
   the `account` freeze reason must be folded into it when written.
