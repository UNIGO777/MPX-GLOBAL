import { useState } from 'react';

import { Field, inputClasses } from './Field.jsx';
import { StrengthMeter } from './StrengthMeter.jsx';
import { EyeIcon, EyeOffIcon } from './icons.jsx';

export function PasswordInput({
  label = 'Password',
  helper,
  error,
  optional,
  trailing,
  showStrength = false,
  value,
  onChange,
  ...rest
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Field label={label} helper={helper} error={error} optional={optional} trailing={trailing}>
        {(id, hasError) => (
          <div className="relative">
            <input
              id={id}
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={onChange}
              className={inputClasses(hasError, 'pr-12')}
              {...rest}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-500 hover:text-ink-700"
            >
              {visible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        )}
      </Field>
      {showStrength && <StrengthMeter value={value} />}
    </div>
  );
}
