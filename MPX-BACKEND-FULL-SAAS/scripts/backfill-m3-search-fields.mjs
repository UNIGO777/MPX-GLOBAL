import 'dotenv/config';
import mongoose from 'mongoose';

// §A26 (M3-A) — populate the denormalised search fields on every existing
// Product: `searchKeywords`, `categoryType`, `topCategoryId`. Products created
// before M3 have none of them, so without this run they are invisible to
// keyword search and carry no facet keys.
//
// Idempotent and safe to re-run (it recomputes from current data). MUST be run
// once per environment before search goes live — the same discipline as the A21
// index migrations, because index creation alone does not populate fields.
//
//   node scripts/backfill-m3-search-fields.mjs
//
// It also syncs indexes first, so the new text indexes exist on the collection.
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

const { Product } = await import('../src/models/Product.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { rebuildAll } = await import('../src/services/searchSync.service.js');

await Product.syncIndexes();
await Organisation.syncIndexes();
console.log('indexes synced (product_text, organisation_text)');

const total = await Product.countDocuments({});
const { updated } = await rebuildAll();
console.log(`backfill complete: ${updated}/${total} products updated`);

await mongoose.disconnect();
