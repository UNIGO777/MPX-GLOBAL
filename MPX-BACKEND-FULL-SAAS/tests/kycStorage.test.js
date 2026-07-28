import { describe, it, expect } from 'vitest';

import { verifyKycFile } from '../src/services/kyc.storage.service.js';

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
