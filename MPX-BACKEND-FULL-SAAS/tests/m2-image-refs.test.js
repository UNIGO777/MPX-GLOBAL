import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `image.storage.service.js` — the PUBLIC image path (product photos, category
 * cards, landing banners), as opposed to the private KYC path already covered by
 * `kycStorage.test.js`.
 *
 * Two controls live here and neither had a direct test:
 *
 *  1. `verifyImageFile` — magic-byte allowlist (B6). Images ONLY: unlike the KYC
 *     path, a PDF must be refused, because these assets are served publicly.
 *  2. `isOwnCloudinaryUrl` — the check that a `{url, publicId}` pair is one THIS
 *     server issued. Product image refs travel through the client between the
 *     upload call and the create/edit call, so a forged pair would otherwise let
 *     a seller point a listing at any image on the internet, or hotlink another
 *     seller's asset. `assertImageRefsOwned` checks the publicId prefix; this
 *     function is the half that stops the URL itself being fabricated.
 */

const spy = vi.hoisted(() => ({ uploadOptions: null, destroyed: [] }));

vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  cloudinary: {
    uploader: {
      upload_stream: (options, cb) => {
        spy.uploadOptions = options;
        return {
          end: () =>
            cb(null, {
              public_id: options.public_id,
              secure_url: `https://res.cloudinary.com/testcloud/image/upload/v1/${options.public_id}.png`,
            }),
        };
      },
      destroy: async (publicId, options) => {
        spy.destroyed.push({ publicId, options });
        return { result: 'ok' };
      },
    },
  },
}));

const { verifyImageFile, uploadPublicImage, deletePublicImage, isOwnCloudinaryUrl } = await import(
  '../src/services/image.storage.service.js'
);
const { env } = await import('../src/config/env.js');

// Real magic bytes — file-type inspects the buffer, so these must be genuine.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(14),
]);
const PDF = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n', 'latin1');

