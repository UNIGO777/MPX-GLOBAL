# MPX — Module 5 feature inventory

A flat list of every M5 screen: what it shows, what it filters on, what it can do, and what gates it. Companion to `m5.md`, which carries the reasoning.

**Legend:** ✅ **backend/API** built + tested (⚠️ the web **screen** does not exist — no web frontend has been built yet; S1 alert before building any) · 📋 rules written elsewhere, screen not built · 🔵 planned in M5 · ⏸ out of month-1 scope

---

## 1 · Login / OTP ✅

| | |
|---|---|
| **Data** | Email or mobile, password, 6-digit OTP |
| **Actions** | Log in · verify OTP · forgot password |
| **Gate** | Public |
| **Notes** | Staff use their own login endpoint (A21). No TOTP — deliberately excluded. Identical "Invalid credentials." for a wrong password and an unknown account. OTP has no attempts-remaining counter; 5 wrong attempts lock for 15 minutes |

## 2 · User management ✅

| | |
|---|---|
| **Data** | Name · email · mobile · role · active state · organisation · that org's verification status |
| **Filters** | Role · verification status · prefix search labelled "Starts with…" |
| **Actions** | Activate · deactivate |
| **Gate** | Read: `user:read` (grantable) · activate/deactivate: hard `requireRole('superadmin')`, never grantable |
| **Notes** | Deactivate sets `User.isActive` false and bumps `tokenVersion`, killing live sessions and login. Guards: no self-lockout, superadmin untouchable, unknown user returns 404 not 403. Page size hard-capped. Search input is regex-escaped |

## 3 · Verification queue ✅

| | |
|---|---|
| **Data** | Organisation · entity type · submitted date · current status · rejection reason |
| **Filters** | Status · buyer vs exporter |
| **Actions** | Approve (buyer) · verify (exporter) · reject with reason |
| **Gate** | `buyer:approve` · `exporter:verify` — both grantable |
| **Notes** | Requires `kycStatus === 'submitted'` for both roles; a doc-less `pending` org returns 409, so nothing is verified without evidence. Writes AuditLog with the actor. `kycStatus` is one shared value per Organisation across both sides |

## 4 · KYC document viewer ✅

| | |
|---|---|
| **Data** | Document type · uploaded date · a short-lived signed URL per document |
| **Actions** | View document |
| **Gate** | `kyc:view` — grantable |
| **Notes** | Never returns the stored `storageKey`; the signed URL is the only access path. Every view writes a `kyc.view` audit row. Documents live on Cloudinary as `type: private` with randomised public ids |

## 5 · Employees & permissions ✅

| | |
|---|---|
| **Data** | Employee list · current permission set |
| **Actions** | Create employee · replace permission set |
| **Gate** | Hard `requireRole('superadmin')` — never a grantable permission |
| **Notes** | Permission edits REPLACE the whole set and take effect on the next request without re-login. Unknown permission strings are rejected. Target must be an employee, else 404. New staff get a temporary password shown once and must change it on first login via a blocking, no-sidebar screen |

## 6 · Category tree 📋

| | |
|---|---|
| **Data** | Full tree — 40 top categories, ~250 sub-categories · active state · order |
| **Filters** | Active/inactive · search by name |
| **Actions** | Activate / deactivate a top category · image upload |
| **Gate** | Read: `category:read` · toggle/image: `category:manage` (§A25, 2026-07-31) |
| **Notes** | Top categories are toggle-only — no create, edit or delete. Deactivating one stores each sub's `prevActive` first, so reactivating restores rather than blanket-enabling. Image upload on top categories is a deliberate narrow exception (A20). `type` is not set on top categories at all (A16) |

## 7 · Sub-category CRUD + attribute manager 📋

| | |
|---|---|
| **Data** | Sub-category name · slug · parent · `type` (goods/service) · active · order · synonyms · image · its `CategoryAttribute` list |
| **Actions** | Create · edit · delete · manage attributes (name, key, inputType, options, unit, required, filterable, order) |
| **Gate** | Read: `category:read` · all writes: `category:manage` (§A25) |
| **Notes** | Delete is blocked when products or child categories exist. `type` is REQUIRED here — it is the leaf that decides the product form. A `synonyms` tags input is mandatory, otherwise admin-created categories are invisible to search (A12) |

