/** Designed empty state — never a blank screen where content belongs. */
export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      {/* Design draws the glyph bare in ink — no medallion behind it. */}
      {Icon && (
        <div className="mb-4 text-ink-600">
          <Icon className="h-9 w-9" />
        </div>
      )}
      <h3 className="text-lg font-bold text-ink-900">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
