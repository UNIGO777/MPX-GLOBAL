import { useRef, useState } from 'react';

import { FileIcon, UploadIcon } from './icons.jsx';
import { formatBytes } from '../../lib/format.js';

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
        className={`flex w-full items-center gap-3 rounded-lg border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          file
            ? // Chosen: a solid row so the FILENAME is the thing you read.
              'h-11 border-solid border-success-300 bg-success-50 px-2.5 text-left'
            : `h-11 justify-center border-dashed px-3 ${
                dragging
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-surface-border bg-surface-subtle text-ink-600 hover:border-ink-400'
              }`
        }`}
      >
        {file ? (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-600 text-white">
              <FileIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink-900" title={file.name}>
              {file.name}
            </span>
            <span className="shrink-0 text-xs text-muted">{formatBytes(file.size)}</span>
          </>
        ) : (
          <>
            <UploadIcon className="h-4 w-4" />
            <span>
              Drop a file or <span className="font-semibold text-primary-600 underline">browse</span>
            </span>
          </>
        )}
      </button>
    </>
  );
}
