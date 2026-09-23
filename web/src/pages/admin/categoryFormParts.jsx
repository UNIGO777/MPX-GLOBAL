import { useRef, useState } from 'react';

import { inputClasses } from '../../components/ui/Field.jsx';
import { ImageIcon, XIcon } from '../../components/ui/icons.jsx';

/**
 * The pieces the three category side panels share (add top · top settings ·
 * add/edit sub-category), so they read as one family instead of three forms
 * that drifted apart.
 */

/** Section label with an optional muted "Optional" tag, matching Field. */
export function PartLabel({ htmlFor, children, optional = false, count }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink-900">
      {children}
      {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      {count > 0 && (
        <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-700">
          {count}
        </span>
      )}
    </label>
  );
}

/** The public address under a name field — the slug in a code chip. */
export function AddressLine({ path, note }) {
  return (
    <div className="mt-2 space-y-1 text-xs text-muted">
      <p className="flex min-w-0 flex-wrap items-center gap-1.5">
        Page address
        <span className="max-w-full truncate rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[12px] text-ink-800">
          {path}
        </span>
      </p>
      {note && <p>{note}</p>}
    </div>
  );
}

/**
 * Upload tile with the preview inside it. `current` is the image already
 * saved (a URL); `file` is a newly picked one that uploads with Save.
 */
export function ImageTile({ file, current, onPick, disabled = false }) {
  const ref = useRef(null);
  const src = file ? URL.createObjectURL(file) : current;

  return (
    <div>
      <PartLabel optional>Image</PartLabel>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={disabled}
          className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 transition-colors hover:border-primary-400 hover:bg-primary-50 disabled:cursor-not-allowed disabled:hover:border-ink-200 disabled:hover:bg-ink-50"
          aria-label={src ? 'Replace image' : 'Add image'}
        >
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-7 w-7 text-ink-400 group-hover:text-primary-600" />
          )}
        </button>
        <div className="min-w-0 text-xs text-muted">
          <p className="truncate text-sm font-medium text-ink-800">
            {file ? file.name : current ? 'Click the image to replace it' : 'Shown on the category card'}
          </p>
          <p className="mt-0.5">{file ? 'Uploads when you save' : 'JPG, PNG or WEBP · up to 5 MB'}</p>
          {file && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="mt-1.5 font-semibold text-primary-700 hover:underline"
            >
              {current ? 'Keep the current image' : 'Remove'}
            </button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose category image"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

/**
 * Search keywords as chips. Enter or a comma adds one; Backspace on an empty
 * box removes the last. A typed-but-unconfirmed word is added on blur, so it
 * is never silently lost when the person clicks Save.
 *
 * 🔴 §A12: keywords are search-matching only and never shown publicly.
 */
export function KeywordInput({ id, value, onChange, disabled = false, subject, placeholder = 'e.g. toys, games, puzzles' }) {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const words = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (words.length) onChange([...value, ...words.filter((w) => !value.includes(w))]);
    setDraft('');
  };

  return (
    <div>
      <PartLabel htmlFor={id} optional count={value.length}>
        Search keywords
      </PartLabel>
      <div
        className={`flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 transition-colors focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/20 ${
          disabled ? 'bg-ink-50' : 'bg-white'
        }`}
        onClick={() => document.getElementById(id)?.focus()}
      >
        {value.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary-700"
          >
            {k}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${k}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((x) => x !== k));
                }}
                className="rounded-full p-0.5 hover:bg-primary-100"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            id={id}
            className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink-500"
            placeholder={value.length ? 'Add another…' : placeholder}
            value={draft}
            onChange={(e) => {
              // A pasted "a, b, c" becomes three chips straight away.
              if (e.target.value.includes(',')) add(e.target.value);
              else setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(draft);
              }
              if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
            }}
            onBlur={() => add(draft)}
          />
        )}
        {disabled && value.length === 0 && <span className="text-sm text-muted">No keywords yet.</span>}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        Words buyers might type so search finds {subject ? `“${subject}”` : 'this category'}. Press Enter
        or a comma to add one. Never shown publicly.
      </p>
    </div>
  );
}

/** "Display order" — label left, a small number box right. */
export function OrderInput({ id, value, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-surface-border px-4 py-3">
      <label htmlFor={id} className="min-w-0 flex-1 text-sm font-medium text-ink-900">
        Display order
        <span className="block text-xs font-normal text-muted">Lower shows first — the others shift around it.</span>
      </label>
      {/* Fixed-width wrapper: inputClasses bakes in w-full, so a width on the
          input itself loses (owner screenshot, 2026-08-14). */}
      <div className="w-20 shrink-0">
        <input
          id={id}
          type="number"
          min={1}
          inputMode="numeric"
          className={inputClasses(false, 'text-center')}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