## 8 · Product monitoring list 🔵

| | |
|---|---|
| **Data** | Product name · seller company · category · status · that seller's takedown count · purge countdown · created date · who took it down, when and why |
| **Filters** | Category · sub-category · status (Active / Inactive / Blocked) · seller · product name search |
| **Actions** | Takedown (reason required) · restore · open product detail · view that product's chats · open the seller's public profile · open the seller's Organisation |
| **Gate** | Read: `product:read` · takedown/restore: `product:takedown` — both grantable (§A25, 2026-07-31; supersedes the 07-30 superadmin-only default) |
| **Notes** | Read-only monitoring: admin cannot edit a product (B6). `draft` and seller-`archived` products are NOT shown. "Blocked" reads `takedown.isDown`, never `status`. No bulk takedown — block the Organisation instead. The purge countdown and the seller takedown count are both load-bearing, not decoration. Takedown count reads **`Organisation.takedownCount`** (§A24 — persisted, increment-only, purge-proof) |

## 9 · Takedown action 📋

| | |
|---|---|
| **Data** | Reason (required) |
| **Actions** | Take down · restore |
| **Gate** | `product:takedown` — grantable (§A25) |
| **Notes** | Likely a modal inside screen 8 rather than its own screen. Sets `takedown{isDown, reason, byUserId, at}` and never touches `status`, so restoring returns the product to whatever state it was in. Writes AuditLog with actor and reason. The seller sees the reason and date on their own listing but never `byUserId`. Never a hard delete |

## 10 · All conversations 🔵📋

