import { useMemo } from 'react';

import { COUNTRIES } from '../../lib/countries.js';
import { Combobox } from './Combobox.jsx';
import { Field } from './Field.jsx';

/**
 * Country picker (~200 entries) over the shared hybrid Combobox — type to
 * filter by name or ISO code (2026-08-11: one dropdown primitive everywhere;
 * this file used to carry its own button-plus-search popover). Stores the ISO
 * alpha-2 code, exactly what the backend validates.
 */
export function CountrySelect({
  label = 'Country',
  helper,
  error,
  optional,
  value,
  onChange,
  disabled,
}) {
  const options = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name, hint: c.code })),
    [],
  );

  return (
    <Field label={label} helper={helper} error={error} optional={optional}>
      {(id, hasError) => (
        <Combobox
          id={id}
          value={value ?? null}
          hasError={hasError}
          disabled={disabled}
          placeholder="Choose a country"
          notFound="No countries match."
          options={options}
          onChange={onChange}
        />
      )}
    </Field>
  );
}
