import { useRef, useState } from 'react';

import { formatBytes } from '../../lib/format.js';
import { RefreshIcon, TrashIcon, UploadIcon } from '../ui/icons.jsx';

/**
 * Up to 5 product images, uploaded the moment they are chosen.
 *
 * 🔴 TWO-STEP BY DESIGN. Files go to `POST /products/images`, which returns
 * `{ url, publicId }` refs; those refs then travel in the JSON create/edit. So
 * per-image progress is real, and one failed upload never blocks the rest of the
 * form. Orphaned uploads (chosen, then the form abandoned) are an accepted MVP
 * cost — do not add a cleanup path without asking.
 *
 * 🔴 ALL THREE LIMITS ARE STATED BEFORE THE FIRST PICK — "Up to 5 images · 5 MB
 * each · JPG, PNG or WEBP". The server enforces every one of them (multer size
 * cap + magic-byte check + the model's max-5 validator); learning a limit only
 * after a failed upload is the failure this line exists to prevent.
 *
 * The first image is the COVER and is labelled as such — it is what every
 * product card renders.
 */
const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export function ProductImageManager({ images = [], onChange, onUpload, disabled }) {
  const inputRef = useRef(null);
  const [pending, setPending] = useState([]); // { id, name, error }
  const [dragging, setDragging] = useState(false);

  const remaining = MAX_IMAGES - images.length - pending.length;

  async function accept(fileList) {
    const files = [...fileList].slice(0, Math.max(0, remaining));
    for (const file of files) {
      const id = `${file.name}-${file.size}-${Math.random().toString(16).slice(2)}`;
      // Checked client-side purely so the user learns immediately; the server
      // rejects an oversize file regardless.
      if (file.size > MAX_BYTES) {
        setPending((p) => [...p, { id, name: file.name, error: `Over 5 MB (${formatBytes(file.size)})` }]);
        continue;
      }
      setPending((p) => [...p, { id, name: file.name }]);
      try {
        const refs = await onUpload([file]);
        onChange([...images, ...refs]);
        setPending((p) => p.filter((x) => x.id !== id));
      } catch {
        setPending((p) => p.map((x) => (x.id === id ? { ...x, error: 'Upload failed' } : x)));
      }
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="text-sm font-medium text-ink-900">Images</span>
        <p className="text-xs text-muted">
          Up to {MAX_IMAGES} images · 5 MB each · JPG, PNG or WEBP. First image is the cover.
        </p>
      </div>

      {images.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <li
              key={img.publicId}
              className="relative h-24 w-24 overflow-hidden rounded-lg border border-surface-border bg-white"
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-ink-900/70 py-0.5 text-center text-[10px] font-semibold text-white">
                  Cover
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove image ${i + 1}`}
                disabled={disabled}
                onClick={() => onChange(images.filter((x) => x.publicId !== img.publicId))}
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-ink-600 hover:text-danger"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                p.error ? 'border-danger-200 bg-danger-50' : 'border-surface-border bg-white'
              }`}
            >
              <span className="min-w-0 truncate text-ink-800">{p.name}</span>
              {p.error ? (
                <span className="flex shrink-0 items-center gap-2 text-xs text-danger">
                  {p.error}
                  <button
                    type="button"
                    onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}
                    className="inline-flex items-center gap-1 font-semibold hover:underline"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" /> Dismiss
                  </button>
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted">Uploading…</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
          className={`flex min-h-[96px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors ${
            dragging
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-surface-border bg-white text-ink-600 hover:bg-surface-subtle'
          }`}
        >
          <UploadIcon className="h-5 w-5 text-ink-500" />
          <span className="font-medium">Drag images here, or browse</span>
          <span className="text-xs text-muted">{remaining} remaining</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => { accept(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
