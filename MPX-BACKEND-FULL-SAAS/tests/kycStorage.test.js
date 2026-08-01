import { describe, it, expect, vi, beforeEach } from 'vitest';

// A recording stand-in for Cloudinary. The close-checklist guarantee is about the
// OPTIONS we send, so capturing them is the only way to assert it without a
// network call.
const spy = vi.hoisted(() => ({ uploadOptions: null, signOptions: null, signKey: null }));

vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  cloudinary: {
    uploader: {
      upload_stream: (options, cb) => {
        spy.uploadOptions = options;
        return { end: () => cb(null, { public_id: options.public_id, format: 'png' }) };
      },
    },
    utils: {
      private_download_url: (key, _format, options) => {
        spy.signKey = key;
        spy.signOptions = options;
        return 'https://res.cloudinary.com/signed';
      },
    },
  },
}));

const { verifyKycFile, uploadKycDocument, signedKycUrl } = await import(
  '../src/services/kyc.storage.service.js'
);

// Magic-byte validation is offline (file-type on a Buffer) — no Cloudinary / DB.
// A real, minimal 1x1 PNG (decoded from base64) so file-type sees a valid IHDR.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n', 'latin1');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe('verifyKycFile (magic-byte allowlist, B6)', () => {
  it('accepts a real PNG and reports its format', async () => {
    const r = await verifyKycFile(PNG);
    expect(r.mime).toBe('image/png');
    expect(r.format).toBe('png');
  });

  it('accepts a real PDF and JPEG', async () => {
    expect((await verifyKycFile(PDF)).format).toBe('pdf');
    expect((await verifyKycFile(JPEG)).format).toBe('jpg');
  });

  it('rejects a spoofed file (text bytes, not a real allowed type)', async () => {
    const fake = Buffer.from('this is definitely not a pdf, even if named x.pdf');
    await expect(verifyKycFile(fake)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an empty file', async () => {
    await expect(verifyKycFile(Buffer.alloc(0))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an oversized file', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024 + 1)]);
    await expect(verifyKycFile(big)).rejects.toMatchObject({ statusCode: 400 });
  });
});

/**
 * FINALIZE F-C — the close-checklist item "KYC documents must be private".
 *
 * The code already satisfies it. These tests exist so it STAYS satisfied: a
 * dropped `type: 'private'` would silently give every stored passport and
 * incorporation certificate a publicly-reachable URL, and nothing else in the
 * suite would notice.
 */
describe('KYC documents are stored PRIVATE (close checklist)', () => {
  beforeEach(() => {
    spy.uploadOptions = null;
    spy.signOptions = null;
    spy.signKey = null;
  });

  it('uploads as a private asset — never a public one', async () => {
    await uploadKycDocument({ buffer: PNG, orgId: 'org1', docType: 'pan' });
    expect(spy.uploadOptions.type).toBe('private');
  });

  it('never overwrites an existing asset', async () => {
    await uploadKycDocument({ buffer: PNG, orgId: 'org1', docType: 'pan' });
    expect(spy.uploadOptions.overwrite).toBe(false);
  });

  it('randomises the public_id so a document is not guessable from org + type', async () => {
    await uploadKycDocument({ buffer: PNG, orgId: 'org1', docType: 'pan' });
    const first = spy.uploadOptions.public_id;
    await uploadKycDocument({ buffer: PNG, orgId: 'org1', docType: 'pan' });
    const second = spy.uploadOptions.public_id;

    expect(first).not.toBe(second);
    // Same org and docType, so anything predictable would have collided.
    expect(first).toMatch(/^mpx\/kyc\/org1\/pan_[0-9a-f]{24}$/);
  });

  it('returns a storage key, never a URL', async () => {
    const result = await uploadKycDocument({ buffer: PNG, orgId: 'org1', docType: 'pan' });
    expect(result).not.toHaveProperty('url');
    expect(result).not.toHaveProperty('secure_url');
    expect(result.storageKey).toContain('mpx/kyc/org1/');
  });

  it('mints a SHORT-LIVED signed url against the private asset', () => {
    const before = Math.floor(Date.now() / 1000);
    const { url, expiresAt } = signedKycUrl({ storageKey: 'mpx/kyc/org1/pan_abc', format: 'png' });

    expect(url).toBe('https://res.cloudinary.com/signed');
    expect(spy.signOptions.type).toBe('private');
    // Default TTL is 120s — a leaked link is useless within minutes.
    expect(spy.signOptions.expires_at).toBeGreaterThan(before);
    expect(spy.signOptions.expires_at).toBeLessThanOrEqual(before + 121);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
