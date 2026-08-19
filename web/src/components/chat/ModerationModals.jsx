import { useState } from 'react';

import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * The two conversation-moderation dialogs, shared by the admin list (row
 * actions, m5 §7 screen 9) and the viewer (screen 10) so the copy — which is a
 * promise to the two companies involved — can never drift between the two doors.
 * Gate is the CALLER's job: render these only behind `conversation:block`.
 */
export const REASON_MIN = 3;
export const REASON_MAX = 500;

export function BlockModal({ open, onClose, onConfirm, pending, error }) {
  const [reason, setReason] = useState('');
  const tooShort = reason.trim().length < REASON_MIN;

  return (
    <Modal open={open} onClose={onClose} title="Block this conversation" danger>
      <div className="space-y-4">
        <Alert tone="warning">
          Messaging freezes for both sides immediately. The product stays live and its other
          conversations are unaffected. This is reversible.
        </Alert>

        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Reason"
          helper="Both the buyer and the seller will see this reason — write it for them."
          trailing={<span className="text-xs text-muted">{REASON_MAX - reason.length} left</span>}
        >
          {(id) => (
            <textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={REASON_MAX}
              rows={4}
              placeholder="e.g. Both parties attempted to move payment off the platform, against the marketplace terms."
              className="block w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />
          )}
        </Field>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant="danger" loading={pending} disabled={tooShort} onClick={() => onConfirm(reason.trim())}>
            Block conversation
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function UnblockModal({ open, onClose, onConfirm, pending, error }) {
  const [reason, setReason] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Unblock this conversation">
      <div className="space-y-4">
        {/* 🔴 M4-30 designed in: unblocking RE-DERIVES the freeze rather than
            toggling it. Promising a reopening we cannot guarantee is how a
            moderator ends up telling a company something untrue. */}
        <Alert tone="info">
          If the product is under review or a party’s account is blocked, this conversation will
          stay frozen for that reason.
        </Alert>

        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Internal note"
          optional
          helper="For the audit record — the parties do not see this."
        >
          {(id) => (
            <textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={REASON_MAX}
              rows={3}
              className="block w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm text-ink-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />
          )}
        </Field>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button loading={pending} onClick={() => onConfirm(reason.trim() || undefined)}>
            Unblock
          </Button>
        </div>
      </div>
    </Modal>
  );
}
