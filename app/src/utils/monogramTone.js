/**
 * A muted colour PER COMPANY for a monogram avatar — the SAME hash and the same
 * eight tints as the web (`web/src/components/chat/CompanyAvatar.jsx`), so a
 * company has one colour on every screen and every device (owner, 2026-09-24:
 * "the chats cannot be differentiated"). Keep the two lists in step.
 * Values are Tailwind's 50/100 and 700/800 steps of each hue.
 */
const TONES = [
  { bg: '#F0F9FF', fg: '#075985' }, // sky
  { bg: '#F0FDFA', fg: '#115E59' }, // teal
  { bg: '#F5F3FF', fg: '#5B21B6' }, // violet
  { bg: '#FFFBEB', fg: '#92400E' }, // amber
  { bg: '#ECFDF5', fg: '#065F46' }, // emerald
  { bg: '#EEF2FF', fg: '#3730A3' }, // indigo
  { bg: '#FFF1F2', fg: '#9F1239' }, // rose
  { bg: '#F1F5F9', fg: '#334155' }, // slate
];

export function monogramTone(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
