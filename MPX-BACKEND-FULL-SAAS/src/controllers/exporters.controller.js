import * as svc from '../services/exporters.service.js';
import { PUBLIC_FIELDS, PUBLIC_DERIVED } from '../models/Organisation.js';
import { toPublic } from '../utils/toPublic.js';

// Public, curated exporter profile (B7). A3: the field list lives on the model
// as PUBLIC_FIELDS and is serialised by the ONE shared `toPublic()` helper — this
// controller does not build its own object literal, so a field added to
// Organisation tomorrow cannot reach a buyer by accident.
//
// This is the first shipped public route; every M3 public surface should be
// written this way. Do not replace it with a hand-rolled projection.
export async function getExporter(req, res) {
  const org = await svc.getPublicExporter({ id: req.params.id });
  res.json({
    exporter: toPublic(org, { fields: PUBLIC_FIELDS, derived: PUBLIC_DERIVED }),
  });
}