| | |
|---|---|
| **Data** | Thread title as buyer × seller × product · last message time and preview · unread state (**the parties'** unread, derived from `buyerLastReadAt`/`exporterLastReadAt` — admin has no own read-tracking) · frozen state and reason |
| **Filters** | Search by name — product, buyer company or seller company — and by `buyerOrgId` / `exporterOrgId` pasted directly |
| **Actions** | Open the chat viewer · block a chat · unblock |
| **Gate** | ✅ `conversation:read` (grantable) — every read audited. Block/unblock: `conversation:block`. **Built 2026-08-01** |
| **Notes** | Admin sees every thread on the platform. Search matches three denormalised name fields on `Conversation` plus the two org ids; the role only changes the scope filter, never the searched fields. Cursor pagination, never page numbers. Message content is never searched |

## 11 · Chat viewer 🔵📋

| | |
|---|---|
| **Data** | Full message history · participants including the platform · frozen state and its reason |
| **Actions** | Read only. Block or unblock the chat |
| **Gate** | ✅ `conversation:read` (grantable) · every read writes an audit row. **Built 2026-08-01** |
| **Notes** | **No composer.** Enforced server-side by role, not by hiding a control. Admin joins the socket room only when a thread is opened, never all rooms by default. Messages load in bundles on scroll — cursor-based, never page numbers |

## 12 · Dashboard 🔵

| | |
|---|---|
| **Needs action** | Pending verifications (buyer and exporter counted separately) · rejected awaiting resubmit · blocked products · nearing purge at 150+ days |
| **Health** | Verification turnaround — average days from `kycSubmittedAt` to decision |
| **Totals** | Organisations by side · active products · conversations · users |
| **Actions** | Every number clicks through to that list, already filtered |
| **Gate** | Tiles are permission-filtered the way the sidebar is |
| **Notes** | No saved-item counts, no message counts, no trend graphs. No error tile — the error log moved to FINALIZE |

## 13 · Audit log viewer 🔵

| | |
|---|---|
| **List** | Timestamp · actor · action · target |
| **Detail** | The whole entry — before/after snapshot, reason, actor role, target id |
| **Filters** | Actor · action type · date range · target |
| **Actions** | Read only |
| **Gate** | ✅ `audit:read` (grantable, decided 2026-08-01) |
| **Notes** | Append-only. No edit, no delete, no exceptions. Must cover: KYC submit and view, buyer approve/reject, exporter verify/reject, product takedown/restore, the 180-day purge, chat block/unblock, admin and employee chat reads, user activate/deactivate, permission changes, organisation block/unblock, and the organisation claim |

## 14 · Organisation list 🔵

| | |
|---|---|
| **Columns** | Company name · verification · products count · takedowns count · state |
| **Filters** | Side · verification · blocked. Sorted by takedown count |
| **Actions** | Open detail |
| **Gate** | ✅ `organisation:read` (grantable, decided 2026-08-01) |
| **Notes** | Five columns only — a wider table breaks on responsive. Country and the sides badge live on the detail screen. A second line under the company name for country or slug is recommended, since company names collide |

## 15 · Organisation detail 🔵

**Always shown**

| Section | Content |
|---|---|
| Header | Name · slug · sides badge · verified state and since · active/blocked · block/unblock |
| Company | Country · address · entityType · logo · description · created date |
| Verification | Status · who · when · rejection reason · KYC documents link (`kyc:view`) · resubmit count · **which side was actually reviewed** *(derived from AuditLog `buyer.approve` vs `exporter.verify` rows — no schema field)* |
| Sides | Which sides are enabled and when · claim history — who claimed which side, when *(side flags carry no timestamp — "when" + claim history derive from AuditLog signup/`org.claim` rows)* |
| Users | Every user on this Organisation · role · active/blocked · last login *(reads `User.lastLoginAt` — already built; set on every successful login)* |
| Buyer account chats | Count and link — only if the buyer side exists |
| Exporter account chats | Count and link — only if the exporter side exists |
| Audit trail | This Organisation's full record |

**Exporter side only** — products by status · takedown count and history · link to the monitoring list filtered to this org · link to the public seller profile *(🚫 "working categories" removed — **cancelled 2026-07-30** with "business type"; the field does not exist and will not be built)*

**Buyer side only** — enquiries sent · saved items · link to conversations

| | |
|---|---|
| **Actions** | Block / unblock with reason · open KYC documents · verify or reject if pending |
| **Gate** | Read: ✅ `organisation:read` (grantable) · block/unblock: hard `requireRole('superadmin')` |
| **Notes** | Block is prominent — it replaced bulk takedown as the answer to "many bad products". Today a block reaches the Organisation and its users only; F1's cascade into catalogue, products and chats is FINALIZE work and the screen must not imply otherwise. `registrationNumber`, `website`, `taxId`, `establishedYear` and `authorisedSignatory` have no capture path and must be hidden or labelled "not captured" |

---

## Out of month-1 scope ⏸

| Screen | Where it went |
|---|---|
| Featured listings + banners | FINALIZE |
| Platform settings | Month 2 |
| Error log viewer + dashboard error tile | FINALIZE |
| Employee panel as its own surface | Month 2 |

## Permissions summary

**Grantable — M1:** `buyer:approve` · `exporter:verify` · `user:read` · `kyc:view`

**Grantable — M2 (§A25, decided 2026-07-31):** `category:read` · `category:manage` · `product:read` · `product:takedown` *(catalogue writes are grantable — supersedes the 07-30 "takedown superadmin-only" default)*

**Grantable — M4 (decided + built 2026-08-01):** `conversation:read` · `conversation:block` *(the block string is grantable to employees — **supersedes M4-38's "read permission only in month 1"**)*

**Grantable — M5 (decided 2026-08-01):** `organisation:read` *(Organisation list + detail)* · `audit:read` *(audit log viewer)*

**Never grantable — hard `requireRole('superadmin')`:** user activate/deactivate · employee create · permission assignment · organisation block/unblock

**The dashboard has NO permission of its own** — every tile is filtered by what the caller already
holds, the same way the sidebar is, so a tile can never link an employee to a list they cannot open.

✅ **Nothing is left to propose.** All twelve grantable strings are decided (4 M1 + 4 M2 + 2 M4 + 2 M5); adding an eleventh needs an
owner decision first (rule 6 — never invent a permission string inline).
