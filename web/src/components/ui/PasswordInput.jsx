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
            {/* 🔴 `onMouseDown` preventDefault, not a styling tweak: a <button>
                takes focus when clicked, so the global focus-visible ring stayed
                painted around the eye while the user carried on typing — and
                focus had left the password field, so the caret was gone too.
                Suppressing the pointer-focus keeps the caret in the input and
                the ring off. Keyboard users still Tab to it and DO get the ring,
                which is the case the ring exists for. */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
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
