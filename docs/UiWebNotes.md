# Web UI — Non-operational elements ledger

> **Rule:** `.claude/rules/web-ui-notes.md` (STRICT). **Every** rendered button, link, form,
> toggle, tab, filter, menu item or control that is **not yet wired to real behaviour** MUST be
> logged here — in the same change that creates it. No exceptions, nothing too small to skip.
>
> When you wire an element up, set its **Status → Done** (or delete the row). Keep this honest.
> Prefer not shipping dead controls at all; if a placeholder must exist, make it visibly
> non-final (`disabled` / "coming soon") so no user thinks it works.

Status legend: **Pending** = renders but does nothing real · **Done** = wired to real behaviour.

| Date | Page / Component | Element (label) | What's missing / expected behaviour | Why deferred | Status |
|------|------------------|-----------------|-------------------------------------|--------------|--------|
| _—_ | _(none yet — no web frontend built)_ | | | | |

---

## ⚠️ API contract changes the web screens must follow

Backend response shapes that changed after the web was designed. A screen still reading the OLD
field will break silently.

### 2026-07-30 · A21 · `organisation.type` → `buyerSide` / `exporterSide`

`Organisation.type` is no longer `buyer`/`exporter` (it is now `business`/`platform`, and NOT a
buyer-vs-exporter discriminator). Three response shapes **dropped `type` and now return two
booleans `buyerSide` + `exporterSide`** instead. Update any screen that read `org.type` to decide
buyer-vs-exporter — read the flags:

| Endpoint(s) | Object | OLD field | NEW fields |
|---|---|---|---|
| `POST /employee/buyers/:id/approve\|reject`, `POST /employee/exporters/:id/verify\|reject` | `organisation` | `type: 'buyer'\|'exporter'` | `buyerSide`, `exporterSide` (booleans) |
| `GET /admin/users`, `GET /admin/users/:id` | `user.org` | `type` | `buyerSide`, `exporterSide` |
| `GET /employee/orgs/:id/kyc/documents` | top-level | `type` | `buyerSide`, `exporterSide` |

(One company may have both sides true — a screen must not assume exactly one.)
