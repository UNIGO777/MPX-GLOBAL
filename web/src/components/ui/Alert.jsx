import { AlertIcon, CheckCircleIcon, InfoIcon } from './icons.jsx';

/** Inline alert — info / warning / danger / success, with optional title. */
const STYLES = {
  info: { box: 'border-primary-200 bg-primary-50 text-primary-800', Icon: InfoIcon },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', Icon: AlertIcon },
  // Mockups' error slot: #FEECEA fill, #D92D20 border AND text (sign-in html).
  danger: { box: 'border-danger bg-danger-50 text-danger', Icon: AlertIcon },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircleIcon },
};

export function Alert({ tone = 'info', title, children, className = '' }) {
  const { box, Icon } = STYLES[tone];
  return (
    <div role="alert" className={`flex gap-3 rounded-lg border p-3.5 text-sm ${box} ${className}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}
