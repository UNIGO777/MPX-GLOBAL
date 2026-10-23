import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/slug.js';
import '../models/index.js';
import { User } from '../models/User.js';
import { Organisation } from '../models/Organisation.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';

/**
 * Fill the demo exporter's catalogue — 10 products in EVERY sub-category — so a
 * demo has something to search, filter and open (owner, 2026-10-05).
 *
 * 🔴 **Development only**, the same guard every dev affordance here carries
 * (`test-accounts.js`, OTP_DEV_PRINT, the fixed OTP code). `test` is excluded
 * too, so a suite can never seed into its own database.
 *
 * 🔴 **It VERIFIES the demo organisation first, and that is the point — not a
 * shortcut past D1.** An unverified seller may hold 3 active products and 10
 * drafts (`product.service.js`, `assertActiveCap` / `assertDraftCap`), which is
 * a contractual control written into agreement §3.2. Those checks are skipped
 * for a VERIFIED org, by design, so the supported way to hold a full catalogue
 * is to be verified — not to weaken the cap. The alternative, writing 2,600 rows
 * straight past a cap the account still fails, would leave the database in a
 * state the API itself would refuse to create.
 *
 * 🔴 **Images are EXTERNAL stock photos, and that has a consequence.** The owner
 * asked for Unsplash imagery (2026-10-06). Every real product image here is a
 * Cloudinary upload the server validates as its own (`isOwnCloudinaryUrl` in
 * `product.service.js`), so these rows are demo-only in a way the others are
 * not: they render fine — the public projection emits `images[].url` verbatim
 * and the card uses it raw — but **opening one in the product editor and saving
 * will fail that check**. That is correct behaviour, not a bug to work around:
 * the alternative is relaxing an upload-provenance check for seed data.
 *
 * Idempotent: slugs are deterministic (`<sub-slug>-<variant>`), and anything
 * already present is skipped, so a re-run tops up rather than duplicating.
 */

const DEMO_EXPORTER_EMAIL = 'demo-exporter@mpx.test';
const PER_CATEGORY = 10;

/**
 * 🔴 The ONE definition of "this script made it", used to write the rows AND to
 * find them again for `--purge`. It must stay a single constant: a purge that
 * re-derives the rule (by org, by slug shape, by date) is a purge that deletes
 * the wrong thing the moment the seed changes.
 *
 * Deliberately NOT "everything belonging to Demo Exports" — that account also
 * holds products a person created by hand, and they must survive a purge.
 */
const DEMO_PUBLIC_ID_PREFIX = 'demo/';
const DEMO_MARKER = { 'images.publicId': { $regex: `^${DEMO_PUBLIC_ID_PREFIX}` } };

/**
 * Where the demo photography comes from.
 *
 * 🔴 **Unsplash's keyword endpoint does NOT work** — `source.unsplash.com/featured/?terms`
 * was retired and returns **503** (checked 2026-10-06). Anything written against
 * it ships 2,600 broken images. These are real photo IDs on
 * `images.unsplash.com` instead, and **every one was fetched and returned 200**
 * before being put here; one candidate 404'd and was dropped.
 *
 * Photos are picked per TOP category so a card shows the right world, and the
 * variant index walks the pool so products inside one category differ.
 *
 * 🔴 **A 200 is not enough — these were checked BY EYE.** The first pass only
 * confirmed the URLs resolved, and shipped a CAT on a fence for Leather, a row
 * of cars for Metals, headphones for Plastics, a "SALE 50%" sign for Packaging
 * and a man with a blowtorch for Textiles. Every id below was downloaded and
 * looked at on a contact sheet. Do the same for any replacement.
 */
const IMAGE_PARAMS = 'auto=format&fit=crop&w=1200&h=900&q=70';

