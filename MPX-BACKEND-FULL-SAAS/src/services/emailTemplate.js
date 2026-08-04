/**
 * Branded HTML email layout — the "Navy Canopy" direction the app and web
 * clients ship (owner, 2026-08-02): a navy band carrying the wordmark, a white
 * card below it, on the pale blue canvas.
 *
 * Tokens are copied from `web/tailwind.config.js`. They are duplicated here on
 * purpose: an email cannot import a Tailwind config, and hex values in an email
 * template are the one place a "magic colour" is unavoidable. If the brand
 * palette changes, this file changes with it.
 *
 * 🔴 EMAIL HTML IS NOT WEB HTML. Tables, not flex/grid. Inline styles, not
 * classes. No external stylesheet, no web font.
 *
 * BRAND MARK — HYBRID (owner, 2026-08-04): the wordmark is a Cloudinary <img>
 * (white on the navy canopy, coloured above the footer) WITH the text wordmark as
 * its `alt`. This deliberately reverses the earlier "no remote image" rule: the
 * `alt` still renders "MPX GLOBAL" when a client blocks images, so we keep the
 * always-visible fallback while showing the real logo when images load. If the
 * `EMAIL_LOGO_*` env URLs are unset, it falls back to the plain text wordmark.
 * (A remote image is also a soft open-tracking signal — accepted here.)
 *
 * 🔴 NO LINKS, ANYWHERE. These are security-adjacent messages: a code mail and a
 * "your password changed" mail must never train a user to click something. That
 * property is asserted by tests — adding a CTA button is a deliberate decision,
 * not a styling tweak.
 *
 * 🔴 EVERY interpolated value is ESCAPED. Company names and buyer names are
 * user-controlled and flow into these templates; unescaped, a crafted name could
 * inject markup — including a link — into a message that appears to come from
 * us. `**bold**` is the only markup callers get, applied AFTER escaping.
 */

import { env } from '../config/env.js';

// Insert a Cloudinary transformation into a stored /upload/ URL so .env keeps the
// clean public URL and the template controls trim + sizing. `e_trim` crops the
// surrounding canvas so the mark fills the box instead of floating tiny in it.
function cloudinaryTransform(url, transform) {
  return url && url.includes('/upload/') ? url.replace('/upload/', `/upload/${transform}/`) : url;
}

