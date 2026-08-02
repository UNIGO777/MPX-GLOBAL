import { useRef, useState } from 'react';

import { UploadIcon } from './icons.jsx';

/**
 * The upload mockups' per-row file control: a dashed drop zone on the canvas
 * tint — "Drop a file or browse" — that is also a plain click-to-pick button.
 * Real drag-and-drop included; the hidden input keeps keyboard access.
 */
export function FileDrop({ file, accept, disabled, onPick }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) onPick(dropped);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label="Choose file"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          e.target.value = ''; // same file can be re-picked after a fix
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm transition-colors ${
          dragging
            ? 'border-primary-600 bg-primary-50 text-primary-700'
            : 'border-surface-border bg-surface-subtle text-ink-600 hover:border-ink-400'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <UploadIcon className="h-4 w-4" />
        {file ? (
          <span className="truncate font-medium text-ink-900">{file.name}</span>
        ) : (
          <span>
            Drop a file or <span className="font-semibold text-primary-600 underline">browse</span>
          </span>
        )}
      </button>
    </>
  );
}
