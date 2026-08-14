/**
 * The buyer-facing specifications table — a category's dynamic attributes as
 * label/value rows (screen 3).
 *
 * Values arrive as `{ key, value }` snapshots on the product; the LABELS and
 * units come from the category's `CategoryAttribute` definitions, which is why
 * `defs` is separate. A product keeps a value whose definition an admin has
 * since deleted — that row simply renders under its raw key rather than
 * disappearing, because the seller did enter it.
 *
 * 🔴 Booleans read "Yes"/"No", never `true`/`false`, and numbers carry the
 * definition's unit ("120 gsm"). Renders nothing at all when there are no
 * values — never an empty table with a heading.
 *
 * 2026-08-12 (owner-supplied reference mockup, product detail redesign):
 * two columns on `sm+` instead of one long divided list — a full-width panel
 * with only 3-4 spec rows read as very sparse; two columns fill the space the
 * panel actually has and match a real specs sheet's density. Single column
 * below `sm` (mobile) where there isn't room for two.
 */
function present(value, def) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && def?.unit) return `${value.toLocaleString('en-IN')} ${def.unit}`;
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  return value;
}

export function SpecTable({ attributes = [], defs = [], columns = 2 }) {
  const rows = attributes.filter((a) => a.value !== null && a.value !== undefined && a.value !== '');
  if (rows.length === 0) return null;

  const defByKey = new Map(defs.map((d) => [d.key, d]));

  return (
    // `columns={1}` for half-width containers (ProductDetail's side-by-side
    // panels, 2026-08-14) — two columns crush label+value there.
    <dl
      className={`grid grid-cols-1 gap-x-8 border-t border-surface-border ${
        columns === 2 ? 'sm:grid-cols-2' : ''
      }`}
    >
      {rows.map((attr) => {
        const def = defByKey.get(attr.key);
        return (
          <div
            key={attr.key}
            className="flex items-baseline justify-between gap-6 border-b border-surface-border py-3"
          >
            <dt className="text-sm text-muted">{def?.name ?? attr.key}</dt>
            <dd className="text-right text-sm font-medium text-ink-900">{present(attr.value, def)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
