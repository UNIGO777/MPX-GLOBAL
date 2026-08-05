# Prompt — MPX Global mobile app · Profile screen + tab bar (M1 · screen 16)

> Copy everything below into your design tool (v0 / Lovable / Figma AI / Claude).
> Sources of truth: `design-plans/m1/app-screens-design.md` screen **16** (Profile) + **§8**
> (navigation shells) · live tokens `web/tailwind.config.js` = `app/src/theme/colors.js` ·
> shipped direction **B1 "Navy Canopy"**. Covers the Profile tab (both roles) and the two
> bottom tab bars. Screen 17 (biometric re-entry) is a SEPARATE screen — only its on/off
> **toggle** is in scope here.

---

## ⛔ COLOUR — hard rules, checked by arithmetic, before anything else

**The brand is a deep ROYAL BLUE / NAVY. Not purple, not violet, not indigo, not pastel.**
This has been mis-produced before (`#8069BF`, a lavender) — see the rejected table below.

```
#1A2E8F   navy  — canopy band, FLAT fill, no gradient
#2A4DE0   blue  — buttons, links, the active tab
```

Every colour must satisfy both, arithmetically:

- **Hue 226–232°.** The brand pair sit at 230° and 228°.
- **Saturation ≥ 65%.** The brand pair are 69% and 75%.

| Rejected | Hue | Sat | Why |
|---|---|---|---|
| `#8069BF` | 256° | 40% | lavender — actually produced once, 26° too violet, half the saturation |
| `#4f46e5` | 243° | 75% | indigo — a stale draft once listed it; never shipped |
| `#6366f1` | 239° | 84% | indigo |

Also rejected: any purple/violet at any opacity · desaturated/pastel blue (use `#EAEEFF` for
"light", never a washed-out mid-tone) · Tailwind default `gray/slate/zinc` (ours is the
blue-cast `ink` scale) · plain `#000000` (darkest text is `#000517`) · green anywhere except
verified · gradients/glows/glassmorphism.

**Use only hex values that appear verbatim in this document.** Before delivering, list every
hex you used and confirm each one is in here.

---

## 1 · What you are designing

Two things, designed together because one contains the other:

- **The Profile screen** — the app's settings surface, the last tab, shared by both roles but
  with role-specific content. It is the **only place** several M1 controls live: company
  profile, verification, biometric toggle, change password, sign out.
- **The bottom tab bar chrome** — the persistent navigation shell both roles sit inside. Buyer
  and exporter get **different tab sets on the same visual component**, not two different tab
  bars.

**Light mode only.** Match **B1 "Navy Canopy"**: navy `#1A2E8F` canopy header where a screen
pushes on top of the tabs (Change Password, and anything reached from Profile), white sheet
content, primary actions in `#2A4DE0`. The tab bar itself sits on the white `surface` layer, not
inside a canopy — it is chrome, not a screen.

---

## 2 · The Profile screen — one screen, two identities

Same layout for both roles; the identity block and one or two rows differ. Structure, top to
bottom:

### 2.1 Identity block

Name · email · mobile · **which portal this account is** (a persistent label — "Buyer account"
/ "Exporter account") · company name · the verified tick if verified, next to the company name,
not the person's name.

🔴 **The portal label matters more than it looks.** The same person can hold a buyer account
*and* an exporter account. Someone signed into both at different times must be able to glance
at this screen and know instantly which one they're in — this is the only place that
reassurance lives, since there is no in-app account switcher in M1.

### 2.2 Company profile row

One row: "Company profile" → the screen we already shipped (`CompanyProfileScreen`). Show a
one-line status underneath: the verified tick + "Verified", or "In review", or "Not submitted"
— whichever the company's `kycStatus` actually is. This is a preview of that screen's own
status chip, not a duplicate control.

### 2.3 Verification row

One row: "Verification" → the verification hub. Shows the same status chip. If the company
profile is incomplete, this is where the person who skipped it can still find their way back —
it should not silently agree with Section 2.2's status without explaining the gate exists.

### 2.4 Security section

- **Biometric unlock** — a toggle row. Off by default. When there's no biometric hardware or
  nothing enrolled on the device, the toggle is **disabled** with a one-line explanation
  underneath ("Set up Face ID or a fingerprint in your device settings to use this") — never
  hidden, never silently ignored on tap.
