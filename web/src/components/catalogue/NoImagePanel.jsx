import { ImageIcon } from '../ui/icons.jsx';

/**
 * The no-image state — ONE component for all four surfaces (category cards,
 * product cards, galleries, supplier logos) so they degrade identically.
 *
 * STANDARD fallback (owner, 2026-08-11): a quiet NEUTRAL panel — grey surface,
 * photo glyph — never a coloured box. The earlier primary-tinted monogram tiles
 * read as content ("colour boxes") instead of as an absence.
 *
 * `monogram` keeps initials for AVATAR-shaped gaps (a company logo), where
 * initials are the standard convention — but on the same neutral palette.
 */
/** First letters of the first two significant words — "Cotton fabric" → "CF". */
function initials(label = '') {
  const words = label.replace(/[^A-Za-z0-9 &]/g, ' ').split(/\s+/).filter((w) => w && w !== '&');
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function NoImagePanel({ label = '', monogram = false, ratio = 'aspect-video', className = '', icon: Icon = ImageIcon }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center border border-ink-200/60 bg-ink-100 ${ratio} ${className}`}
    >
      {monogram ? (
        <span className="text-xl font-bold tracking-tight text-ink-400">{initials(label)}</span>
      ) : (
        <Icon className="h-6 w-6 text-ink-400" />
      )}
    </div>
  );
}