const PHOTOS = {
  agriculture: ['photo-1500937386664-56d1dfef3854', 'photo-1574323347407-f5e1ad6d020b'],
  textiles: ['photo-1529720317453-c8da503f2051', 'photo-1620799140408-edc6dcb6d633'],
  apparel: ['photo-1489987707025-afc232f7ea0f', 'photo-1441986300917-64674bd600d8'],
  leather: ['photo-1584917865442-de89df76afd3'],
  footwear: ['photo-1549298916-b41d501d3772'],
  food: ['photo-1506617564039-2f3b650b7010'],
  chemicals: ['photo-1532187863486-abf9dbad1b69'],
  pharma: ['photo-1587854692152-cbe660dbde88'],
  machinery: ['photo-1581091226825-a6a2a5aee158'],
  electronics: ['photo-1518770660439-4636190af475'],
  automobile: ['photo-1486262715619-67b85e0b08d3'],
  construction: ['photo-1504307651254-35680f356dfd'],
  furniture: ['photo-1555041469-a586c61ea9bc'],
  handicraft: ['photo-1452860606245-08befc0ff44b'],
  jewellery: ['photo-1515562141207-7a88fb7ce338'],
  packaging: ['photo-1595246140625-573b715d11dc', 'photo-1586528116311-ad8dd3c8310d'],
  metals: ['photo-1504328345606-18bbc8c9d7d1'],
  plastics: ['photo-1572964734607-0051976fac79'],
  paper: ['photo-1586281380349-632531db7ed4'],
  sports: ['photo-1517836357463-d25dfeac3438'],
  toys: ['photo-1558877385-81a1c7e67d72'],
  beauty: ['photo-1596462502278-27bfdc403348'],
  education: ['photo-1509062522246-3755977927d7'],
  solar: ['photo-1509391366360-2e959784a276'],
  finance: ['photo-1554224155-6726b3ff858f'],
  kitchen: ['photo-1556909212-d5b604d0c90d'],
  software: ['photo-1461749280684-dccba630e2f6'],
  marketing: ['photo-1561070791-2526d30994b5'],
  tools: ['photo-1581166397057-235af2b3c6dd'],
  telecom: ['photo-1511707171634-5f897ff02aa9'],
  general: ['photo-1553413077-190dd305871c'],
};

/* Top category -> photo pool, keyed on the REAL names in the taxonomy.
   🔴 These came from the database, not from guesswork. The first version was
   written against invented names ("Industrial Machinery", "Packaging &
   Printing") and only 8 of 40 matched — the other 32 silently fell through to a
   warehouse photo, which looked deliberate and was not. `assertEveryTopMapped`
   below now fails the run instead of letting that happen quietly. */
const TOP_PHOTOS = {
  Agriculture: PHOTOS.agriculture,
  'Apparel & Garments': PHOTOS.apparel,
  'Automobile Parts & Spares': PHOTOS.automobile,
  'Bags, Luggage & Accessories': PHOTOS.leather,
  'Building & Construction': PHOTOS.construction,
  'Chemicals, Dyes & Solvents': PHOTOS.chemicals,
  'Education, Training & EdTech': PHOTOS.education,
  'Electricals — Lighting & Solar': PHOTOS.solar,
  'Electronics & Electrical': PHOTOS.electronics,
  'Environment & Water': PHOTOS.solar,
  'Finance, Accounting & Business Process Services': PHOTOS.finance,
  'Food & Beverages': PHOTOS.food,
  Footwear: PHOTOS.footwear,
  'Furniture & Furnishings': PHOTOS.furniture,
  'Gems & Jewellery': PHOTOS.jewellery,
  'Handicrafts & Decoratives': PHOTOS.handicraft,
  'Health & Beauty': PHOTOS.beauty,
  'Healthcare & Clinical Services': PHOTOS.pharma,
  'Home & Kitchen': PHOTOS.kitchen,
  'IT, Software & AI Services': PHOTOS.software,
  'Industrial Machinery & Equipment': PHOTOS.machinery,
  'Industrial Supplies': PHOTOS.tools,
  'Leather & Leather Products': PHOTOS.leather,
  'Marketing, Design & Digital Services': PHOTOS.marketing,
  'Mechanical Parts & Spares': PHOTOS.automobile,
  'Metals, Minerals & Ores': PHOTOS.metals,
  'Office Supplies & Stationery': PHOTOS.paper,
  Other: PHOTOS.general,
  'Packaging Material & Supplies': PHOTOS.packaging,
  'Paper & Paper Products': PHOTOS.paper,
  'Pharmaceuticals & Medical': PHOTOS.pharma,
  'Pipes, Tubes & Fittings': PHOTOS.metals,
  'Plastic & PVC': PHOTOS.plastics,
  'Rubber & Rubber Products': PHOTOS.automobile,
  'Safety & Security': PHOTOS.construction,
  'Scientific & Lab Instruments': PHOTOS.chemicals,
  'Sports, Toys & Games': [...PHOTOS.sports, ...PHOTOS.toys],
  'Telecom & Mobile': PHOTOS.telecom,
  'Textiles, Fabrics & Yarn': PHOTOS.textiles,
  'Tools & Hardware': PHOTOS.tools,
};

