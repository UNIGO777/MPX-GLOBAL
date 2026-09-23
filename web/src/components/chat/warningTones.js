import { AlertIcon, InfoIcon } from '../ui/icons.jsx';

/**
 * How each platform-warning TONE looks (owner, 2026-09-24: "change their colour
 * to their nature … show respective colour in selection window also"). ONE map,
 * used by the thread notice AND the admin's selection window, so what staff pick
 * is exactly what the two companies see.
 *
 * The tone comes from the server (`utils/chatWarnings.js`); the label changes
 * with the colour — never colour alone (M4-19).
 *
 * Reminder is slate, not navy: the theme reserves navy for charts and the logo
 * (tailwind.config.js), and a slate reads as calm guidance without a new hue.
 */
export const WARNING_TONES = {
  reminder: {
    label: 'Platform reminder',
    Icon: InfoIcon,
    // Thread notice
    bar: 'bg-ink-500',
    wrap: 'from-ink-100 to-ink-50/40 ring-ink-200',
    head: 'text-ink-700',
    dot: 'text-ink-300',
    // Selection window
    card: 'border-ink-500 bg-ink-50 ring-ink-500',
    radio: 'border-ink-600',
    radioDot: 'bg-ink-600',
    chip: 'bg-ink-100 text-ink-700',
    swatch: 'bg-ink-500',
  },
  caution: {
    label: 'Platform warning',
    Icon: AlertIcon,
    bar: 'bg-warning-500',
    wrap: 'from-warning-50 to-warning-50/20 ring-warning-200/60',
    head: 'text-warning-700',
    dot: 'text-warning-300',
    card: 'border-warning-500 bg-warning-50 ring-warning-500',
    radio: 'border-warning-600',
    radioDot: 'bg-warning-600',
    chip: 'bg-warning-50 text-warning-700',
    swatch: 'bg-warning-500',
  },
  serious: {
    label: 'Platform warning',
    Icon: AlertIcon,
    bar: 'bg-primary-600',
    wrap: 'from-primary-100 to-primary-50/30 ring-primary-200/70',
    head: 'text-primary-700',
    dot: 'text-primary-300',
    card: 'border-primary-600 bg-primary-50 ring-primary-600',
    radio: 'border-primary-600',
    radioDot: 'bg-primary-600',
    chip: 'bg-primary-50 text-primary-700',
    swatch: 'bg-primary-600',
  },
  final: {
    label: 'Final warning',
    Icon: AlertIcon,
    bar: 'bg-danger-700',
    wrap: 'from-danger-100 to-danger-50/40 ring-danger-300/70',
    head: 'text-danger-800',
    dot: 'text-danger-300',
    card: 'border-danger-700 bg-danger-50 ring-danger-700',
    radio: 'border-danger-700',
    radioDot: 'bg-danger-700',
    chip: 'bg-danger-100 text-danger-800',
    swatch: 'bg-danger-700',
  },
};

/** Short word for the tone chip in the selection window. */
export const TONE_WORD = { reminder: 'Reminder', caution: 'Caution', serious: 'Serious', final: 'Final' };