const COLORS = {
  navy: '#1A2E8F',
  primary: '#2A4DE0',
  tint: '#EAEEFF',
  ink: '#000517',
  body: '#344054',
  muted: '#5A6B85',
  surface: '#FFFFFF',
  border: '#C5C6CF',
  success: '#12B76A',
  warning: '#F79009',
};

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/** Escape first, then apply the only markup we support. Order matters. */
function toHtmlParagraph(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function toPlainParagraph(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

const STATUS_TONES = {
  success: { bg: '#E7F7EF', fg: '#05603A' },
  warning: { bg: '#FEF0DC', fg: '#93370D' },
  info: { bg: COLORS.tint, fg: COLORS.navy },
};

/**
 * @param {object} params
 * @param {string} params.heading      card heading
 * @param {string[]} params.paragraphs body copy; `**bold**` supported
 * @param {string} [params.code]       verification code, rendered as a block
 * @param {number} [params.expiryMinutes] shown under the code
 * @param {{tone:'success'|'warning'|'info', label:string}} [params.status]
 * @param {string} [params.footerNote] small print above the signature
 * @param {string} [params.preheader]  inbox preview line
 * @returns {{ text: string, html: string }}
 */
export function renderEmail({ heading, paragraphs = [], code, expiryMinutes, status, footerNote, preheader }) {
  // --- plain-text alternative ----------------------------------------------
  // Not an afterthought: it is what screen readers and text-only clients get,
  // and what lands if the HTML part is stripped.
  const textParts = [heading, ''];
  if (status) textParts.push(`[${status.label}]`, '');
  if (code) {
    textParts.push(`Your code: ${code}`);
    if (expiryMinutes) {
      textParts.push(`It expires in ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'}.`);
    }
    textParts.push('');
  }
  textParts.push(...paragraphs.map(toPlainParagraph));
  if (footerNote) textParts.push('', footerNote);
  textParts.push('', '— MPX Global', 'The trusted B2B network connecting Indian exporters with international buyers.');
  const text = textParts.join('\n');

  // --- HTML ----------------------------------------------------------------
  const statusChip = status
    ? `<tr><td style="padding:0 0 20px 0">
         <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${STATUS_TONES[status.tone].bg};color:${STATUS_TONES[status.tone].fg};font-size:13px;font-weight:600;letter-spacing:.2px">${escapeHtml(status.label)}</span>
       </td></tr>`
    : '';

  const codeBlock = code
    ? `<tr><td style="padding:8px 0 24px 0">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
           <tr><td align="center" style="background:${COLORS.tint};border-radius:12px;padding:24px 16px">
             <div style="font-family:${FONT};font-size:34px;font-weight:700;letter-spacing:10px;color:${COLORS.navy};line-height:1">${escapeHtml(code)}</div>
             ${
               expiryMinutes
                 ? `<div style="font-family:${FONT};font-size:13px;color:${COLORS.muted};padding-top:10px">Expires in ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'}</div>`
                 : ''
             }
           </td></tr>
         </table>
       </td></tr>`
    : '';

  const bodyParagraphs = paragraphs
    .map(
      (p) =>
        `<tr><td style="font-family:${FONT};font-size:15px;line-height:23px;color:${COLORS.body};padding:0 0 14px 0">${toHtmlParagraph(p)}</td></tr>`,
    )
    .join('');

  const footerNoteRow = footerNote
    ? `<tr><td style="font-family:${FONT};font-size:13px;line-height:20px;color:${COLORS.muted};padding:10px 0 0 0;border-top:1px solid ${COLORS.border}">${toHtmlParagraph(footerNote)}</td></tr>`
    : '';

  // Brand wordmark. HYBRID (owner, 2026-08-04): when the Cloudinary logo URL is
  // configured, use the image with the text wordmark as its `alt` — so the logo
  // shows when images load and the text still shows when a client blocks images.
  // Unset → the original text wordmark. WHITE variant sits on the navy canopy;
  // COLOURED sits above the footer on the light canvas.
  // Trim + cap height in ONE component (commas, not chained — `e_trim` alone on the
  // 36 MP source exceeds Cloudinary's 25 MP limit). c_limit = DOWNSCALE-ONLY (never
  // upscales → no blur); h is a high source res, DISPLAYED small so the client
  // downscales a sharp source → crisp on retina.
  const canopyMark = env.EMAIL_LOGO_WHITE_URL
    ? `<img src="${cloudinaryTransform(env.EMAIL_LOGO_WHITE_URL, 'e_trim,c_limit,h_240,q_auto:best')}" alt="MPX GLOBAL" height="40" style="display:block;border:0;outline:none;text-decoration:none;height:40px;width:auto;font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:2px;color:#FFFFFF">`
    : `<div style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:2px;color:#FFFFFF">MPX GLOBAL</div>`;
  const footerMark = env.EMAIL_LOGO_URL
    ? `<img src="${cloudinaryTransform(env.EMAIL_LOGO_URL, 'e_trim,c_limit,h_200,q_auto:best')}" alt="MPX Global" height="30" style="display:block;margin:0 auto 12px auto;border:0;outline:none;height:30px;width:auto">`
    : '';

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.tint};-webkit-font-smoothing:antialiased">
${
  preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>`
    : ''
}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.tint}">
  <tr><td align="center" style="padding:32px 16px">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px">

      <!-- navy canopy -->
      <tr><td style="background:${COLORS.navy};border-radius:16px 16px 0 0;padding:28px 32px">
        ${canopyMark}
        <div style="font-family:${FONT};font-size:11px;letter-spacing:2px;color:#C3CBFF;padding-top:10px">INSTITUTIONAL B2B NETWORK</div>
      </td></tr>

      <!-- white sheet -->
      <tr><td style="background:${COLORS.surface};border-radius:0 0 16px 16px;padding:32px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-family:${FONT};font-size:21px;font-weight:700;color:${COLORS.ink};padding:0 0 18px 0">${escapeHtml(heading)}</td></tr>
          ${statusChip}
          ${codeBlock}
          ${bodyParagraphs}
          ${footerNoteRow}
        </table>
      </td></tr>

      <tr><td align="center" style="padding:22px 16px 0 16px">
        ${footerMark}
        <div style="font-family:${FONT};font-size:12px;line-height:18px;color:${COLORS.muted}">
          MPX Global &middot; The trusted B2B network connecting Indian exporters with international buyers.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  return { text, html };
}
