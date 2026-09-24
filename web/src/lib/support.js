/** Step 1b · shared support-ticket vocabulary (mirrors the server enums). */
export const TICKET_CATEGORIES = [
  { value: 'account', label: 'Account & sign-in' },
  { value: 'verification', label: 'Verification' },
  { value: 'products', label: 'Products & listings' },
  { value: 'enquiries', label: 'Enquiries & chat' },
  { value: 'technical', label: 'Something is broken' },
  { value: 'other', label: 'Something else' },
];
export const CATEGORY_LABEL = Object.fromEntries(TICKET_CATEGORIES.map((c) => [c.value, c.label]));

export const TICKET_STATUS = {
  open: { label: 'Open', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
};

/**
 * The auto-close day count is a Settings value since 2026-09-25, so no screen
 * keeps its own copy: staff rows carry the server-computed `autoCloseAt`, and a
 * closed ticket carries `autoClosedAfterDays` (the count in force when it
 * closed). This is only the fallback for tickets auto-closed before that field.
 */
export const LEGACY_AUTO_CLOSE_DAYS = 14;

/** "no reply for N days" for an auto-closed ticket. */
export const autoClosedDays = (t) => t?.autoClosedAfterDays ?? LEGACY_AUTO_CLOSE_DAYS;
