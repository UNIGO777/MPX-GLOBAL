import { useMemo, useState } from 'react';

import { DIAL_OPTIONS } from '../../lib/countries.js';
import { Combobox } from './Combobox.jsx';
import { Field, inputClasses } from './Field.jsx';

/**
 * One labelled pair: dial-code picker + number field (phone pad semantics).
 * Value shape mirrors the backend exactly: { countryCode: '+91', number }.
 *
 * The dial code uses the shared searchable Combobox, not a native <select>:
 * the OS popup for ~200 codes was a giant unstyled list (orange highlight on
 * macOS) that could only be scrolled, never typed into (owner, 2026-09-23).
 * Now "India", "IN" or "44" all find their row, with the country name shown.
 *
 * Several countries SHARE a dial code (+1: US, Canada, the Caribbean…), so the
 * picker tracks the exact row picked; only the dial code reaches `value`.
 */
const OPTIONS = DIAL_OPTIONS.map((o) => ({ value: o.label, label: o.label, hint: o.name, dial: o.value }));
const DIAL_OF = new Map(OPTIONS.map((o) => [o.value, o.dial]));
// When only the dial code is known, the most likely country for it.
const PREFERRED = { '+1': '+1 (US)', '+7': '+7 (RU)', '+44': '+44 (GB)' };

function rowFor(dial) {
  return PREFERRED[dial] ?? OPTIONS.find((o) => o.dial === dial)?.value ?? null;
}

export function MobileInput({ label = 'Mobile', helper, error, value, onChange, disabled }) {
  const { countryCode, number } = value;
  const set = (patch) => onChange({ ...value, ...patch });

  // The picked row wins while it still matches the dial code; a code set from
  // outside (form reset, prefill) falls back to its most likely country.
  const [picked, setPicked] = useState(null);
  const row = useMemo(
    () => (picked && DIAL_OF.get(picked) === countryCode ? picked : rowFor(countryCode)),
    [picked, countryCode],
  );

  return (
    <Field label={label} helper={helper} error={error}>
      {(id, hasError) => (
        <div className="flex gap-2">
          <div className="w-36 shrink-0">
            <Combobox
              ariaLabel="Country code"
              value={row}
              options={OPTIONS}
              placeholder="Code"
              disabled={disabled}
              hasError={hasError}
              notFound="No country found."
              onChange={(next) => {
                setPicked(next);
                set({ countryCode: DIAL_OF.get(next) });
              }}
            />
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
