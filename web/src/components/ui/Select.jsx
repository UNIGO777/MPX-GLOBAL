import { Field, inputClasses } from './Field.jsx';
import { ChevronDownIcon } from './icons.jsx';

/** Native select in the shared field chrome. `options`: [{value, label}]. */
export function Select({ label, helper, error, optional, options = [], className = '', ...rest }) {
  return (
    <Field label={label} helper={helper} error={error} optional={optional}>
      {(id, hasError) => (
        <div className="relative">
          <select id={id} className={inputClasses(hasError, `appearance-none pr-10 ${className}`)} {...rest}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        </div>
      )}
    </Field>
  );
}
