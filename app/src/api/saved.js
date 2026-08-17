import { apiClient } from './client.js';

/**
 * M3 — saved items (2026-08-17, wired for the shared product card's heart).
 * Mirrors `web/src/api/saved.js` — same endpoints, same shapes, never an
 * app-only query. BUYER-ONLY on the server (`requireRole('buyer')` on all
 * three routes); the app's product surfaces are buyer-side, and the server
 * is what actually enforces who may save (trust boundary).
 *
 * Shapes (backend `saved.controller.js`):
 *   GET    /saved?targetType&page&pageSize → { items, total, page, pageSize }
 *          item.id is the SAVED ROW id, not the product id — removing needs
 *          that row id, so the index below maps product id → row id.
 *   POST   /saved { targetType, targetId } → { saved: { id, … } }
 *   DELETE /saved/:id → { ok: true }
 */
export const savedApi = {
  list: (params = {}) => apiClient.get('/saved', { params }).then((r) => r.data),
  save: (targetType, targetId) => apiClient.post('/saved', { targetType, targetId }).then((r) => r.data.saved),
  unsave: (savedId) => apiClient.delete(`/saved/${savedId}`).then((r) => r.data),
};

/**
 * The heart index — one `productId → savedRowId` map so any card can answer
 * "is this saved?" without its own request, and un-saving has the row id it
 * needs.
 *
 * ⚠️ Capped at the API's max page size (100), same as web: a buyer past 100
 * saved items sees correct hearts for the 100 most recent only. Fixing that
 * properly needs an ids-only endpoint — not built, deliberately not faked.
 */
export const SAVED_INDEX_PAGE_SIZE = 100;

export async function fetchSavedProductIndex() {
  const data = await savedApi.list({ targetType: 'product', pageSize: SAVED_INDEX_PAGE_SIZE });
  const map = {};
  for (const item of data.items ?? []) {
    if (item.product?.id) map[item.product.id] = item.id;
  }
  return map;
}
