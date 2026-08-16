import { apiClient } from './client.js';

/**
 * M3 screen 8 — saved items. BUYER-ONLY on the server (`requireRole('buyer')`
 * on all three routes); this client never assumes otherwise. The UI's job is
 * to render the buyer's own list and to keep the heart honest — the server is
 * what actually enforces who may save (web-frontend.md trust boundary).
 *
 * Shapes (backend `saved.controller.js`, unchanged):
 *   GET    /saved?targetType&page&pageSize → { items, total, page, pageSize }
 *          item = { id, targetType, savedAt, available, unavailableReason,
 *                   product|supplier }   ← id is the SAVED ROW id, not the
 *          product id. Removing needs that row id, so the index below maps
 *          product id → row id.
 *   POST   /saved { targetType, targetId } → { saved: { id, … } }
 *   DELETE /saved/:id → { ok: true }
 */
export const savedApi = {
  list: (params = {}) => apiClient.get('/saved', { params }).then((r) => r.data),
  save: (targetType, targetId) =>
    apiClient.post('/saved', { targetType, targetId }).then((r) => r.data.saved),
  unsave: (savedId) => apiClient.delete(`/saved/${savedId}`).then((r) => r.data),
};

export const savedKeys = {
  list: (params) => ['saved', 'list', params],
  index: () => ['saved', 'index'],
};

/**
 * The heart index — one map of `targetId → savedRowId` so any card anywhere
 * can answer "is this saved?" without its own request, and so un-saving has
 * the row id it needs.
 *
 * ⚠️ Capped at the API's max page size (100). A buyer past 100 saved items
 * sees correct hearts for the 100 most recent only; older ones render
 * unfilled until opened from `/saved` itself. Fixing that properly needs an
 * ids-only endpoint — not built, deliberately not faked here.
 */
export const SAVED_INDEX_PAGE_SIZE = 100;

export async function fetchSavedIndex() {
  const data = await savedApi.list({ pageSize: SAVED_INDEX_PAGE_SIZE });
  const map = {};
  for (const item of data.items ?? []) {
    const target = item.targetType === 'product' ? item.product : item.supplier;
    if (target?.id) map[target.id] = item.id;
  }
  return map;
}
