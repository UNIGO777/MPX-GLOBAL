/**
 * M5-D — Organisation projections for staff.
 *
 * Two things this file exists to prevent (m5-rules §8, and V2/V3 of the plan):
 *   · another user's `permissions` reaching a response — permission sets are the
 *     Employees screen's job, and that screen is superadmin-only
 *   · `kycDocuments` or a `storageKey` reaching anyone holding only
 *     `organisation:read` — documents need `kyc:view`, their own endpoint, and
 *     their own `kyc.view` audit row. A count is not document access.
 */

// Rule 13 / §7.3 — these exist on the model but no form captures them; identity
// capture is Phase 2. They are reported as explicitly "not captured" so a screen
// can label them, rather than rendering blank inputs that look like they are
// waiting for input.
const NEVER_CAPTURED = ['registrationNumber', 'website', 'taxId', 'establishedYear', 'authorisedSignatory'];

function sidesOf(org) {
  return {
    buyer: Boolean(org.buyerSide),
    exporter: Boolean(org.exporterSide),
    both: Boolean(org.buyerSide && org.exporterSide),
  };
}

/** List row — §7's five columns, plus country and slug for the second line. */
export function orgListView(org, liveProducts) {
  return {
    id: String(org._id),
    name: org.name,
    // The recommended second line: company names collide, and two "Global
    // Exports" rows are otherwise indistinguishable.
    slug: org.slug ?? null,
    country: org.country ?? null,
    // The company's own mark, so the list identifies a company the way every
    // other surface does. Public data — the seller page already shows it — and
    // it is not a column: it rides in the company cell beside the name.
    logo: org.logo ?? null,
    verification: org.kycStatus,
    // Change re-verification flags (2026-08-19) — lets the queue chip a row
    // without a detail fetch.
    changePending: org.pendingChanges?.state === 'awaiting_review',
    changeSubmittedAt:
      org.pendingChanges?.state === 'awaiting_review' ? (org.pendingChanges.submittedAt ?? null) : null,
    products: liveProducts ?? 0,
    takedowns: org.takedownCount ?? 0,
    blocked: org.isActive === false,
    sides: sidesOf(org),
  };
}

export function orgDetailView({ org, users, derived, chats, products, buyerActivity, verifier }) {
  return {
    header: {
      id: String(org._id),
      name: org.name,
      slug: org.slug ?? null,
      sides: sidesOf(org),
      verified: org.kycStatus === 'verified',
      verifiedAt: org.kycStatus === 'verified' ? (org.verifiedAt ?? null) : null,
      blocked: org.isActive === false,
      blockReason: org.blockReason ?? null,
      blockedAt: org.blockedAt ?? null,
      createdAt: org.createdAt ?? null,
    },

    company: {
      country: org.country ?? null,
      address: org.address ?? null,
      entityType: org.entityType ?? null,
      logo: org.logo ?? null,
      description: org.description ?? null,
    },

    // Rule 13 — say plainly which fields will never fill, instead of rendering
    // them as empty and waiting.
    notCaptured: NEVER_CAPTURED,

    verification: {
      status: org.kycStatus,
      // §7 asks WHO verified. An id is not an answer to that, so it is resolved
      // to a name — the same fix G5 made on the monitoring list.
      verifiedBy: verifier,
      verifiedAt: org.kycStatus === 'verified' ? (org.verifiedAt ?? null) : null,
      rejectionReason: org.kycRejectionReason ?? null,
      submittedAt: org.kycSubmittedAt ?? null,
      // Rule 13 — ONE shared kycStatus across both sides, so this says which
      // sides were actually looked at. Empty means nobody has reviewed anything.
      reviewedSides: derived.reviewedSides,
      reviewedAt: derived.reviewedAt,
      resubmitCount: derived.resubmitCount,
      // W5 — a COUNT, never the documents. Fetching them needs `kyc:view`.
      // Superseded docs excluded — the count means "current document set".
      kycDocumentCount: (org.kycDocuments ?? []).filter((d) => !d.supersededAt).length,
    },

    /**
     * Verification-redesign (2026-08-19). The pending diff (current live vs
     * requested values), open document requests, and any standing revocation —
     * staff-facing; reasons are fine here and never public.
     */
    pendingChanges: org.pendingChanges?.state
      ? {
          changedFields: org.pendingChanges.changedFields ?? [],
          state: org.pendingChanges.state,
          submittedAt: org.pendingChanges.submittedAt ?? null,
          rejectionReason: org.pendingChanges.rejectionReason ?? null,
          current: Object.fromEntries(
            (org.pendingChanges.changedFields ?? []).map((f) => [
              f,
              f === 'address' ? (org.address ?? null) : (org[f] ?? null),
            ]),
          ),
          requested: org.pendingChanges.values ?? {},
        }
      : null,
    documentRequests: (org.documentRequests ?? []).map((r) => ({
      id: String(r._id),
      docTypes: r.docTypes,
      note: r.note,
      requestedAt: r.requestedAt ?? null,
      fulfilledAt: r.fulfilledAt ?? null,
    })),
    kycRevocation: org.kycRevocation?.revokedAt
      ? { reason: org.kycRevocation.reason, revokedAt: org.kycRevocation.revokedAt }
      : null,

    sides: {
      ...sidesOf(org),
      signupAt: derived.signupAt,
      // ⚠️ Empty until A21 Step 4b writes `org.claim` rows. The screen must say
      // "no claim recorded" — not imply the history was lost.
      claimHistory: derived.claimHistory,
      claimHistoryAvailable: false,
    },

    // V2 — no `permissions`, no `passwordHash`, for anyone.
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt ?? null,
    })),

    chats: {
      asBuyer: chats.asBuyer,
      asExporter: chats.asExporter,
    },

    // W3 — `archived` is a COUNT here even though the monitoring list refuses to
    // show archived rows. Both are correct; the count must not link into a list
    // that can never display it.
    products: products
      ? { ...products, archivedIsCountOnly: true, takedownCount: org.takedownCount ?? 0 }
      : null,

    buyerActivity,

    /**
     * Rule 11 / §7.1 — the screen must show what a block ACTUALLY does. Today it
     * reaches the Organisation and its users; it does NOT touch the catalogue,
     * products or chats (that is F1-B, in FINALIZE). Without this an admin blocks
     * a company, assumes its listings are hidden, and leaves them live.
     */
    blockReach: {
      organisation: true,
      users: true,
      // F1-B shipped: a block now reaches these too.
      products: true,
      conversations: true,
      note: 'A block disables the company and its users, takes its live products down, and freezes its conversations. Drafts and archived products are untouched.',
      // The cascade runs in the background, so the screen must be able to say
      // whether it actually finished. `failed` means the catalogue is still live.
      cascade: org.blockCascade?.status
        ? {
            status: org.blockCascade.status,
            direction: org.blockCascade.direction ?? null,
            products: org.blockCascade.products ?? null,
            conversations: org.blockCascade.conversations ?? null,
            completedAt: org.blockCascade.completedAt ?? null,
            failed: org.blockCascade.status === 'failed',
          }
        : null,
    },
  };
}
