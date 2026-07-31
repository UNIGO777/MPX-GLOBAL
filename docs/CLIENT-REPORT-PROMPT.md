# Prompt — generate the client Progress & QA report (M1 + M2 + M3)

> Paste everything inside the fence into a fresh Claude chat. It is self-contained: the chat does
> not need repo access. Update the numbers here first if more work has shipped since 2026-07-31.

---

````
You are writing a **client-facing Progress & Quality Assurance Report** for MPX Global, a B2B
import/export marketplace being built for the client by NxtGenDigitals. Produce a polished,
professional document in **English** that a senior non-technical decision-maker can read and
trust, and that a technical reviewer would also find credible.

## Audience & tone
- Primary reader: the client's senior decision-maker (Australian entity). Semi-technical.
- Their stated #1 priority is **liability protection** — they care most that money, identity
  documents, and one company's data can never leak or be tampered with.
- Factual, confident, no marketing language, no exaggeration. Short paragraphs; tables where they
  genuinely help. British/Australian English spelling.

## What has been built (state the boundary clearly so nothing is over-read)
Three backend modules are complete and tested. **This is backend only** — the web and mobile
screens are a separate effort and are NOT covered by this report. Modules 4 (enquiry & chat) and
5 (admin console) are not built yet.

- **Module 1 — Identity & Access:** signup, login, OTP two-factor, sessions/tokens, KYC document
  upload and review, verification (approve / verify / reject with reason), user management,
  employee permissions, company-level block.
- **Module 2 — Catalogue:** category tree (40 top categories, 262 sub-categories) with
  admin-managed custom fields, seller product listings (goods and services), publishing rules and
  limits, public catalogue browsing, admin moderation (takedown / restore), and an automated
  180-day cleanup of blocked listings.
- **Module 3 — Discovery & Search:** keyword search with synonym matching, faceted filters with
  live counts, AI-assisted search, saved products and suppliers, "did you mean" suggestions, and
  search-engine files (sitemap, robots).

## Test suite facts (use these exact numbers)
- **274 automated tests across 29 test files — 100% passing.**
- The full suite was executed **19 times**; 274/274 on 18 of those runs. One early failure was
  traced to shared test-state (rate-limit counters carrying over between test files), fixed
  centrally, and followed by **14 consecutive clean runs**. Report this honestly — it shows the
  process works, and no unexplained failure is being hidden.
- Average full-suite run time ~30 seconds. Code-quality linter: clean, zero warnings.
- A startup safety check verifies that **all 64 API endpoints** declare an access rule, and the
  server **refuses to start** if any endpoint is left undeclared. This passes, including in a
  production-mode boot check.

### Test inventory
**Module 1 — Identity & Access (126 tests)**
| Area | Tests | Covers |
|---|---|---|
| KYC documents | 27 | Upload, entity-type rules, per-account document limits, reviewer access via expiring links, resubmission after rejection, public profile projection |
| User management | 23 | Directory list/search, activate/deactivate, employee permission assignment, privilege-escalation guards |
| Authentication | 16 | Signup, login, OTP, token issue/refresh/rotation, session invalidation, uniform error responses |
| Verification | 9 | Buyer approval, exporter verification, rejection with reason, audit trail |
| Company records | 9 | Company data rules and constraints |
| Company block | 9 | Block/unblock, cascade to user accounts, prior-state restore |
| Regressions | 9 | Locked-in fixes for previously identified issues |
| Login portals | 6 | Separate buyer/exporter/staff portals, no account-existence disclosure |
| File verification | 5 | File type verified by content signature, not filename |
| Access-control guard | 4 | Startup enforcement across every endpoint |
| Account uniqueness | 4 | One email may hold one buyer + one exporter account, never two of the same type |
| Input validation | 3 | Request validation layer |
| Data migration | 2 | Migration correctness |

