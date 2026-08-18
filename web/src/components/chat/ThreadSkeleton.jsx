import { Skeleton } from '../ui/Skeleton.jsx';

/**
 * Loading state for a thread. Alternating sides and varied widths so it reads as
 * a conversation arriving rather than a stack of grey bars — skeletons over
 * spinners for content (web-design.md).
 */
const SHAPE = [
  { mine: false, width: 'w-3/5' },
  { mine: true, width: 'w-2/5' },
  { mine: false, width: 'w-1/2' },
  { mine: true, width: 'w-3/5' },
  { mine: false, width: 'w-2/5' },
];

export function ThreadSkeleton() {
  return (
    <div className="space-y-4 p-4" role="status" aria-label="Loading conversation">
      {SHAPE.map((row, i) => (
        <div key={i} className={`flex ${row.mine ? 'justify-end' : 'justify-start'}`}>
          <Skeleton className={`h-12 rounded-2xl ${row.width}`} />
        </div>
      ))}
    </div>
  );
}
