import { DIAL_OPTIONS } from '../../lib/countries.js';
import { Field, inputClasses } from './Field.jsx';
import { ChevronDownIcon } from './icons.jsx';

/**
 * One labelled pair: dial-code select + number field (phone pad semantics).
 * Value shape mirrors the backend exactly: { countryCode: '+91', number }.
 */
export function MobileInput({ label = 'Mobile', helper, error, value, onChange, disabled }) {
  const { countryCode, number } = value;
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <Field label={label} helper={helper} error={error}>
      {(id, hasError) => (
        <div className="flex gap-2">
          <div className="relative w-32 shrink-0">
            <select
              aria-label="Country code"
              value={countryCode}
              disabled={disabled}
              onChange={(e) => set({ countryCode: e.target.value })}
              className={inputClasses(hasError, 'appearance-none pr-8')}
            >
              {DIAL_OPTIONS.map((o) => (
                <option key={`${o.value}-${o.label}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          </div>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Number"
            value={number}
            disabled={disabled}
            onChange={(e) => set({ number: e.target.value.replace(/[^\d\s-]/g, '') })}
            className={inputClasses(hasError)}
          />
        </div>
      )}
    </Field>
  );
}