- **Change password** — a row → a pushed sub-screen (navy canopy, back arrow):

  | Field | Type | Required | Helper |
  |---|---|---|---|
  | Current password | password, show/hide | ✔ | — |
  | New password | password + strength meter | ✔ | "At least 8 characters" |
  | Confirm new password | password | ✔ | must match |

  States: default · loading · wrong current password (error banner above the form, same
  pattern as login — never attached to a single field) · mismatch · success (confirms other
  sessions were signed out, matching the reset-password screen already shipped) · offline.

### 2.5 Notifications section

**A placeholder, and it must look like one.** This layer ships later. Show the row —
"Push notifications" or similar — visibly disabled: greyed label, a "Coming soon" tag, no
working switch. 🔴 **Never render a toggle that looks live and does nothing** — that reads as
broken, not as unavailable.

### 2.6 About section

App version (read from the build, not hand-typed) · Terms of Service · Privacy Policy (both
link out; if the pages don't exist yet, that's a build-time gap to flag, not a design problem).

### 2.7 Sign out

A destructive row at the bottom, separated from everything else (the shipped screen already
puts it at `marginTop: auto` — keep that separation). Tapping it opens a confirmation sheet:
*"Sign out?"* — one line making clear this signs out **this account only**, not any other
portal the person may hold. Confirm (danger-styled) / Cancel.

### States to draw

loading · loaded (unverified company / in-review / verified, since the two status rows change
per state) · biometric on / off / unavailable · change-password sub-screen in each of its
states above · sign-out confirmation sheet · offline.

---

## 3 · The bottom tab bar

One visual component, two tab sets:

| Buyer | Exporter |
|---|---|
| Home · Search · Enquiries · Messages · **Profile** | Home · Catalogue · Enquiries · Messages · **Profile** |

**Only Home and Profile are real in M1.** Search, Enquiries, Catalogue and Messages currently
route to a shipped placeholder screen (centred title + "Builds in M2/M3/M4" — not a blank
screen, not a crash). **Home is itself still a placeholder too** — worth knowing going in.

🔴 **Open question the brief raises and the build has already answered differently — flag it,
don't silently resolve it.** The design brief recommends *hiding* not-yet-working tabs, arguing
a bar of dead tabs feels empty. **The shipped app shows all five tabs, fully tappable, landing
on an explicit "coming soon" placeholder.** That was the actual decision made. Design the tab
bar and its placeholder landing state to look intentional under the **shown, not hidden**
model — five polished tabs where three currently say "coming soon" — rather than redesigning
around hiding them. If you have a strong opinion that hiding reads better, say so as a note,
but the working assumption is: all five tabs are visible.

### Visual treatment

- Icons from Ionicons, outline when inactive and filled when the tab is active — already the
  shipped pattern (`home-outline` → `home`, etc.). Keep that idiom for any new icon you choose.
- Active tab: icon + label in `#2A4DE0`. Inactive: `muted` `#5A6B85`.
- White `surface` background, a hairline top border in `surface.border` `#C5C6CF` — no shadow,
  no floating pill bar, no colour fill behind the active icon. Calm chrome, not a feature.
- Labels present under every icon, always — never icon-only.

### The placeholder landing screen

Currently: centred title, module name, "Builds in [milestone]". If you improve this, it must
still say plainly that the feature is not built — never imply it's broken, never show an empty
state that looks like "no results yet" (that reads as a working feature with nothing in it,
which is a different and worse impression than "not built").

---

## 4 · Deliverables

1. Profile screen, buyer and exporter variants, at **375pt** and **430pt**.
2. Change-password sub-screen, all states listed in §2.4.
3. The sign-out confirmation sheet.
4. Both tab bars (buyer 5-tab, exporter 5-tab) with active/inactive states for every tab.
5. The placeholder landing screen, refined but still honest about being unbuilt.
6. **Self-check with delivery:** every hex used appears verbatim above; the portal label is
   present and legible in the identity block; the notifications row is visibly non-functional,
   not a live-looking dead toggle.

---

## Notes for whoever runs this prompt

- **No new model fields or endpoints needed for the identity block or status rows** — they read
  from data already returned by `/auth/me`, `/me/organisation` and `/me/verification`.
- **Change password already has a working endpoint** (`POST /auth/change-password`) — this is a
  UI-only gap, not a backend one.
- **The biometric toggle is UI state only in M1** — `expo-local-authentication` is installed but
  the actual re-entry gate (screen 17) is a separate, not-yet-built screen. Design the toggle
  faithfully; do not attempt to spec screen 17's native-prompt behaviour here.
- **Terms of Service / Privacy Policy pages are an open item**, tracked separately (consent
  capture at signup has the same gap) — link them, don't block on them existing yet.
