import { useCallback, useState } from 'react';

import { fetchSavedProductIndex, savedApi } from '../api/saved.js';
import { useToast } from '../components/Toast.jsx';

/**
 * The heart, shared (extracted 2026-08-18 on its THIRD user — supplier
 * profile joined the listing grid and Home's rail, and three copies of the
 * same optimistic-toggle logic is where duplication stops being cheaper).
 *
 * `loadIndex()` returns a promise so a screen can run it inside its own
 * `Promise.all` — and it never throws: a failed index means hearts start
 * unfilled (they correct themselves on the next successful load), because
 * the catalogue must not error for the sake of the hearts.
 *
 * `toggleSave` is optimistic with VISIBLE rollback — the heart flips
 * immediately, and flips back with a danger toast if the server refuses.
 */
export function useSavedProducts() {
  const toast = useToast();
  const [savedIndex, setSavedIndex] = useState({});

  const loadIndex = useCallback(async () => {
    const index = await fetchSavedProductIndex().catch(() => null);
    if (index) setSavedIndex(index);
  }, []);

  const toggleSave = useCallback(
    async (product, savedId) => {
      if (savedId != null) {
        setSavedIndex((m) => {
          const { [product.id]: _removed, ...rest } = m;
          return rest;
        });
        try {
          await savedApi.unsave(savedId);
        } catch {
          setSavedIndex((m) => ({ ...m, [product.id]: savedId }));
          toast.show("Couldn't remove — try again.", { tone: 'danger' });
        }
        return;
      }
      setSavedIndex((m) => ({ ...m, [product.id]: 'pending' }));
      try {
        const saved = await savedApi.save('product', product.id);
        setSavedIndex((m) => ({ ...m, [product.id]: saved.id }));
      } catch {
        setSavedIndex((m) => {
          const { [product.id]: _removed, ...rest } = m;
          return rest;
        });
        toast.show("Couldn't save — try again.", { tone: 'danger' });
      }
    },
    [toast],
  );

  return { savedIndex, loadIndex, toggleSave };
}
