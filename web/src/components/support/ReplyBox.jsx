import { useRef, useState } from 'react';

import { Button } from '../ui/Button.jsx';
import { PaperclipIcon, XIcon } from '../ui/icons.jsx';
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, chatFileProblem, fileBadge, isImageFile } from '../../lib/chatFiles.js';

/**
 * Reply to a support ticket: message + ONE optional file (image or
 * PDF/.docx/.xlsx), same limits as chat. `onSend({ body, file })` returns a
 * promise; the box clears only when it resolves.
 */
export function ReplyBox({ onSend, sending, placeholder = 'Write a reply…', note, embedded = false }) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [problem, setProblem] = useState(null);
  const inputRef = useRef(null);

  const pick = (f) => {
    if (!f) return;
    const p = chatFileProblem(f, isImageFile(f) ? 'image' : 'document');
    setProblem(p);
    setFile(p ? null : f);
  };

  const send = async () => {
    if (!body.trim() && !file) return;
    await onSend({ body: body.trim(), file });
    setBody('');
    setFile(null);
    setProblem(null);
  };

  return (
    // `embedded`: sits at the foot of a conversation panel that draws the frame.
    <div className={embedded ? 'bg-white p-3 sm:px-4' : 'rounded-2xl border border-surface-border bg-white p-3 shadow-card'}>
      <label htmlFor="ticket-reply" className="sr-only">Reply</label>
      <textarea
        id="ticket-reply"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className="block w-full resize-y rounded-xl border-0 bg-transparent px-2 py-1.5 text-[14px] text-ink-900 placeholder:text-ink-500 focus:outline-none"
      />
      {file && (
        <div className="mx-2 mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-ink-100 py-1 pl-2 pr-1 text-[12.5px] font-medium text-ink-800">
          <span className="rounded bg-white px-1.5 text-[10px] font-bold">{isImageFile(file) ? 'IMG' : fileBadge(file.name)}</span>
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="rounded-full p-1 hover:bg-ink-200">
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      )}
      {problem && <p className="mx-2 mb-2 text-[12.5px] font-medium text-danger-700">{problem}</p>}
      <div className="flex items-center justify-between gap-3 border-t border-surface-border px-1 pt-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-700 hover:bg-ink-100"
          >
            <PaperclipIcon className="h-4 w-4" aria-hidden="true" />
            Attach
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={`${IMAGE_ACCEPT},${DOCUMENT_ACCEPT}`}
            className="sr-only"
            aria-label="Attach a file"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {note && <span className="hidden truncate text-[12px] text-muted sm:inline">{note}</span>}
        </div>
        <Button size="sm" loading={sending} disabled={!body.trim() && !file} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
