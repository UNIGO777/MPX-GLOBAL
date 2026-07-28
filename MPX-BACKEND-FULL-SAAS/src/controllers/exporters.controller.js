import * as svc from '../services/exporters.service.js';

// Public, curated exporter profile. Exposes ONLY public fields + a `verified`
// flag for the tick (B7). It deliberately does NOT leak the raw kycStatus: the
// product rule is "verified tick or nothing" (no 'not verified' badge), and a
// public 'rejected' would expose a rejection. Contacts, KYC docs, registration/
// tax ids are never returned here.
function publicView(org) {
  return {
    id: String(org._id),
    slug: org.slug ?? null,
    name: org.name,
    country: org.country ?? null,
    description: org.description ?? null,
    logo: org.logo ?? null,
    website: org.website ?? null,
    verified: org.kycStatus === 'verified',
    verifiedAt: org.kycStatus === 'verified' ? (org.verifiedAt ?? null) : null,
    establishedYear: org.businessProfile?.establishedYear ?? null,
  };
}

export async function getExporter(req, res) {
  const org = await svc.getPublicExporter({ id: req.params.id });
  res.json({ exporter: publicView(org) });
}
