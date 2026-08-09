import { Field, inputClasses } from '../ui/Field.jsx';

/**
 * The dynamic specification fields — one control per `CategoryAttribute`
 * `inputType`. This component IS most of the product form.
 *
 * Definitions arrive from `GET /categories/:idOrSlug/attributes`, already sorted
 * by `order`. Render them in that order; it is an admin decision.
 *
 * 🔴 REQUIRED IS ENFORCED AT PUBLISH, NOT AT DRAFT-SAVE. A seller must be able to
 * save half-finished work without a fight, so `required` here only marks the
 * field — the refusal comes from the server on the publish call and names the
 * missing fields.
 *
 * ⚠️ **Launch reality, from the seed:** every seeded attribute is
 * `required: false` and NONE are `select` — §A25.2 forbids inventing options, so
 * a `select` only exists once an admin defines one in the attribute manager.
 * Expect 5–8 optional text/number/boolean fields per leaf (Cotton fabric ships
 * `material · gsm · width · weave · colour · pattern`). Build for that, not for a
 * hypothetical select-heavy form.
 *
 * Values are stored as PRIMITIVES on the product (`{ key, value }`) and the
 * server's validator refuses anything else — so a number field must emit a
 * Number, not a numeric string, or the save 400s.
 */
export function AttributeFields({ defs = [], values = {}, onChange, errors = {} }) {
  if (defs.length === 0) return null;

  const set = (key, value) => onChange({ ...values, [key]: value });

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {defs.map((def) => {
        const value = values[def.key];
        const error = errors[def.key];

        if (def.inputType === 'boolean') {
          return (
            <Field key={def.key} label={def.name} error={error} optional={!def.required}>
              {(id) => (
                <div className="flex gap-2" role="radiogroup" aria-labelledby={id} id={id}>
                  {[['Yes', true], ['No', false]].map(([label, v]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={value === v}
                      onClick={() => set(def.key, value === v ? undefined : v)}
                      className={`min-h-[44px] flex-1 rounded-lg border text-sm font-medium transition-colors ${
                        value === v
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-surface-border bg-white text-ink-600 hover:bg-surface-subtle'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          );
        }

        if (def.inputType === 'select') {
          return (
            <Field key={def.key} label={def.name} error={error} optional={!def.required}>
              {(id, hasError) => (
                <select
                  id={id}
                  className={inputClasses(hasError)}
                  value={value ?? ''}
                  onChange={(e) => set(def.key, e.target.value || undefined)}
                >
                  <option value="">Select</option>
                  {(def.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
            </Field>
          );
        }

        if (def.inputType === 'number') {
          return (
            <Field key={def.key} label={def.name} error={error} optional={!def.required}>
              {(id, hasError) => (
                <div className="relative">
                  <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    // Number, never a string — Product.attributes[].value is a
                    // primitive union and the validator rejects the wrong type.
                    className={inputClasses(hasError, def.unit ? 'pr-14' : '')}
                    value={value ?? ''}
                    onChange={(e) => set(def.key, e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                  {/* The unit sits INSIDE the field ("120 gsm") — design brief §2. */}
                  {def.unit && (
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
                      {def.unit}
                    </span>
                  )}
                </div>
              )}
            </Field>
          );
        }

        return (
          <Field key={def.key} label={def.name} error={error} optional={!def.required}>
            {(id, hasError) => (
              <input
                id={id}
                type="text"
                maxLength={500}
                className={inputClasses(hasError)}
                value={value ?? ''}
                onChange={(e) => set(def.key, e.target.value || undefined)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

/** `{ key: value }` → the `attributes[]` array the API expects (empties dropped). */
export function toAttributeArray(values = {}) {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([key, value]) => ({ key, value }));
}

/** The reverse, for loading an existing product into the form. */
export function fromAttributeArray(list = []) {
  return Object.fromEntries(list.map((a) => [a.key, a.value]));
}
