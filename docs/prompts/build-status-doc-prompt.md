# Prompt — "What we have built" document (web + app)

> Copy everything below the line. Run it against **this repository**, not from memory.
> Output: `docs/BUILD-STATUS.md`.

---

You are writing the **build-status document** for MPX Global — a B2B import/export marketplace
(Indian exporters ↔ international buyers) with a shared Node/Express + MongoDB backend, a React +
Tailwind web app, and a React Native (Expo) mobile app.

The reader is the **client and the project owner**. They are paying for this and need to know
exactly what exists, what does not, and what is waiting on them. They are not going to read code.

## Non-negotiable rule: derive everything from the repository

**Do not describe anything you have not verified in the code.** For every claim, open the file.
A feature is "built" only if there is a route, a screen, or a test proving it.

Three states, and use them honestly:

- ✅ **Built** — code exists and works. Name the endpoint or screen.
- 🟡 **Partly built** — say precisely which half is missing.
- ❌ **Not built** — and say whether it is deferred, out of scope, or simply next.

**A placeholder is NOT a feature.** The app is full of `makePlaceholder({ ... milestone: 'M2' })`
screens; every one of those is ❌, no matter how finished the tab bar looks around it.

## Where to look

| Area | Start here |
|---|---|
| Backend | `MPX-BACKEND-FULL-SAAS/src/routes/*.js` — the route files are the true API surface |
| Backend tests | `MPX-BACKEND-FULL-SAAS/tests/` — the count and the file names say what is actually guaranteed |
| Web | `web/src/pages/`, `web/src/api/` |
| App | `app/src/screens/`, `app/src/navigation/`, `app/src/api/` |
| Decisions & history | `docs/History.md` (newest first), `docs/Note.md` (guards), `docs/scope-of-work.md` (the quote) |
| What is deliberately NOT in month 1 | `docs/month1-not-doing.md` |

Run the backend test suite and report the real number. Do not quote a number from a doc.

## Structure

1. **One-paragraph summary** — what a person can actually do today, end to end.
2. **Backend** — grouped by module (auth, catalogue, search, enquiry/chat, admin, KYC). For each:
   the endpoints, and one line on what it enforces.
3. **Web** — screen by screen, with its state.
4. **App** — screen by screen, with its state.
5. **What is NOT built** — the honest list, split into: deferred by decision · Phase 2 · not started.
6. **What we are waiting on from the client** — see below.
7. **Known gaps and risks** — including anything tested only on the API and never on a device.

## Points the document must make, because they are easy to get wrong

- **Signup verifies BOTH email and mobile with separate codes**, and **no account exists until both
  pass** (`/auth/signup/start` → `/verify` → `/complete`). The old single-call signup endpoints were
  removed, not deprecated. Explain why in one sentence: an account created up front let anyone
  permanently burn a stranger's email or phone with no proof of ownership.
- **KYC is not a gate.** A buyer is fully active from signup and buyer KYC is optional; an
  exporter's profile is public from signup. The only real consequence of being unverified is the
  exporter's **3 active listings / 10 drafts** cap. Do not write "unlock", "activate" or "pending
  approval" anywhere.
- **KYC documents are never returned to a client** — only metadata (type, date). Say so, because it
  looks like a missing feature otherwise.
- **Orders, escrow, payouts and contracts are Phase 2** and are not being built now. Any Phase-2
  model in the code is an untouched placeholder.
- Where something is tested by the API suite but **never run on a real device**, say that plainly.

## Waiting on the client — list these explicitly

Check each against the code before listing it; some may now be resolved:

- Real **OTP delivery provider** (SMS + email). Codes currently print to the dev terminal only.
- **Cloudinary** credentials (storage for KYC documents and images).
- **OpenAI** key, **Redis**, production **VPS + MongoDB**.
- The **40 top-category synonyms** and **40 category images**.
- Girish's **written sign-off** on: buyer full access with no approval gate, and the exporter
  3-product trial — both deviate from the quote.

## Tone

Plain, factual, no marketing. Short sentences. If something is half-done, saying so is the point of
the document — a status report that reads as though everything is finished is worthless the first
time the client taps a placeholder.

Use tables for endpoint and screen lists. Keep the whole thing under ~1,500 words; link to files
rather than pasting code.

---

## Notes for whoever runs this

- The web app is owned by another developer — read it, do not edit it while documenting.
- `docs/History.md` is the most reliable narrative of *why* things are the way they are; the change
  log at the top is newest-first and records the decisions and their reasons.
- If a claim in an older doc contradicts the code, **the code wins** — and flag the stale doc rather
  than quietly repeating it.
