import { TICKET_STATUS } from '../../lib/support.js';

const TONES = {
  warning: 'bg-warning-50 text-warning-800',
  info: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
};

/** Ticket status as a chip — word + tint, never colour alone. */
export function TicketStatusChip({ status, size = 'md' }) {
  const meta = TICKET_STATUS[status] ?? { label: status, tone: 'warning' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${
        size === 'sm' ? 'px-2 py-0.5 text-[11.5px]' : 'px-2.5 py-0.5 text-[12px]'
      } ${TONES[meta.tone]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}
