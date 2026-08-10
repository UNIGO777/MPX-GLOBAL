import { CURRENCIES } from '../../lib/currencies.js';
import { Combobox } from '../ui/Combobox.jsx';
import { Field, inputClasses } from '../ui/Field.jsx';

/**
 * One control, three modes (design brief §2).
 *
 * 🔴 "On request" REMOVES the amount and currency fields ENTIRELY — not
 * disabled, gone — and replaces them with the single line the design specifies.
 * The server enforces the same shape: `on_request` carries no numbers, and a
 * currency is required for every other mode.
 *
 * 🔴 Range validates `min < max` INLINE. The server rejects `min >= max` with a
 * 400, so catching it here is UX, not enforcement — but a seller who only learns
 * on submit has already lost the rest of the form's context.
 *
 * No conversion, ever (§A27.1): the currency is stored exactly as chosen, and
 * buyers see that ISO code. Introducing an FX table is a new decision, not an
 * implementation detail.
 */
const MODES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'range', label: 'Range' },
  { value: 'on_request', label: 'On request' },
];

export function PriceInput({ value, onChange, errors = {} }) {
  const { mode = 'fixed', min, max, currency = 'INR' } = value ?? {};
  const set = (patch) => onChange({ ...value, mode, currency, ...patch });

  const rangeInvalid =
    mode === 'range' && min != null && max != null && Number(min) >= Number(max);

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-900">Price</span>
        <div
          role="radiogroup"
          aria-label="Pricing mode"
          className="inline-flex overflow-hidden rounded-lg border border-surface-border"
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() =>
                // Switching INTO on_request drops the numbers rather than
                // carrying them invisibly — the server would reject them.
                set(m.value === 'on_request'
                  ? { mode: m.value, min: undefined, max: undefined }
                  : { mode: m.value, ...(m.value === 'fixed' ? { max: undefined } : {}) })
              }
              className={`min-h-[44px] px-4 text-sm font-medium transition-colors ${
                mode === m.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-ink-600 hover:bg-surface-subtle'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'on_request' ? (
        <div className="rounded-lg border border-surface-border bg-surface-subtle p-4">
          <p className="text-sm text-ink-600">Buyers will see &lsquo;Price on request&rsquo;.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={mode === 'range' ? 'Minimum' : 'Amount'} error={errors.min}>
            {(id, hasError) => (
              <input
                id={id}
                type="number"
                min="0"
                inputMode="decimal"
                className={inputClasses(hasError)}
                value={min ?? ''}
                onChange={(e) => set({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            )}
          </Field>

          {mode === 'range' && (
            <Field
              label="Maximum"
              error={errors.max ?? (rangeInvalid ? 'Minimum must be less than maximum.' : undefined)}
            >
              {(id, hasError) => (
                <input
                  id={id}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  className={inputClasses(hasError)}
                  value={max ?? ''}
                  onChange={(e) => set({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              )}
            </Field>
          )}

          <Field label="Currency" error={errors.currency}>
            {(id, hasError) => (
              <div className="sm:w-36">
                <Combobox
                  id={id}
                  hasError={hasError}
                  value={currency}
                  placeholder="Currency"
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  onChange={(v) => set({ currency: v })}
                />
              </div>
            )}
          </Field>
        </div>
      )}
    </div>
  );
}
