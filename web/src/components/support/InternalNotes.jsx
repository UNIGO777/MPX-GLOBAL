import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notesApi, notesKeys } from '../../api/support.js';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { Button } from '../ui/Button.jsx';
import { SkeletonRows } from '../ui/Skeleton.jsx';
import { LockIcon } from '../ui/icons.jsx';
import { initialsOf } from '../chat/CompanyAvatar.jsx';

/**
 * Step 1c · staff-only internal notes, for any subject (organisation,
 * conversation, ticket). Never shown to a company — the server has no
 * company-facing route for them. Append-only: a correction is a new note.
 *
 * Render it only where the viewer holds the subject's permission; the server
 * re-checks regardless.
 */
export function InternalNotes({ subjectType, subjectId, className = '', bare = false }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const notes = useQuery({ queryKey: notesKeys.list(subjectType, subjectId), queryFn: () => notesApi.list(subjectType, subjectId) });
  const add = useMutation({
    mutationFn: (body) => notesApi.add(subjectType, subjectId, body),
    onSuccess: (note) => {
      qc.setQueryData(notesKeys.list(subjectType, subjectId), (prev) => [note, ...(prev ?? [])]);
      setDraft('');
    },
  });

  const list = notes.data ?? [];

  return (
    // `bare`: inside a drawer tab that already says "Notes" — no card frame or title bar.
    <section className={bare ? className : `overflow-hidden rounded-2xl border border-warning-200 bg-white shadow-card ${className}`}>
      <h2 className={bare ? 'sr-only' : 'flex items-center gap-2 border-b border-warning-200 bg-warning-50/70 px-4 py-2.5 text-sm font-bold text-ink-900'}>
        <LockIcon className="h-4 w-4 text-warning-700" aria-hidden="true" />
        Internal notes
        {list.length > 0 && (
          <span className="rounded-full bg-warning-100 px-2 py-px text-[11px] font-bold tabular-nums text-warning-800">{list.length}</span>
        )}
        <span className="ml-auto text-[11.5px] font-medium text-warning-800">Staff only</span>
      </h2>

      {notes.isLoading ? (
        <SkeletonRows rows={2} />
      ) : notes.error ? (
        <p className="px-4 py-3 text-sm text-muted">{apiError(notes.error).message}</p>
      ) : list.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-[13px] font-semibold text-ink-800">No notes yet</p>
          <p className="mx-auto mt-0.5 max-w-[16rem] text-[12px] leading-snug text-muted">
            Leave context for the rest of the team — what you checked, who you spoke to.
          </p>
        </div>
      ) : (
        // Newest first; scrolls inside once there are many.
        <ol className={bare ? 'space-y-3 py-1' : 'max-h-96 space-y-3 overflow-y-auto px-3 py-3'}>
          {list.map((n) => (
            <li key={n.id} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[10.5px] font-bold text-white"
              >
                {initialsOf(n.author.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px]">
                  <span className="font-semibold text-ink-900">{n.author.name}</span>
                  <span className="text-muted">{formatDate(n.createdAt)} · {formatTime(n.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-xl rounded-tl-sm bg-warning-50 px-3 py-2 text-[13.5px] leading-relaxed text-ink-800 ring-1 ring-inset ring-warning-100">
                  {n.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className={bare ? 'mt-4 space-y-2 rounded-xl border border-surface-border bg-surface-subtle/60 p-3' : 'space-y-2 border-t border-surface-border bg-surface-subtle/40 p-3'}>
        <label htmlFor={`note-${subjectId}`} className="sr-only">Add an internal note</label>
        <textarea
          id={`note-${subjectId}`}
          rows={2}
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note for the team…"
          className="block w-full resize-y rounded-xl border border-surface-border bg-white px-3 py-2 text-[13.5px] text-ink-900 placeholder:text-ink-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-muted">Can&apos;t be edited or deleted.</span>
          <Button size="sm" loading={add.isPending} disabled={!draft.trim()} onClick={() => add.mutate(draft.trim())}>
            Add note
          </Button>
        </div>
        {add.error && <p className="text-xs font-medium text-danger-700">{apiError(add.error).message}</p>}
      </div>
    </section>
  );
}
