import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { crc32 } from 'node:zlib';

// Cloudinary faked at the SDK edge, so the real storage service runs: the
// type sniffing, the active-content screen, the private/raw upload options and
// the forced-download URL are all under test, not mocked away.
const uploads = [];
const signed = [];
vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  cloudinary: {
    uploader: {
      upload_stream: (opts, cb) => ({
        end: (buf) => {
          uploads.push(opts);
          cb(null, { public_id: opts.public_id, bytes: buf.length });
        },
      }),
    },
    utils: {
      private_download_url: (id, format, opts) => {
        signed.push({ id, format, opts });
        return `https://api.cloudinary.test/download?sig=x&exp=${opts.expires_at}`;
      },
    },
  },
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { Inquiry } = await import('../src/models/Inquiry.js');
const { Conversation } = await import('../src/models/Conversation.js');
const { Message } = await import('../src/models/Message.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
let buyer;
let seller;
let outsider;
let conversationId;

// --- fixtures: real file bytes, built in-process ------------------------------

/** A minimal stored (uncompressed) zip — enough for real OOXML detection. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const n = Buffer.from(name);
    const d = Buffer.from(text);
    const c = crc32(d);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(c, 14);
    lh.writeUInt32LE(d.length, 18); lh.writeUInt32LE(d.length, 22); lh.writeUInt16LE(n.length, 26);
    locals.push(lh, n, d);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(c, 16);
    ch.writeUInt32LE(d.length, 20); ch.writeUInt32LE(d.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, n);
    offset += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
const types = (main) =>
  `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/x" ContentType="${main}"/></Types>`;
const WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const SHEET = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<<>>\n%%EOF');
const PDF_JS = Buffer.from('%PDF-1.4\n1 0 obj<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>endobj\n%%EOF');
const DOCX = zip([['[Content_Types].xml', types(WORD)], ['word/document.xml', '<w/>']]);
const XLSX = zip([['[Content_Types].xml', types(SHEET)], ['xl/workbook.xml', '<w/>']]);
const DOCM = zip([['[Content_Types].xml', types('application/vnd.ms-word.document.macroEnabled.main+xml')], ['word/document.xml', '<w/>'], ['word/vbaProject.bin', 'x']]);
// A .docm wearing a .docx content type — the renamed-macro trick.
const DOCX_WITH_MACRO = zip([['[Content_Types].xml', types(WORD)], ['word/document.xml', '<w/>'], ['word/vbaProject.bin', 'x']]);
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const PLAIN_ZIP = zip([['notes.txt', 'hello']]);

async function makeUser(role, orgFields = {}) {
  seq += 1;
  const org = await Organisation.create({ name: `${role} Co ${seq}`, type: 'business', ...orgFields });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `doc_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `42${1000000 + seq}`, e164: `+9142${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
  });
  return { org, user, token: signAccessToken(user) };
}

const sendDoc = (token, buf, filename, body = 'Our quotation, attached.', id = conversationId) => {
  const req = request(app).post(`/conversations/${id}/messages/document`).set(bearer(token));
  if (body !== null) req.field('body', body);
  return req.attach('document', buf, filename);
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => { await mongoose.disconnect(); });

beforeEach(async () => {
  uploads.length = 0;
  signed.length = 0;
  await Promise.all([
    User.deleteMany({}), Organisation.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), Inquiry.deleteMany({}), Conversation.deleteMany({}),
    mongoose.connection.db.collection('messages').deleteMany({}),
  ]);
  invalidateLeafCache();
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  const leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  seller = await makeUser('exporter', { exporterSide: true, country: 'IN' });
  buyer = await makeUser('buyer', { buyerSide: true, country: 'AU' });
  outsider = await makeUser('buyer', { buyerSide: true, country: 'NZ' });
  const product = await Product.create({
    exporterOrgId: seller.org._id, categoryId: leaf._id, name: 'Cotton Roll',
    status: 'active', price: { mode: 'fixed', min: 300, currency: 'INR' },
  });
  const res = await request(app).post('/inquiries').set(bearer(buyer.token))
    .send({ productId: String(product._id), note: 'Please share your best price.' });
  conversationId = res.body.conversationId;
});

describe('D10 · chat documents — what is accepted', () => {
  it('sends a PDF as a PRIVATE RAW asset and returns a forced-download URL, never the storage key', async () => {
    const res = await sendDoc(seller.token, PDF, 'Quotation Sept.pdf');
    expect(res.status).toBe(201);

    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({ type: 'private', resource_type: 'raw', overwrite: false });
    expect(uploads[0].public_id).toMatch(new RegExp(`^mpx/chat/${conversationId}/[0-9a-f]{24}\\.pdf$`));

    const att = res.body.message.attachment;
    expect(att).toMatchObject({ kind: 'document', name: 'Quotation Sept.pdf', format: 'pdf' });
    expect(att.url).toMatch(/^https:\/\/api\.cloudinary\.test\//);
    expect(JSON.stringify(res.body)).not.toContain(uploads[0].public_id);
    expect(signed.at(-1).opts).toMatchObject({ resource_type: 'raw', attachment: true });
  });

  it('accepts .docx and .xlsx, detected by real bytes', async () => {
    const d = await sendDoc(buyer.token, DOCX, 'spec.docx');
    const x = await sendDoc(buyer.token, XLSX, 'prices.xlsx');
    expect([d.status, x.status]).toEqual([201, 201]);
    expect(d.body.message.attachment).toMatchObject({ kind: 'document', format: 'docx', name: 'spec.docx' });
    expect(x.body.message.attachment).toMatchObject({ kind: 'document', format: 'xlsx', name: 'prices.xlsx' });
  });

  it('the extension is the SERVER\'s, and path / bidi tricks are stripped from the name', async () => {
    const res = await sendDoc(seller.token, PDF, '../../invoice‮fdp.exe');
    expect(res.status).toBe(201);
    const { name } = res.body.message.attachment;
    expect(name).toBe('invoicefdp.pdf');
    expect(name).not.toMatch(/[\\/‮]/);
  });

  it('keeps a non-English file name intact (UTF-8, not mojibake)', async () => {
    const res = await sendDoc(seller.token, PDF, 'Qualité मूल्य सूची.pdf');
    expect(res.status).toBe(201);
    expect(res.body.message.attachment.name).toBe('Qualité मूल्य सूची.pdf');
  });

  it('a document still needs its line of text, like an image', async () => {
    const res = await sendDoc(seller.token, PDF, 'q.pdf', null);
    expect(res.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });
});

describe('D10 · chat documents — what is refused', () => {
  it.each([
    ['a macro-enabled .docm', DOCM, 'm.docm'],
    ['a .docx carrying a VBA project', DOCX_WITH_MACRO, 'looks-fine.docx'],
    ['a PDF with JavaScript', PDF_JS, 'invoice.pdf'],
    ['an image on the document route', PNG, 'photo.pdf'],
    ['a plain zip', PLAIN_ZIP, 'files.zip'],
    ['plain text renamed .pdf', Buffer.from('just text, not a pdf'), 'fake.pdf'],
  ])('refuses %s, and stores nothing', async (_label, buf, filename) => {
    const res = await sendDoc(seller.token, buf, filename);
    expect(res.status).toBe(400);
    expect(uploads).toHaveLength(0);
    expect(await Message.countDocuments({ 'attachment.kind': 'document' })).toBe(0);
  });
});

describe('D10 · chat documents — guards run BEFORE any byte is stored', () => {
  it('a non-party gets 404 and nothing is uploaded', async () => {
    const res = await sendDoc(outsider.token, PDF, 'q.pdf');
    expect(res.status).toBe(404);
    expect(uploads).toHaveLength(0);
  });

  it('staff cannot send a document', async () => {
    const staff = await makeUser('employee', { type: 'platform' });
    const res = await sendDoc(staff.token, PDF, 'q.pdf');
    expect(res.status).toBe(403);
    expect(uploads).toHaveLength(0);
  });

  it('a frozen thread accepts no document', async () => {
    await Conversation.updateOne({ _id: conversationId }, { $set: { frozen: true } });
    const res = await sendDoc(seller.token, PDF, 'q.pdf');
    expect(res.status).toBe(409);
    expect(uploads).toHaveLength(0);
  });
});

describe('D10 · reading attachments back', () => {
  it('an image stored before D10 (no kind) still reads as an image', async () => {
    await Message.create({
      conversationId, senderType: 'buyer', senderOrgId: buyer.org._id, senderUserId: buyer.user._id,
      body: 'Old photo', attachment: { storageKey: 'mpx/chat/x/old', format: 'jpg', width: 10, height: 10 },
    });
    const res = await request(app).get(`/conversations/${conversationId}/messages`).set(bearer(buyer.token));
    expect(res.status).toBe(200);
    const old = res.body.messages.find((m) => m.body === 'Old photo');
    expect(old.attachment).toMatchObject({ kind: 'image', width: 10, height: 10 });
    expect(JSON.stringify(old)).not.toContain('mpx/chat/x/old');
  });
});
