import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { BuildingIcon, DownloadIcon, ExternalIcon, ShieldIcon } from '../ui/icons.jsx';
import { fileBadge, formatFileSize } from '../../lib/chatFiles.js';
import { formatDate, formatTime } from '../../lib/format.js';

/**
 * A support ticket's thread (Step 1b), for either audience.
 *
 * `viewer="company"`: their own messages on the right as "You"; staff on the
 *   left as "MPX Global Support" — never an employee's name (the server does
 *   not even send one to a company).
 * `viewer="staff"`: the company on the left (creator's name + company), staff on
 *   the right with the employee's name — staff need to know who said what.
 */
export function TicketThread({ messages, viewer, companyName }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = viewer === 'company' ? m.authorType === 'company' : m.authorType === 'staff';
        const who =
          viewer === 'company'
            ? m.authorType === 'staff'
              ? 'MPX Global Support'
              : 'You'
            : m.authorType === 'staff'
              ? `${m.author?.name ?? 'Staff'} · MPX Global Support`
              : `${m.author?.name ?? 'Company'}${companyName ? ` · ${companyName}` : ''}`;
        return (
          <li key={m.id} className={`flex items-start gap-2.5 ${mine ? 'justify-end' : 'justify-start'}`}>
            {!mine && (
              <span
                aria-hidden="true"
                className={`mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  m.authorType === 'staff' ? 'bg-primary-600 text-white' : 'bg-white text-ink-600 ring-1 ring-surface-border'
                }`}
              >
                {m.authorType === 'staff' ? <ShieldIcon className="h-4 w-4" /> : <BuildingIcon className="h-4 w-4" />}
              </span>
            )}
            <div className={`min-w-0 max-w-[min(34rem,85%)] ${mine ? 'items-end text-right' : ''}`}>
              <p className={`mb-1 flex items-center gap-1.5 text-[12px] font-semibold ${mine ? 'justify-end' : ''} ${
                m.authorType === 'staff' ? 'text-primary-700' : 'text-ink-600'
              }`}
              >
                {who}
                <span className="font-normal text-ink-500">· {formatDate(m.createdAt)} {formatTime(m.createdAt)}</span>
              </p>
              <div
                className={`inline-block rounded-2xl px-4 py-3 text-left text-[14px] leading-relaxed ${
                  mine
                    ? 'rounded-tr-md bg-primary-600 text-white'
                    : 'rounded-tl-md border border-surface-border bg-white text-ink-900 shadow-sm'
                }`}
              >
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.attachment && <Attachment att={m.attachment} onDark={mine} spaced={Boolean(m.body)} />}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The link is a short-lived signed one, so a thread left open long enough
 * shows a broken image. Say so and fetch the thread again (new links) instead
 * of leaving a broken-image glyph. Width/height reserve the space so the
 * thread does not jump as images load.
 */
function AttachedImage({ att, onDark, spaced }) {
  const qc = useQueryClient();
  const [failed, setFailed] = useState(false);
  const ratio = att.width && att.height ? { aspectRatio: `${att.width} / ${att.height}` } : undefined;

  if (failed) {
    return (
      <div className={`flex items-center gap-3 rounded-xl p-2.5 text-[13px] ${spaced ? 'mt-2' : ''} ${onDark ? 'bg-white/15' : 'bg-ink-50 text-ink-700'}`}>
        <span className="flex-1">Image unavailable — the link may have expired.</span>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            // Both the company's and the staff view of a ticket; either may be on screen.
            qc.invalidateQueries({ queryKey: ['support', 'ticket'] });
            qc.invalidateQueries({ queryKey: ['admin', 'support', 'ticket'] });
          }}
          className="min-h-[36px] rounded-full px-3 font-semibold underline underline-offset-2 hover:bg-black/10"
        >
          Reload
        </button>
      </div>
    );
  }
  return (
    <a href={att.url} target="_blank" rel="noreferrer" className={`block ${spaced ? 'mt-2' : ''}`}>
      <img
        src={att.url}
        alt="Attached image"
        width={att.width ?? undefined}
        height={att.height ?? undefined}
        loading="lazy"
        onError={() => setFailed(true)}
        style={ratio}
        className="h-auto max-h-64 w-auto max-w-full rounded-xl object-contain"
      />
    </a>
  );
}

function Attachment({ att, onDark, spaced }) {
  if (att.kind === 'image') return <AttachedImage att={att} onDark={onDark} spaced={spaced} />;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-2.5 ${spaced ? 'mt-2' : ''} ${
        onDark ? 'bg-white/15' : 'bg-ink-50'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${onDark ? 'bg-white/20 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-200'}`}>
        {fileBadge(att.format ?? att.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{att.name}</span>
        <span className={`block text-[11.5px] ${onDark ? 'text-white/70' : 'text-muted'}`}>{formatFileSize(att.bytes)}</span>
      </span>
      {att.viewUrl && (
        <a href={att.viewUrl} target="_blank" rel="noreferrer" aria-label={`Open ${att.name}`} className="rounded-full p-1.5 hover:bg-black/10">
          <ExternalIcon className="h-4 w-4" />
        </a>
      )}
      <a href={att.url} aria-label={`Download ${att.name}`} className="rounded-full p-1.5 hover:bg-black/10">
        <DownloadIcon className="h-4 w-4" />
      </a>
    </div>
  );
}
