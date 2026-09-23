import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { conversationsApi, conversationKeys } from '../../api/conversations.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useChatDock } from '../../chat/ChatDockContext.jsx';
import { ChatIcon, EnquiryIcon } from '../ui/icons.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { EnquiryModal } from './EnquiryModal.jsx';
import { PriceLine } from '../catalogue/PriceLine.jsx';
import { SaveButton } from '../saved/SaveButton.jsx';
import { CountrySelect } from '../ui/CountrySelect.jsx';
import { Input } from '../ui/Input.jsx';

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
/**
 * 🆕 `framed` (2026-09-23 product-page mockup) wraps the CTA in the dark
 * "Request a quote" panel the mockup draws.
 *
 * 🔴 It is a PROP here rather than a card built in `ProductDetail`, and that is
 * deliberate: every reason this component renders nothing — an exporter
 * account, staff, the seller's own listing — lives below. A card built around
 * it on the page would have to repeat those guards to avoid drawing an empty
 * navy box, and a duplicated guard is a guard that drifts. Framing from inside
 * means one condition, one place.
 */
export function EnquiryButton({ product, framed = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dock = useChatDock();
  const [openedByClick, setOpenedByClick] = useState(false);
  /**
   * The quote rail's inline quantity + destination (owner, 2026-09-23 — "enquiry
   * box bhi dalo"). They SEED `EnquiryModal`; they never submit on their own,
   * because the API also requires a `note` the rail does not ask for.
   * Goods only — a service enquiry takes engagement type and budget instead
   * (SERVICE_FIELDS, inquiry.validators.js), so the pair would be meaningless.
   */
  const [quantity, setQuantity] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('');

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

  const isServiceListing = product?.category?.type === 'service';
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

  /**
   * Nobody here can send an enquiry — an exporter account, platform staff, or a
   * buyer looking at their own company's listing.
   *
   * 🔴 Inline (`framed === false`) that still means render NOTHING: the button
   * simply is not offered. But `framed` is a whole CARD in the product page's
   * quote rail (2026-09-23), and returning null there leaves a visible hole
   * where "Request a quote" should be — the page reads as broken rather than as
   * "this is not for you". The owner reported exactly that. So the card stays
   * and says why, and it still offers no action.
   */
  if (isExporterAccount || isStaff || ownProduct) {
    if (!framed) return null;
    const reason = ownProduct
      ? 'This is your own listing. Buyers send their enquiries from this page, and they arrive in your enquiries list.'
      : isStaff
        ? 'Staff accounts do not send enquiries. Sign in with a buyer account to contact this supplier.'
        : 'Enquiries are sent by buyer accounts. You are signed in as an exporter.';
    return (
      <section className="rounded-2xl border border-surface-border bg-white p-5">
        <h2 className="text-[15px] font-bold text-ink-900">Request a quote</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{reason}</p>
      </section>
    );
  }

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

  const body = (
    <>
      {conversationId ? (
        <div className="mt-5">
          {/* FILLED, not outlined (2026-09-23). Outlined made sense when this sat
              below a filled "Create enquiry" in the same view; once a thread
              exists it is the only action on the card, and a lone outlined
              button reads as secondary to nothing. */}
          <button
            type="button"
            onClick={openChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
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
          initialFields={{
            ...(quantity ? { quantity } : {}),
            // The listing's own unit travels with the number — the buyer typed a
            // quantity against "meters" on screen, so sending it bare would lose
            // half the meaning.
            ...(quantity && product?.unit ? { unit: product.unit } : {}),
            ...(deliveryCountry ? { deliveryCountry } : {}),
          }}
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

  if (!framed) return body;

  return (
    /* 🎨 WHITE card since the 2026-09-23 product-page mockup — it was a dark
       ink-900 panel, which read as a banner rather than one of the page's cards
       now that the page floats white cards on a warm canvas. `mt-0`: the rail
       positions it, not the button. */
    <section className="rounded-2xl border border-surface-border bg-white p-5">
      {/* 🔴 Everything in this card branches on whether a thread already exists.
          Before the fix it did not, so a buyer who had already enquired saw a
          card headed "Request a quote", two inputs that fed a form they could
          no longer open, and a line promising chat "once your enquiry is sent" —
          which it had been. The one control that mattered, Open chat, sat under
          all of it. */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink-900">
          {conversationId ? 'Your enquiry' : 'Request a quote'}
        </h2>
        <p className="text-xs text-muted">
          {conversationId ? 'Already sent' : 'Free · no commitment'}
        </p>
      </div>

      {/* A compact repeat of the price facts, so the sticky rail still says what
          is being quoted once the summary has scrolled away. Same fields, same
          formatter — `PriceLine` renders the product's OWN currency.

          Light red since 2026-09-24, under the page-wide rule: RED blocks are
          the commercial terms, GREY blocks are the specification. */}
      {(product?.price || product?.moq != null || product?.leadTime) && (
        <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50 p-3.5">
          <p className="text-[11px] text-muted">Indicative</p>
          <PriceLine price={product.price} unit={product.unit} />
          {(product.moq != null || product.leadTime) && (
            <p className="mt-1 text-[12px] text-muted">
              {product.moq != null && `MOQ ${product.moq.toLocaleString('en-IN')}${product.unit ? ` ${product.unit}` : ''}`}
              {product.moq != null && product.leadTime ? ' · ' : ''}
              {product.leadTime && `Lead time ${product.leadTime}`}
            </p>
          )}
        </div>
      )}

      {/* 🔴 The mockup also puts a second "Chat with supplier" button beside the
          first. Still not built: chat does not exist before an enquiry does
          (M4-4 — the enquiry is the one door into chat), so it would be dead on
          every first visit. The single button below already becomes "Open chat"
          once a thread exists, and the line under it says so. */}
      {/* The mockup's inline pair. Rendered for GOODS only, and deliberately
          NOT the whole form: `note` (1–200 chars) is required by the API and is
          asked for in the modal, which these two fields prefill. That is what
          keeps this from being a form that looks submittable but is not
          (`web-ui-notes.md`) — nothing here is collected twice, and the buyer
          can still change both in the modal. */}
      {!conversationId && !isServiceListing && (
        <div className="mt-4 space-y-3">
          <Input
            label={product?.unit ? `Quantity (${product.unit})` : 'Quantity'}
            optional
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={product?.moq != null ? `Min. ${product.moq.toLocaleString('en-IN')}` : undefined}
          />
          <CountrySelect
            label="Ship to"
            optional
            value={deliveryCountry}
            onChange={setDeliveryCountry}
          />
        </div>
      )}

      {/* `body` sets its own top margin; an extra `[&_button]:mt-4` here used to
          stack on it (mt-5 + mt-4) and fight it in the other branch. */}
      {body}

      {/* 🎨 BLACK secondary, under the RED primary — the same pairing the search
          cards use, so the two surfaces teach the buyer one vocabulary: red is
          "contact this supplier", black is "keep this for later".
          It shares state with the heart on the gallery (one `SaveButton`, one
          saved index), so the two never disagree. */}
      {product?.id && (
        <div className="mt-2">
          <SaveButton targetId={product.id} name={product.name} variant="labelled" />
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {conversationId
          ? 'Your messages with this supplier stay in your account. Contact details are shared only through the enquiry.'
          : 'Chat opens once your enquiry is sent. Your contact details are shared through the enquiry, never shown publicly.'}
      </p>
    </section>
  );
}
