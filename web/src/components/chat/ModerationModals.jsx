import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { adminConversationsApi } from '../../api/conversations.js';
import { TONE_WORD, WARNING_TONES } from './warningTones.js';
import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * The conversation-moderation dialogs (block · unblock · warn), shared by the admin list (row
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

/**
 * Send a platform WARNING (owner, 2026-09-24). Staff PICK one of the server's
 * pre-written warnings — there is no text box, by design (owner: "staff cannot
 * write, just select the existing warning labels"). The exact words that will
 * post are shown before sending, because they go to two companies at once.
 */
export function WarnModal({ open, onClose, onConfirm, pending, error }) {
  const [picked, setPicked] = useState(null);
  const list = useQuery({
    queryKey: ['admin', 'conversation-warnings'],
    queryFn: adminConversationsApi.warnings,
    enabled: open,
    // Re-read on every opening. It used to be cached for the whole session, so a
    // tab opened before the tones existed kept an untoned list and painted every
    // warning amber (owner, 2026-09-24).
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const close = () => {
    setPicked(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Send a warning">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Both the buyer and the seller will see it in the thread as a notice from MPX Global. It
          does not block the conversation.
        </p>

        {error && <Alert tone="danger">{error}</Alert>}
        {list.isError && <Alert tone="danger">The warnings could not be loaded. Close and try again.</Alert>}
        {list.isPending && <p className="text-sm text-muted">Loading warnings…</p>}

        {list.isSuccess && (
          <div role="radiogroup" aria-label="Warning to send" className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {list.data.map((w) => {
              const on = picked === w.key;
              // The SAME colour the notice will have in the thread.
              // No silent amber fallback — an unknown tone renders neutral, so a
              // stale or wrong list is visible rather than disguised.
              const tone = WARNING_TONES[w.tone] ?? WARNING_TONES.reminder;
              return (
                <button
                  key={w.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(w.key)}
                  className={`relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-3 pl-4 text-left transition-colors ${
                    on ? `ring-1 ${tone.card}` : 'border-surface-border bg-white hover:bg-ink-50'
                  }`}
                >
                  {/* The tone's colour down the leading edge, like the notice. */}
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${tone.swatch}`} />
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? tone.radio : 'border-ink-300'
                    }`}
                  >
                    {on && <span className={`h-2 w-2 rounded-full ${tone.radioDot}`} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink-900">{w.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${tone.chip}`}>
                        {TONE_WORD[w.tone] ?? 'Warning'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-600">{w.body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
          <Button
            loading={pending}
            disabled={!picked}
            onClick={() => onConfirm(picked, () => setPicked(null))}
          >
            Send warning
          </Button>
        </div>
      </div>
    </Modal>
  );
}
