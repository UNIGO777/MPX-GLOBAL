import { useState } from 'react';

import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { GridIcon } from '../../components/ui/icons.jsx';
import { ImageTile, KeywordInput } from './categoryFormParts.jsx';
import { slugify } from '../../lib/slug.js';

/**
 * Create a TOP category (owner-approved 2026-09-23 — create only; tops still
 * cannot be deleted). Goods/services is chosen per SUB-category, as before —
 * a top carries no type (A16). The server enforces a unique name and assigns
 * the page address; this form previews it, and explains that the category
 * starts OFF until it has a sub-category.
 */
const STEPS = [
  { n: 1, label: 'Create the category', note: 'It starts switched off — buyers can’t see it yet.' },
  { n: 2, label: 'Add a sub-category', note: 'Choose goods or services there.' },
  { n: 3, label: 'Switch it on', note: 'Buyers can browse it from then.' },
];

export function AddTopCategoryDrawer({ open, onClose, onSave, saving, error }) {
  const [name, setName] = useState('');
  const [synonyms, setSynonyms] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const slug = slugify(name);

  const reset = () => {
    setName('');
    setSynonyms([]);
    setImageFile(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const submit = () => onSave({ name: name.trim(), synonyms }, imageFile, reset);

  return (
    <Drawer
      open={open}
      onClose={close}
      icon={GridIcon}
      title="Add category"
      subtitle="A new top-level category buyers can browse."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit} disabled={!slug}>
            Create category
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {error && <Alert tone="danger">{error}</Alert>}

        {/* Name + the address it becomes, read together. */}
        <div>
          <Field label="Category name">
            {(id, hasError) => (
              <input
                id={id}
                className={inputClasses(hasError)}
                maxLength={120}
                placeholder="e.g. Toys & Games"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <p className="mt-2 text-xs text-muted">
            Page address{' '}
            <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[12px] text-ink-800">
              /category/{slug || 'your-category'}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">Must be unique — two categories can&apos;t share a name.</p>
        </div>

        <ImageTile file={imageFile} onPick={setImageFile} />

        <KeywordInput id="top-new-synonyms" value={synonyms} onChange={setSynonyms} subject={name.trim() || undefined} />

        {/* How it goes live — a neutral guide, not a warning. */}
        <div className="rounded-2xl border border-surface-border bg-ink-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">How it goes live</p>
          <ol className="mt-3 space-y-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-700 ring-1 ring-primary-200">
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-900">{s.label}</span>
                  <span className="block text-xs text-muted">{s.note}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Drawer>
  );
}
