import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { conversationsApi, conversationKeys } from '../../api/conversations.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useChatDock } from '../../chat/ChatDockContext.jsx';
import { ChatIcon, EnquiryIcon } from '../ui/icons.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { EnquiryModal } from './EnquiryModal.jsx';

/**
 * M4 screen 1 — the ONE door into the whole chat module (M4-4: there are no
 * product-less enquiries).
 *
 * The label depends on whether this buyer already has a thread on this product,
 * because a second enquiry never opens a second thread (M4-5):
 *
 *   guest                     → "Create enquiry" → sign in, come back here
 *   buyer, no thread          → "Create enquiry" → the form
 *   buyer, thread exists      → "Open chat"      → the dock, in place
 *   exporter account          → nothing rendered
 *   own company's product     → nothing rendered (the F4 guard would refuse it)
 *
 * 🔴 Nothing is rendered for the last two rather than showing a control that
 * the server will refuse. The self-enquiry guard (M4-39) is real and lives in
 * the service; this is not enforcement, only honesty about what will work.
 */
export function EnquiryButton({ product }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dock = useChatDock();
  const [openedByClick, setOpenedByClick] = useState(false);

  /**
   * Coming back from sign-in with `?enquire=1` reopens the form the guest was
   * reaching for.
   *
   * DERIVED, not stored: the auth session restores asynchronously, so `isBuyer`
   * is false on the first render and true a moment later — an effect that set
   * state when it flipped was both a cascading render and easy to get wrong.
   * The flag is cleared from the URL when the form CLOSES, which is also what
   * stops a reload or a shared link popping a modal at someone who never asked
   * for one.
   */
  const wantsEnquiry = new URLSearchParams(location.search).has('enquire');

  const isBuyer = user?.role === 'buyer';
  const isExporterAccount = user?.role === 'exporter';
  const isStaff = user?.role === 'employee' || user?.role === 'superadmin';
  // The seller block on a public product carries the org id, so a buyer looking
  // at their own company's listing can be spotted before the server refuses it.
  const ownProduct = Boolean(user?.orgId) && user?.orgId === product?.seller?.id;

  const existing = useQuery({
    queryKey: conversationKeys.byProduct(product?.id),
    queryFn: () => conversationsApi.findByProduct(product.id),
    // Only a signed-in buyer can have a thread; nobody else should spend a
    // request finding that out.
    enabled: Boolean(isBuyer && product?.id && !ownProduct),
    staleTime: 30_000,
  });

  if (isExporterAccount || isStaff || ownProduct) return null;

  // Resolving: a skeleton, never a flash from "Create enquiry" to "Open chat".
  if (existing.isLoading) {
    return <Skeleton className="mt-5 h-12 w-full rounded-xl" />;
  }

  const conversationId = existing.data ?? null;
  const formOpen = openedByClick || (isBuyer && wantsEnquiry && !conversationId);

  const closeForm = () => {
    setOpenedByClick(false);
    // Drop the intent flag so it cannot re-open on the next render.
    if (wantsEnquiry) navigate(location.pathname, { replace: true });
  };

  const openChat = () => {
    // Straight into the dock — the buyer keeps the product page they are on.
    dock.openThread(conversationId);
  };

  const start = () => {
    if (!user) {
      // 🔴 The intent rides in the RETURN PATH, not in router state: sign-in
      // forwards only `from` through the OTP step, so an `intent` field would
      // be silently dropped and the buyer would land back on the product with
      // the form closed, having to start again.
      navigate('/signin', { state: { from: `/product/${product.slug}?enquire=1` } });
      return;
    }
    setOpenedByClick(true);
  };

  return (
    <>
      {conversationId ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={openChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary-700 bg-white px-6 py-3 text-sm font-bold text-primary-800 transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <ChatIcon className="h-4 w-4" aria-hidden="true" />
            Open chat
          </button>
          {/* Without this line the missing form reads as a bug rather than as
              "you already have a conversation about this". */}
          <p className="mt-2 text-center text-xs text-muted">
            You’ve already enquired about this product.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <EnquiryIcon className="h-4 w-4" aria-hidden="true" />
          Create enquiry
        </button>
      )}

      {formOpen && (
        <EnquiryModal
          product={product}
          onClose={closeForm}
          onCreated={(id) => {
            closeForm();
            existing.refetch();
            // M4-35 "OLX-style": the buyer lands straight in the thread — but in
            // the dock, so the product they were reading stays on screen.
            dock.openThread(id);
          }}
        />
      )}
    </>
  );
}