/* Fail loudly rather than serve a warehouse photo for a whole category. */
function assertEveryTopMapped(tops) {
  const missing = tops.map((t) => t.name).filter((n) => !TOP_PHOTOS[n]);
  if (missing.length) {
    throw new Error(
      `no photo pool for ${missing.length} top categories: ${missing.join(', ')} — ` +
        'add them to TOP_PHOTOS (the names must match the taxonomy exactly)',
    );
  }
}

function productImage(topName, index) {
  const pool = TOP_PHOTOS[topName] ?? PHOTOS.general;
  const id = pool[index % pool.length];
  return `https://images.unsplash.com/${id}?${IMAGE_PARAMS}`;
}

/* Ten variants per sub-category. Deliberately plain trade language — a demo
   catalogue should read like a catalogue, not like filler. */
const GOODS_VARIANTS = [
  { label: 'Export Grade', moq: 100, unit: 'kg', min: 120, max: 180 },
  { label: 'Premium Lot', moq: 250, unit: 'kg', min: 210, max: 260 },
  { label: 'Bulk Supply', moq: 1000, unit: 'kg', min: 85, max: null },
  { label: 'Standard Grade', moq: 50, unit: 'kg', min: 95, max: 140 },
  { label: 'Wholesale Pack', moq: 500, unit: 'pcs', min: 40, max: 75 },
  { label: 'Retail Pack', moq: 25, unit: 'pcs', min: 150, max: null },
  { label: 'Industrial Grade', moq: 200, unit: 'kg', min: 70, max: 110 },
  { label: 'Certified Lot', moq: 300, unit: 'kg', min: 240, max: 320 },
  { label: 'Sample Pack', moq: 5, unit: 'pcs', min: null, max: null },
  { label: 'Container Load', moq: 5000, unit: 'kg', min: 60, max: 95 },
];

const SERVICE_VARIANTS = [
  { label: 'Starter Engagement', engagementType: 'Fixed scope', teamSize: '2–4', timeline: '2–4 weeks' },
  { label: 'Standard Engagement', engagementType: 'Fixed scope', teamSize: '4–8', timeline: '4–8 weeks' },
  { label: 'Enterprise Programme', engagementType: 'Retainer', teamSize: '8–15', timeline: '3–6 months' },
  { label: 'Dedicated Team', engagementType: 'Dedicated team', teamSize: '5–10', timeline: 'Ongoing' },
  { label: 'Audit & Assessment', engagementType: 'Fixed scope', teamSize: '2–3', timeline: '1–2 weeks' },
  { label: 'Migration Project', engagementType: 'Fixed scope', teamSize: '4–6', timeline: '6–10 weeks' },
  { label: 'Managed Service', engagementType: 'Retainer', teamSize: '3–6', timeline: 'Ongoing' },
  { label: 'Consulting Sprint', engagementType: 'Time & materials', teamSize: '1–2', timeline: '1–3 weeks' },
  { label: 'Support Plan', engagementType: 'Retainer', teamSize: '2–4', timeline: 'Ongoing' },
  { label: 'Pilot Project', engagementType: 'Fixed scope', teamSize: '2–5', timeline: '3–5 weeks' },
];

function goodsDoc(sub, orgId, v, topName, index) {
  const priceMode = v.min == null ? 'on_request' : v.max == null ? 'fixed' : 'range';
  return {
    exporterOrgId: orgId,
    categoryId: sub._id,
    name: `${sub.name} — ${v.label}`,
    slug: `${sub.slug}-${slugify(v.label)}`,
    description:
      `${sub.name} offered as a ${v.label.toLowerCase()}. Specifications, packaging and lead ` +
      `time are confirmed against your enquiry before a quotation is issued.`,
    status: 'active',
    images: [{ url: productImage(topName, index), publicId: `${DEMO_PUBLIC_ID_PREFIX}${sub.slug}/${slugify(v.label)}` }],
    price:
      priceMode === 'on_request'
        ? { mode: 'on_request' }
        : { mode: priceMode, min: v.min, ...(v.max ? { max: v.max } : {}), currency: 'INR' },
    moq: v.moq,
    unit: v.unit,
    countryOfOrigin: 'IN',
    supplyAbility: '20 tonnes per month',
    leadTime: '2–3 weeks',
    packaging: 'Export-standard cartons, palletised',
    terms: 'FOB / CIF, negotiable',
  };
}

