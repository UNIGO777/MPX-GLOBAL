import { CheckIcon } from '../ui/icons.jsx';

/** A numbered step heading; the number turns into a tick once the step is done. */
export function StepTitle({ n, done, optional = false, as: Tag = 'h3', children }) {
  return (
    <Tag className="mb-3 flex items-center gap-2.5 text-sm font-bold text-ink-900">
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
          done ? 'bg-success-600 text-white' : 'bg-primary-50 text-primary-700 ring-1 ring-primary-100'
        }`}
      >
        {done ? <CheckIcon className="h-3.5 w-3.5" /> : n}
      </span>
      {children}
      {optional && <span className="text-xs font-normal text-muted">Optional</span>}
    </Tag>
  );
}