**Module 2 — Catalogue (60 tests)**
| Area | Tests | Covers |
|---|---|---|
| Products | 12 | Creation/editing rules, pricing modes, listing limits, publish validation, deletion, cross-company isolation |
| Categories | 12 | Tree reads, admin management, activate/deactivate cascade, custom field management, image upload |
| Data model | 10 | Model constraints and defaults |
| Moderation | 7 | Takedown/restore, mandatory reason, offence counter, permission gates |
| Public catalogue | 7 | Browsing, data-exposure whitelist, seller product count |
| Category setup | 5 | Catalogue seeding, repeat-run safety |
| Automated cleanup | 4 | 180-day removal of blocked listings and its audit snapshot |
| Logging & sync | 4 | Error-log retention, verification-to-catalogue synchronisation |

**Module 3 — Discovery & Search (73 tests)**
| Area | Tests | Covers |
|---|---|---|
| Search engine | 17 | Keyword and synonym matching, ranking, sorting, price/currency rules, attribute filters, supplier search, result-shape consistency |
| AI search & SEO | 14 | AI query translation, safety guardrails, fallback behaviour, sitemap and robots correctness |
| Adversarial edge cases | 13 | Hostile inputs, unicode, empty datasets, pagination boundaries, and a sweep proving no search surface leaks private data |
| Saved items | 12 | Buyer-only access, duplicate prevention, availability rules, cleanup on deletion |
| Search data integrity | 9 | Denormalised search fields, synchronisation on renames, backfill correctness |
| Faceted filters | 9 | Counts, dynamic filters, currency scoping, supplier-mode filters |

**Cross-module integration (13 tests)**
| Area | Tests | Covers |
|---|---|---|
| M1+M2+M3 journeys | 8 | Full end-to-end: seller signup → listing → publish → buyer signup → search → save → verification lights the trust tick everywhere; moderation ripple; category rename; company block; deletion/cleanup; listing limits vs discovery; four-account data isolation |
| M1+M2 journeys | 5 | Signup-to-publish flow, privilege-bypass guard, blocked-company behaviour, category-type change, seller filtering |

## Security controls verified by tests (map to the four control groups in the quote)
- **Password security** — argon2id hashing; never returned or logged.
- **Session security** — short-lived access tokens; refresh tokens rotate on every use; re-use of
  an old token is treated as theft and revokes the whole session family; password change, role
  change, deactivation and company block all terminate live sessions immediately.
- **Two-factor (OTP)** — 6-digit, hashed at rest, 5-minute expiry, 5 attempts then a 15-minute
  lock that cannot be reset by requesting a new code.
- **Access control** — every endpoint declares a required permission; default is deny; governance
  actions (activating users, creating employees, assigning permissions, blocking a company) are
  restricted to the Super Admin and can never be delegated.
- **Data isolation** — every seller and buyer query is scoped to the owning company; one company
  can never read, edit or delete another's data. Attempts return "not found" rather than
  "forbidden", so nothing is revealed about other companies' records.
- **Injection protection** — database operator payloads are rejected at the request boundary; all
  inputs strictly typed and validated, including the AI layer's output.
- **File upload safety** — uploads verified by actual file content signature (not filename), with
  size caps and per-account limits; identity documents stored privately and served only through
  short-lived signed links.
- **Privacy of published data** — public pages return an explicit approved-fields-only list.
  Verification status, internal identifiers, moderation reasons, contact details and internal
  search fields are never exposed. Tests assert the exact set of public fields on every public
  surface, so accidentally widening it fails the build.
- **Audit trail** — every significant action records who did it, to what, when and why;
  append-only and protected against modification and deletion.
- **Rate limiting & cost control** — login, OTP, uploads, search and AI endpoints are all rate
  limited from a shared store, and the AI endpoint additionally carries a per-company daily quota
  so external AI usage cannot run up an unbounded bill.

## Business rules verified by tests
- Buyers are fully active from signup; approval only records trust status, it is not a gate.
- Sellers are publicly visible from signup; verification adds a trust tick, it does not gate
  visibility. Verified sellers rank higher in search but unverified sellers are never hidden.
