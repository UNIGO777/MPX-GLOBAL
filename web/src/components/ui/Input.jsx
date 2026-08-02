import { Field, inputClasses } from './Field.jsx';

export function Input({ label, helper, error, optional, trailing, className = '', ...rest }) {
  return (
    <Field label={label} helper={helper} error={error} optional={optional} trailing={trailing}>
      {(id, hasError) => (
        <input id={id} className={inputClasses(hasError, className)} {...rest} />
      )}
    </Field>
  );
}
