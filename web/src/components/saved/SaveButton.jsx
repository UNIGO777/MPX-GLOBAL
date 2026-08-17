import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchSavedIndex, savedApi, savedKeys } from '../../api/saved.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { HeartIcon, XIcon } from '../ui/icons.jsx';

/**
 * M3 screen 8 — the save heart, one implementation for every surface
 * (`/category/:slug` cards, `/product/:slug` gallery, `/saved` itself).
 *
 * 🔴 The affordance is visible to EVERYONE; the capability is buyer-only
 * (owner ruling 2026-08-14, superseding the brief's "hidden for exporters"):
 *   · buyer            → real optimistic toggle against `/saved`
 *   · guest            → modal + a Login button (returns here after sign-in)
 *   · signed-in non-buyer (exporter/staff) → modal with OK only
 * The modal is UX. The server still rejects a non-buyer save regardless
 * (§A13) — this never becomes the control (web-frontend.md trust boundary).
 *
 * State comes from the shared saved index (`savedKeys.index()`), fetched once
 * per buyer session and mutated optimistically here, so a heart on any page
 * flips instantly and every other card showing the same product agrees.
 */
export function SaveButton({ targetType = 'product', targetId, name, className = '', variant = 'overlay' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [gateOpen, setGateOpen] = useState(false);

  const isBuyer = user?.role === 'buyer';

  const index = useQuery({
    queryKey: savedKeys.index(),
    queryFn: fetchSavedIndex,
    enabled: isBuyer,
    staleTime: 60_000,
  });

  const savedId = index.data?.[targetId] ?? null;
  const saved = Boolean(savedId);

  const toggle = useMutation({
    mutationFn: async () => {
      if (savedId) {
        await savedApi.unsave(savedId);
        return null;
      }
      const row = await savedApi.save(targetType, targetId);
      return row.id;
    },
    // Optimistic: flip the shared index immediately, roll the whole map back
    // on failure (never leave a heart lying about server state).
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: savedKeys.index() });
      const previous = queryClient.getQueryData(savedKeys.index());
      queryClient.setQueryData(savedKeys.index(), (map = {}) => {
        const next = { ...map };
        if (savedId) delete next[targetId];
        else next[targetId] = 'pending';
        return next;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(savedKeys.index(), context.previous);
    },
    onSuccess: (newId) => {
      queryClient.setQueryData(savedKeys.index(), (map = {}) => {
        const next = { ...map };
        if (newId) next[targetId] = newId;
        else delete next[targetId];
        return next;
      });
      // The list page reads its own paginated query — let it refetch.
      queryClient.invalidateQueries({ queryKey: ['saved', 'list'] });
    },
  });

  const onClick = (e) => {
    // Hearts sit inside link/card surfaces on every page they appear.
    e.preventDefault();
    e.stopPropagation();
    if (!isBuyer) {
      setGateOpen(true);
      return;
    }
    toggle.mutate();
  };

  const base =
    variant === 'overlay'
      ? 'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors'
      : 'flex h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-white transition-colors';
  // 🔴 `text-danger` — NOT `text-danger-DEFAULT`. The latter is not a Tailwind
  // class (DEFAULT is the bare name), so it compiled to nothing and the saved
  // heart rendered black (owner screenshot, 2026-08-16) — the exact trap
  // tailwind.config.js's own comment warns about.
  const tone =
    variant === 'overlay'
      ? saved
        ? 'bg-white text-danger shadow-card'
        : 'bg-black/30 text-white hover:bg-black/45'
      : saved
        ? 'text-danger hover:bg-surface-subtle'
        : 'text-ink-500 hover:text-ink-900 hover:bg-surface-subtle';

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={toggle.isPending}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name ?? 'item'} from saved` : `Save ${name ?? 'item'}`}
        title={saved ? 'Saved' : 'Save'}
        className={`${base} ${tone} ${className}`}
      >
        {/* Filled = saved. Colour alone never carries the state — the fill
            shape differs too, and aria-pressed announces it (web-design.md). */}
        <HeartIcon className="h-5 w-5" style={saved ? { fill: 'currentColor' } : undefined} />
      </button>

      {gateOpen && (
        <SaveGateModal
          signedIn={Boolean(user)}
          onClose={() => setGateOpen(false)}
          onLogin={() => {
            setGateOpen(false);
            // Come back to whatever page the buyer was reading.
            navigate('/signin', { state: { from: location.pathname + location.search } });
          }}
        />
      )}
    </>
  );
}

/** The owner's verbatim gate (2026-08-14): one sentence, then either a Login
 *  button (guest) or OK alone (signed-in non-buyer). Never explains roles. */
function SaveGateModal({ signedIn, onClose, onLogin }) {
  return createPortal(
    // Centered at EVERY width (owner, 2026-08-16) — it was a bottom sheet on
    // phones; a one-line gate reads as a dialog, not a drawer.
    <div role="dialog" aria-modal="true" aria-label="Save this product" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-ink-900/40" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-lift">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-surface-subtle"
        >
          <XIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        {/* Icon BESIDE the sentence (owner, 2026-08-16) — one line of meaning,
            not a stacked badge. pr-8 keeps it clear of the close button. */}
        <div className="flex items-center gap-3 pr-8">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <HeartIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-[15px] font-semibold leading-snug text-ink-900">
            Log in with a buyer account to save this product
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {signedIn ? (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
            >
              OK
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold text-ink-700 hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onLogin}
                className="flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