- Unverified sellers may hold at most **3 live listings** and **10 drafts**; verification lifts
  both. A moderation takedown frees a listing slot.
- A published listing can never silently return to draft; a deleted listing is archived (data
  retained), never destroyed. Moderation never alters the seller's own listing state — a restore
  returns a listing to exactly the state it was in.
- Deactivating a top-level category hides its sub-categories and their listings; reactivating
  restores each one's previous state.
- Blocked listings are automatically deleted after 180 days, with an audit record capturing the
  product and company names before deletion. Seller-archived listings are retained indefinitely.
- Search results only ever contain live, publicly-visible listings — enforced in the database
  query itself, not by filtering results afterwards.
- Saved items behave predictably: an item that is temporarily unavailable stays in the buyer's
  list clearly marked, while a permanently deleted one is removed automatically.
- Prices are never compared across currencies (no exchange-rate conversion exists in this phase),
  so price filters and price sorting always operate within one selected currency.

## Issues found and fixed by this process (include this — it demonstrates the process works)
Dedicated review passes were run over the completed code, and the automated tests themselves
caught further defects during development:
- **Module 1 review — 9 issues found and fixed**, including an admin endpoint returning incorrect
  company-type flags, two error paths returning a generic server error instead of a clear message,
  an endpoint accepting unrecognised permission values, an unbounded document-upload path, and
  responses returning more internal fields than necessary.
- **Module 2 review — 2 issues found and fixed**: changing a listing between goods and services
  left it uneditable, and a rare timing collision on category creation returned a server error
  instead of a clear retry message.
- **Module 3 — 4 defects caught by the tests during the build**, the most significant being a
  bulk-update that would have marked thousands of untouched listings as just-modified, distorting
  "newest first" ordering and search-engine freshness data.
- Planning reviews before Module 3 was written caught a further 32 specification gaps, including
  a filter format that the platform's own security layer would have rejected at runtime.
All fixes shipped with regression tests so the same issues cannot silently return.

## Required document structure
1. **Title block** — document title, project name, prepared by, date, version.
2. **Executive summary** — 5–8 lines: what is complete, the headline QA result, and what it means
   for the client's risk exposure.
3. **Scope of this report** — what is covered (M1–M3 backend) and, explicitly, what is not
   (frontend screens, Modules 4–5, and the fact that automated testing is not the same as an
   independent security audit or penetration test).
4. **Delivery status at a glance** — a short table of the three modules and their status.
5. **Test results at a glance** — totals, pass rate, files, run time, repeat-run consistency,
   lint and startup-check status.
6. **Test coverage by module** — use the inventory tables above.
7. **Security controls verified** — grouped as Authentication · Access control · Application
   security · Data protection.
8. **Business rules verified** — in plain English.
9. **Issues found and resolved** — as evidence the process catches defects before delivery.
10. **How the tests are run** — automated suite executed on every meaningful change, sequentially
    against a dedicated test database; production data is never touched.
11. **Limitations and honest gaps** — automated tests verify intended behaviour, not an
    exhaustive absence of defects; no third-party penetration test has been performed; frontend
    and Modules 4–5 are not covered; and these known items remain open: **(a)** the synonym word
    list for the 40 top categories is pending from the client's side, so category keyword matching
    currently works only for the words already configured; **(b)** the OpenAI key is pending, so
    AI search runs its tested fallback (plain keyword search) until it is supplied; **(c)** when a
    company is blocked, its existing listings currently remain visible in public search until the
    planned cascade feature is built — this is tracked and deliberately proven by a test.
12. **What happens next** — remaining modules and the frontend.

## Hard constraints
- **Do not overstate.** Never write "fully secure", "bug-free", "hack-proof", "audited" or
  "certified". State what the tests demonstrate, nothing more.
- **No credentials, keys, connection strings or environment values** anywhere in the document.
- Keep internal code names (A10, §A25, D1, F1-B, B7, etc.) **out** of the client document —
  translate every rule into plain English.
- Output clean Markdown suitable for converting to PDF, with a professional layout.
````
