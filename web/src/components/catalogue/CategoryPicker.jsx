import { useMemo } from 'react';

import { Combobox } from '../ui/Combobox.jsx';
import { Field } from '../ui/Field.jsx';

/**
 * Two fields, not a tree control (design brief §2).
 *
 * 🔴 THE SUB-CATEGORY IS WHAT IS STORED. A top category is never a valid pick:
 * `Product.categoryId` must be a leaf, and the server rejects a top outright
 * ("Pick a sub-category — products cannot sit on a top category"). The top field
 * exists only to narrow the second one.
 *
 * 🔴 THE SELLER NEVER PICKS GOODS VS SERVICE (§A14). The leaf's own `type`
 * decides which field group and which attributes the form shows, silently —
 * including under "Other", which is seeded as two ordinary typed subs
 * ("Other goods" / "Other services"). There is no toggle for it anywhere in the
 * product flow; if one appears, it is a bug.
 *
 * Takes the whole category tree (one cached `GET /categories`) rather than
 * fetching subs per selection — 40 tops with their children is a single small
 * payload the browse pages already hold.
 */
export function CategoryPicker({ tree = [], topId, subId, onChange, error, disabled }) {
  const subs = useMemo(
    () => tree.find((t) => t.id === topId)?.subs ?? [],
    [tree, topId],
  );

  return (
    // Stacked, not side-by-side: this picker's home is the editor's 300px rail,
    // where two columns crush both fields into truncation (owner screenshot,
    // 2026-08-11). Hybrid Combobox per the same decision — type to filter.
    <div className="grid gap-4">
      <Field
        label="Category"
        helper="Pick the closest match — 'Other' is there if nothing fits."
      >
        {(id) => (
          <Combobox
            id={id}
            value={topId}
            disabled={disabled}
            placeholder="Select a category"
            options={tree.map((top) => ({ value: top.id, label: top.name }))}
            onChange={(v) => onChange({ topId: v, subId: null })}
          />
        )}
      </Field>

      <Field
        label="Sub-category"
        helper="This decides which details we'll ask for."
        error={error}
      >
        {(id, hasError) => (
          <Combobox
            id={id}
            value={subId}
            hasError={hasError}
            // Disabled until a top is chosen — there is nothing to choose from,
            // and an empty open list reads as a broken field.
            disabled={disabled || !topId}
            placeholder={topId ? 'Select a sub-category' : 'Choose a category first'}
            options={subs.map((sub) => ({
              value: sub.id,
              label: sub.name,
              ...(sub.type === 'service' ? { hint: 'Service' } : {}),
            }))}
            onChange={(v) => onChange({ topId, subId: v })}
          />
        )}
      </Field>
    </div>
  );
}
