import { useMemo } from 'react';

import { Field, inputClasses } from '../ui/Field.jsx';

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
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="Category"
        helper="Pick the closest match — 'Other' is there if nothing fits."
      >
        {(id) => (
          <select
            id={id}
            className={inputClasses(false)}
            value={topId ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ topId: e.target.value || null, subId: null })}
          >
            <option value="">Select a category</option>
            {tree.map((top) => (
              <option key={top.id} value={top.id}>{top.name}</option>
            ))}
          </select>
        )}
      </Field>

      <Field
        label="Sub-category"
        helper="This decides which details we'll ask for."
        error={error}
      >
        {(id, hasError) => (
          <select
            id={id}
            className={inputClasses(hasError)}
            value={subId ?? ''}
            // Disabled until a top is chosen — there is nothing to choose from,
            // and an empty open select reads as a broken field.
            disabled={disabled || !topId}
            onChange={(e) => onChange({ topId, subId: e.target.value || null })}
          >
            <option value="">{topId ? 'Select a sub-category' : 'Choose a category first'}</option>
            {subs.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}
