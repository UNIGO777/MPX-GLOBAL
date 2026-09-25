import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { productKeys, productsApi } from '../../api/products.js';
import { apiError, formatDate } from '../../lib/format.js';
import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { Field, inputClasses } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * D6 · the seller's "request unblock" on a taken-down product (owner,
 * 2026-09-25). The seller only ASKS. MPX staff approve (the product comes back)
 * or decline with a reason. One request at a time; after a decline, a 7-day
 * wait. The server enforces all of it; this only renders the state it returns.
 *
 * 🔴 A9: never says WHO decided. The server doesn't send it.
 */
export function UnblockRequest({ productId, request }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  const send = useMutation({
    mutationFn: () => productsApi.requestUnblock(productId, message.trim()),
    onMutate: () => setError(null),
    onSuccess: (product) => {
      qc.setQueryData(['products', 'one', productId], product);
      qc.invalidateQueries({ queryKey: productKeys.mine });
      setOpen(false);
      setMessage('');
    },
    onError: (err) => setError(apiError(err).message),
  });

  const status = request?.status ?? null;
  const waitUntil = request?.canAskAgainAt ? new Date(request.canAskAgainAt) : null;
  // Day granularity is enough; the server has the final say anyway.
  const [now] = useState(() => Date.now());
  const mustWait = status === 'rejected' && waitUntil && waitUntil.getTime() > now;
  const canAsk = status !== 'pending' && !mustWait;
  const ok = message.trim().length >= 10;

  return (
    <div className="mt-3 border-t border-danger-200 pt-3">
      {status === 'pending' && (
        <p className="text-sm text-ink-800">
          <span className="font-semibold">Unblock requested {formatDate(request.at)}.</span> The MPX team
          will review it. It won&apos;t be deleted while it&apos;s waiting.
        </p>
      )}
      {status === 'rejected' && (
        <div className="text-sm text-ink-800">
          <p className="font-semibold">Your unblock request was declined {formatDate(request.decidedAt)}.</p>
          {request.rejectReason && <p className="mt-1">{request.rejectReason}</p>}
          {mustWait && <p className="mt-1 text-xs text-muted">You can ask again from {formatDate(waitUntil)}.</p>}
        </div>
      )}
      {canAsk && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-800">Fixed the problem? Ask the MPX team to put it back.</p>
          <Button size="sm" variant="secondary" onClick={() => { setError(null); setOpen(true); }}>
            Request unblock
          </Button>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        centered
        title="Ask for this product to be unblocked"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={send.isPending} disabled={!ok} onClick={() => send.mutate()}>
              Send request
            </Button>
          </>
        }
      >
        <div className="text-left">
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
          <Field
            label="What did you change?"
            helper="Tell the team what you fixed. At least 10 characters."
            trailing={<span className="text-xs text-muted">{message.length}/1000</span>}
          >
            {(id) => (
              <textarea
                id={id}
                rows={5}
                maxLength={1000}
                className={inputClasses(false, 'h-auto py-3')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
          <p className="mt-4 text-sm text-muted">
            The product stays down until the team approves it. If they decline, you&apos;ll see why and
            can ask again after 7 days.
          </p>
        </div>
      </Modal>
    </div>
  );
}