const CLOUD = env.CLOUDINARY_CLOUD_NAME || 'testcloud';
const ok = (publicId) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/${publicId}.png`;

beforeEach(() => {
  spy.uploadOptions = null;
  spy.destroyed = [];
});

describe('verifyImageFile — images only, by content (B6)', () => {
  it('accepts the three allowed image types', async () => {
    expect((await verifyImageFile(PNG)).format).toBe('png');
    expect((await verifyImageFile(JPEG)).format).toBe('jpg');
    expect((await verifyImageFile(WEBP)).format).toBe('webp');
  });

  it('🔴 refuses a PDF — allowed for KYC documents, never for a public image', async () => {
    await expect(verifyImageFile(PDF)).rejects.toMatchObject({
      statusCode: 400,
      clientMessage: expect.stringMatching(/only jpg, png or webp/i),
    });
  });

  it('refuses a file whose real bytes are not an image, whatever it claims to be', async () => {
    const script = Buffer.from('<?php system($_GET["c"]); ?>', 'utf8');
    await expect(verifyImageFile(script)).rejects.toMatchObject({ statusCode: 400 });

    // A PNG header alone is not enough for file-type to accept the buffer as one.
    const truncated = Buffer.from([0x89, 0x50]);
    await expect(verifyImageFile(truncated)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses an empty file and one past the 5 MB cap (§A25.3)', async () => {
    await expect(verifyImageFile(Buffer.alloc(0))).rejects.toMatchObject({
      clientMessage: expect.stringMatching(/no file/i),
    });
    await expect(verifyImageFile(null)).rejects.toMatchObject({ statusCode: 400 });

    const huge = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
    await expect(verifyImageFile(huge)).rejects.toMatchObject({
      clientMessage: expect.stringMatching(/5 mb/i),
    });
  });
});

describe('uploadPublicImage — public asset, unguessable id', () => {
  it('uploads under the caller\'s folder with a random id, and NEVER as a private asset', async () => {
    const ref = await uploadPublicImage({ buffer: PNG, folder: 'mpx/products/abc123' });

    expect(spy.uploadOptions.public_id.startsWith('mpx/products/abc123/')).toBe(true);
    // Random suffix: not derivable from the folder alone.
    expect(spy.uploadOptions.public_id.replace('mpx/products/abc123/', '')).toMatch(/^[0-9a-f]{16}$/);
    // These are meant to be world-readable — the KYC path's `type: 'private'`
    // must NOT leak across into it.
    expect(spy.uploadOptions.type).toBeUndefined();
    expect(spy.uploadOptions.resource_type).toBe('image');
    // Never clobber an existing asset.
    expect(spy.uploadOptions.overwrite).toBe(false);

    expect(ref.url).toContain('res.cloudinary.com');
    expect(ref.publicId).toBe(spy.uploadOptions.public_id);
  });

  it('verifies the bytes BEFORE uploading — a rejected file costs no storage call', async () => {
    await expect(uploadPublicImage({ buffer: PDF, folder: 'mpx/products/abc123' })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(spy.uploadOptions).toBeNull();
  });

  it('two uploads of the same bytes get different ids', async () => {
    const a = await uploadPublicImage({ buffer: PNG, folder: 'mpx/products/abc123' });
    const b = await uploadPublicImage({ buffer: PNG, folder: 'mpx/products/abc123' });
    expect(a.publicId).not.toBe(b.publicId);
  });

  it('deletePublicImage targets the image resource type', async () => {
    await deletePublicImage('mpx/products/abc123/deadbeef');
    expect(spy.destroyed).toEqual([
      { publicId: 'mpx/products/abc123/deadbeef', options: { resource_type: 'image' } },
    ]);
  });
});

describe('🔴 isOwnCloudinaryUrl — a forged {url, publicId} pair cannot be planted', () => {
  const publicId = 'mpx/products/org1/aabbccdd';

  it('accepts a pair this server actually issued', () => {
    expect(isOwnCloudinaryUrl(ok(publicId), publicId)).toBe(true);
  });

  it('accepts our URL carrying a transformation segment', () => {
    const transformed = `https://res.cloudinary.com/${CLOUD}/image/upload/w_400,h_300/v1/${publicId}.png`;
    expect(isOwnCloudinaryUrl(transformed, publicId)).toBe(true);
  });

  it('refuses a URL on somebody else\'s host', () => {
    expect(isOwnCloudinaryUrl(`https://evil.example.com/${publicId}.png`, publicId)).toBe(false);
    // A lookalike host must not pass either.
    expect(
      isOwnCloudinaryUrl(`https://res.cloudinary.com.evil.example.com/${publicId}.png`, publicId),
    ).toBe(false);
  });

  it('refuses plain http — an image link we hand out is https or nothing', () => {
    expect(isOwnCloudinaryUrl(ok(publicId).replace('https:', 'http:'), publicId)).toBe(false);
  });

  it('🔴 refuses a real Cloudinary URL that does NOT contain the claimed publicId', () => {
    // The attack this closes: pass a publicId inside your own prefix, but point
    // `url` at an asset you do not own.
    const someoneElses = ok('mpx/products/org2/99887766');
    expect(isOwnCloudinaryUrl(someoneElses, publicId)).toBe(false);
  });

  it('refuses a URL from a different Cloudinary cloud', () => {
    const otherCloud = `https://res.cloudinary.com/not-our-cloud/image/upload/v1/${publicId}.png`;
    // Only meaningful when a cloud name is configured; the function falls back to
    // the publicId containment check otherwise.
    if (env.CLOUDINARY_CLOUD_NAME) {
      expect(isOwnCloudinaryUrl(otherCloud, publicId)).toBe(false);
    } else {
      expect(isOwnCloudinaryUrl(otherCloud, publicId)).toBe(true);
    }
  });

  it('refuses junk, wrong types and empty ids rather than throwing', () => {
    expect(isOwnCloudinaryUrl('not-a-url', publicId)).toBe(false);
    expect(isOwnCloudinaryUrl('', publicId)).toBe(false);
    expect(isOwnCloudinaryUrl(ok(publicId), '')).toBe(false);
    expect(isOwnCloudinaryUrl(null, publicId)).toBe(false);
    expect(isOwnCloudinaryUrl(ok(publicId), null)).toBe(false);
    expect(isOwnCloudinaryUrl({ $ne: null }, publicId)).toBe(false);
    expect(isOwnCloudinaryUrl(ok(publicId), { $ne: null })).toBe(false);
    expect(isOwnCloudinaryUrl(undefined, undefined)).toBe(false);
  });

  it('refuses a javascript: or data: URL outright', () => {
    expect(isOwnCloudinaryUrl(`javascript:alert(1)//${publicId}`, publicId)).toBe(false);
    expect(isOwnCloudinaryUrl(`data:image/png;base64,AAAA${publicId}`, publicId)).toBe(false);
  });
});
