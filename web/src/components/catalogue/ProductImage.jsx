import { NoImagePanel } from './NoImagePanel.jsx';

/**
 * A product photo shown WHOLE, on a blurred copy of itself.
 *
 * Owner, 2026-09-24: "show full image … and add same image with blur effect if
 * image specs are changing".
 *
 * 🔴 Why this exists rather than `object-cover` everywhere. Sellers upload
 * whatever their camera or supplier gave them — portrait saree shots, square
 * pack shots, wide fabric rolls. `object-cover` fills the frame by CROPPING,
 * which on a 4:3 card silently cuts the top and bottom off a portrait photo:
 * the thing being sold is what gets removed. `object-contain` keeps the whole
 * picture, and the blurred `object-cover` copy behind it fills the leftover band
 * with the photo's OWN colours instead of a grey slab — so a mixed grid still
 * reads as one tidy row of equal tiles.
 *
 * 🔴 The backdrop is blurred BY CLOUDINARY, not by CSS. A category grid renders
 * twenty of these, and `blur-xl` on twenty full-size photos is twenty GPU blurs
 * of a 2000px image every paint. `w_48,e_blur:800` is a ~1 KB thumbnail that
 * arrives already blurred, so the browser just stretches it. Only a Cloudinary
 * delivery URL can carry a transform; anything else falls back to the full image
 * with a CSS blur, which still looks right and only costs more.
 *
 * `scale-110` hides the backdrop's soft edge, which otherwise shows as a pale
 * halo inside the frame border. The backdrop is `aria-hidden` with `alt=""` —
 * it is the same picture, and announcing it twice is noise.
 */
const UPLOAD = '/image/upload/';

function blurredBackdrop(url) {
  const at = url.indexOf(UPLOAD);
  if (at === -1) return null;
  const cut = at + UPLOAD.length;
  return `${url.slice(0, cut)}w_48,e_blur:800,q_30,f_auto/${url.slice(cut)}`;
}

export function ProductImage({
  src,
  alt = '',
  ratio = 'aspect-[4/3]',
  className = '',
  imgClassName = '',
  fallbackLabel = '',
  loading = 'lazy',
}) {
  if (!src) {
    return <NoImagePanel ratio={ratio} label={fallbackLabel} className={className} />;
  }

  const backdrop = blurredBackdrop(src);

  return (
    <div className={`relative overflow-hidden ${ratio} ${className}`}>
      <img
        src={backdrop ?? src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        // A server-blurred 48px thumbnail needs no CSS blur; a full-size
        // fallback does.
        className={`absolute inset-0 h-full w-full scale-110 object-cover ${backdrop ? '' : 'blur-xl'}`}
      />
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={`relative h-full w-full object-contain ${imgClassName}`}
      />
    </div>
  );
}
