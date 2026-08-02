/**
 * Password strength hint (UX only — the server enforces the real policy).
 * Vocabulary matches the mockups: Weak / Fair / Strong.
 */
export function passwordStrength(value = '') {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 1) return { label: 'Weak', tone: 'danger', portion: 1 };
  if (score <= 2) return { label: 'Fair', tone: 'warning', portion: 2 };
  return { label: 'Strong', tone: 'success', portion: 3 };
}

const BAR = { danger: 'bg-danger', warning: 'bg-warning', success: 'bg-success' };
const TEXT = { danger: 'text-danger', warning: 'text-warning', success: 'text-success' };

export function StrengthMeter({ value }) {
  if (!value) return null;
  const { label, tone, portion } = passwordStrength(value);
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full ${step <= portion ? BAR[tone] : 'bg-ink-200'}`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${TEXT[tone]}`}>{label}</span>
    </div>
  );
}
