import { useRef, useState } from 'react';

import { formatBytes } from '../../lib/format.js';
import { CheckCircleIcon, DocIcon, TrashIcon, UploadIcon } from '../ui/icons.jsx';

/**
 * One KYC document slot as a single interactive ROW (2026-08-11 redesign —
 * the previous per-type cards each carried a full dashed dropzone, and four of
 * them stacked read as clutter). The whole row is the click target AND the drop
 * target; everything about the slot — filename, progress, result — renders
 * inline, so the list stays scannable.
 *
 * States: idle → picked (Clear) → uploading (bar) → done (green, terminal) /
 * error (red, message under the label — server text VERBATIM).
 */
export function DocSlotRow({ label, file, status, progress, error, disabled, accept, onPick, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const done = status === 'done';
  const uploading = status === 'uploading';
  const interactive = !done && !uploading && !disabled;

  const open = () => interactive && inputRef.current?.click();

  const tone = done
    ? 'border-success-300 bg-success-50/40'
    : error
      ? 'border-danger-200 bg-danger-50/40'
      : dragging
        ? 'border-primary-600 bg-primary-50'
        : file
          ? 'border-primary-300 bg-white'
          : 'border-surface-border bg-white hover:border-primary-400 hover:bg-surface-subtle/60';

  return (
    <li
      className={`rounded-xl border transition-colors ${tone} ${interactive ? 'cursor-pointer' : ''}`}
      onClick={open}
      onDragOver={(e) => {
        e.preventDefault();
        if (interactive) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (interactive) onPick(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex items-center gap-3 p-3.5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            done ? 'bg-success-100 text-success-700' : 'bg-primary-50 text-primary-600'
          }`}
          aria-hidden="true"
        >
          {done ? <CheckCircleIcon className="h-5 w-5" /> : <DocIcon className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">{label}</p>
          <p className={`truncate text-xs ${error ? 'font-medium text-danger' : 'text-muted'}`}>
            {done
              ? 'Sent for review'
              : error
                ? error
                : file
                  ? `${file.name} · ${formatBytes(file.size)}`
                  : 'Click or drop a file — PDF, JPG, PNG or WEBP'}
          </p>
        </div>

        {done ? null : file && !uploading ? (
          <button
            type="button"
            aria-label={`Clear ${label} file`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-danger disabled:cursor-not-allowed disabled:text-ink-300"
          >
            <TrashIcon className="h-4 w-4" /> Clear
          </button>
        ) : (
          !uploading && (
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-surface-border px-3 py-1 text-[12px] font-medium text-ink-600"
            >
              <UploadIcon className="h-3.5 w-3.5" /> Add file
            </span>
          )
        )}
      </div>

      {uploading && (
        <div
          className="mx-3.5 mb-3 h-1 overflow-hidden rounded-full bg-ink-200"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uploading ${label}`}
        >
          <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={`Choose ${label} file`}
        disabled={!interactive}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          e.target.value = ''; // same file re-pickable after a fix
        }}
      />
    </li>
  );
}
