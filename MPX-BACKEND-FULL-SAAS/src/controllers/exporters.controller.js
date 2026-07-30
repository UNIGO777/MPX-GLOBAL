import * as svc from '../services/exporters.service.js';
import { PUBLIC_FIELDS, PUBLIC_DERIVED } from '../models/Organisation.js';
import { toPublic } from '../utils/toPublic.js';
import { countActiveProducts } from '../services/publicProducts.service.js';

// Public, curated exporter profile (B7). A3: the field list lives on the model
// as PUBLIC_FIELDS and is serialised by the ONE shared `toPublic()` helper — this
// controller does not build its own object literal, so a field added to
// Organisation tomorrow cannot reach a buyer by accident.
//
// This is the first shipped public route; every M3 public surface should be
// written this way. Do not replace it with a hand-rolled projection.
export async function getExporter(req, res) {
  const org = await svc.getPublicExporter({ id: req.params.id });
  // §9b (M2 delivered): productCount = LIVE listings only (active, taken-down
  // excluded). Async, so it rides NEXT TO toPublic() rather than inside
  // PUBLIC_DERIVED (which is sync by design) — whitelisted in m3.md §5b.1 + the
  // projection rule, and pinned by the exact-key test in kyc.test.js.
  const productCount = await countActiveProducts(org._id);
  res.json({
    exporter: {
      ...toPublic(org, { fields: PUBLIC_FIELDS, derived: PUBLIC_DERIVED }),
      productCount,
    },
  });
}
