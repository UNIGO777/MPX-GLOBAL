// Temporary placeholder page. Replace with real route components under pages/<role>/.
// Uses only theme tokens (no magic colours) per web-design.md.
export function Placeholder({ title = 'MPX Global — Web' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle text-ink-700">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-primary-700">MPX Global</h1>
        <p className="mt-2 text-muted">{title}</p>
      </div>
    </div>
  );
}