function serviceDoc(sub, orgId, v, topName, index) {
  return {
    exporterOrgId: orgId,
    categoryId: sub._id,
    name: `${sub.name} — ${v.label}`,
    slug: `${sub.slug}-${slugify(v.label)}`,
    description:
      `${sub.name} delivered as a ${v.label.toLowerCase()}. Scope, team and timeline are ` +
      `agreed per engagement before a quotation is issued.`,
    status: 'active',
    images: [{ url: productImage(topName, index), publicId: `${DEMO_PUBLIC_ID_PREFIX}${sub.slug}/${slugify(v.label)}` }],
    price: { mode: 'on_request' },
    countryOfOrigin: 'IN',
    engagementType: v.engagementType,
    deliveryModel: 'Remote, with on-site reviews',
    teamSize: v.teamSize,
    pricingModel: 'Quoted per engagement',
    timeline: v.timeline,
  };
}

async function purge() {
  const matched = await Product.countDocuments(DEMO_MARKER);
  const survivors = await Product.countDocuments({
    'images.publicId': { $not: { $regex: `^${DEMO_PUBLIC_ID_PREFIX}` } },
  });
  const res = await Product.deleteMany(DEMO_MARKER);
  logger.info(
    { matched, deleted: res.deletedCount, keptNotSeededByThisScript: survivors, totalNow: await Product.countDocuments({}) },
    'demo products purged',
  );
}

async function run() {
  if (env.NODE_ENV !== 'development') {
    throw new Error(`refusing to touch demo products with NODE_ENV=${env.NODE_ENV} — development only`);
  }

  await mongoose.connect(env.MONGODB_URI);

  if (process.argv.includes('--purge')) {
    await purge();
    await mongoose.disconnect();
    return;
  }
  await Product.syncIndexes();

  const user = await User.findOne({ email: DEMO_EXPORTER_EMAIL, role: 'exporter' });
  if (!user) throw new Error(`${DEMO_EXPORTER_EMAIL} not found — run "npm run seed:test-accounts" first`);

  const org = await Organisation.findById(user.orgId);
  if (!org) throw new Error('the demo exporter has no organisation');

  // See the note at the top: verified is how the cap is LIFTED, not bypassed.
  let verified = false;
  if (org.kycStatus !== 'verified') {
    org.kycStatus = 'verified';
    org.verifiedAt = org.verifiedAt ?? new Date();
    await org.save();
    verified = true;
  }

  const subs = await Category.find({ parentId: { $ne: null } }).sort({ name: 1 }).lean();
  if (!subs.length) throw new Error('no sub-categories — run "npm run seed:catalogue" first');
  const tops = await Category.find({ parentId: null }).select('name').lean();
  assertEveryTopMapped(tops);
  const topName = new Map(tops.map((t) => [String(t._id), t.name]));

  const existing = new Set(
    (await Product.find({ exporterOrgId: org._id }).select('slug').lean()).map((p) => p.slug),
  );

  const docs = [];
  // Existing rows get their image refreshed rather than skipped — that is what
  // makes a photo correction possible without dropping 2,600 products.
  const refresh = [];
  for (const sub of subs) {
    const variants = sub.type === 'service' ? SERVICE_VARIANTS : GOODS_VARIANTS;
    for (const [index, v] of variants.slice(0, PER_CATEGORY).entries()) {
      const build = sub.type === 'service' ? serviceDoc : goodsDoc;
      const doc = build(sub, org._id, v, topName.get(String(sub.parentId)), index);
      if (existing.has(doc.slug)) {
        refresh.push({
          updateOne: { filter: { slug: doc.slug, exporterOrgId: org._id }, update: { $set: { images: doc.images } } },
        });
        continue;
      }
      existing.add(doc.slug);
      docs.push(doc);
    }
  }

  let inserted = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    // `ordered: false` so one bad row cannot abort the rest of the batch.
    const res = await Product.insertMany(chunk, { ordered: false });
    inserted += res.length;
  }

  let imagesRefreshed = 0;
  for (let i = 0; i < refresh.length; i += 500) {
    const res = await Product.bulkWrite(refresh.slice(i, i + 500), { ordered: false });
    imagesRefreshed += res.modifiedCount ?? 0;
  }

  logger.info(
    {
      organisation: org.name,
      imagesRefreshed,
      verifiedByThisRun: verified,
      subCategories: subs.length,
      perCategory: PER_CATEGORY,
      inserted,
      skippedAlreadyPresent: docs.length === 0 && subs.length > 0 ? 'all' : subs.length * PER_CATEGORY - docs.length,
      totalNow: await Product.countDocuments({ exporterOrgId: org._id }),
    },
    'demo products seeded',
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err: { name: err.name, message: err.message } }, 'demo product seed failed');
  process.exit(1);
});
