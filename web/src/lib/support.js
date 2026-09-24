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

/** Mirrors the server's TICKET_AUTO_CLOSE_DAYS: a ticket waiting on the company this long closes itself. */
export const TICKET_AUTO_CLOSE_DAYS = 14;

/** The date a waiting ticket will auto-close, or null. */
export function autoCloseDate(awaitingCompanySince) {
  if (!awaitingCompanySince) return null;
  return new Date(new Date(awaitingCompanySince).getTime() + TICKET_AUTO_CLOSE_DAYS * 86_400_000);
}
