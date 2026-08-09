import { BoxIcon } from '../ui/icons.jsx';

/**
 * The no-image state, designed as the PRIMARY look rather than an edge case.
 *
 * 🔴 This is the launch reality, not a rare fallback, and the seed proves it:
 * **0 of 40 top categories have an image** (§A20 — admins upload them through the
 * panel over time), and publishing a product does not require a photo. So a full
 * grid of these is the normal appearance of the catalogue on day one. A grey
 * broken-image glyph would make the whole page read as failed.
 *
 * One component for all four surfaces — category cards, product cards, galleries
 * and supplier logos — so they degrade identically instead of three teams
 * inventing three placeholders.
 *
 * `monogram` renders the first letter (categories, company logos); otherwise a
 * quiet line icon (products, where a letter would read as a brand).
 */
/** First letters of the first two significant words — "Cotton fabric" → "CF". */
function initials(label = '') {
  const words = label.replace(/[^A-Za-z0-9 &]/g, ' ').split(/\s+/).filter((w) => w && w !== '&');
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function NoImagePanel({ label = '', monogram = false, ratio = 'aspect-video', className = '', icon: Icon = BoxIcon }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-primary-100 ${ratio} ${className}`}
    >
      {monogram ? (
        // TWO letters, per the design exports. One collides: "Industrial
        // Machinery" and "IT, Software & AI Services" both reduce to "I", and
        // the category grid shows them side by side.
        <span className="text-3xl font-bold tracking-tight text-primary-300">
          {initials(label)}
        </span>
      ) : (
        <Icon className="h-9 w-9 text-primary-300" />
      )}
    </div>
  );
}
