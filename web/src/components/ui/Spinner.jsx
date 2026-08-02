export function Spinner({ className = 'h-5 w-5', light = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`animate-spin motion-reduce:animate-none ${className}`}
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="3.5"
        className={light ? 'opacity-30' : 'opacity-20'}
      />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
