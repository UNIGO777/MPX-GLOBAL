import * as svc from '../services/publicProducts.service.js';
import { publicProductView } from '../views/publicProduct.view.js';

// M2 browse + detail. §A27.4: these keep their shipped param contract and share
// the query builder with M3's search — only the internal filter construction is
// common, so browse never silently becomes a second search endpoint.

export async function listPublic(req, res) {
  const { rows, total, page, pageSize } = await svc.listPublicProducts(req.validated.query);
  const context = await svc.loadProjectionContext(rows);
  res.json({ products: rows.map((p) => publicProductView(p, context)), total, page, pageSize });
}

export async function getPublic(req, res) {
  const product = await svc.getPublicProduct(req.params.idOrSlug);
  const context = await svc.loadProjectionContext([product]);
  res.json({ product: publicProductView(product, context) });
}
