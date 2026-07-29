import 'dotenv/config';
import mongoose from 'mongoose';

// A21 Step 3 — backfill Organisation side flags, THEN retype. Raw driver only
// (no Mongoose schema validation), so it can write type:'business' before the
// enum-tightened code exists. ORDER: buyerSide → exporterSide → retype.
// Re-run once per environment before deploying the tightened enum.

// Exported so it is unit-testable against any db handle. Returns the modified
// counts. Idempotent: a second run matches 0 rows.
export async function migrateOrgSides(db) {
  const orgs = db.collection('organisations');
  const r1 = await orgs.updateMany({ type: 'buyer' }, { $set: { buyerSide: true } });
  const r2 = await orgs.updateMany({ type: 'exporter' }, { $set: { exporterSide: true } });
  const r3 = await orgs.updateMany({ type: { $in: ['buyer', 'exporter'] } }, { $set: { type: 'business' } });
  return { buyerSideSet: r1.modifiedCount, exporterSideSet: r2.modifiedCount, retyped: r3.modifiedCount };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const proj = { projection: { name: 1, type: 1, buyerSide: 1, exporterSide: 1 } };
  console.log('BEFORE:', JSON.stringify(await db.collection('organisations').find({}, proj).toArray(), null, 2));
  console.log('modified:', await migrateOrgSides(db));
  console.log('AFTER:', JSON.stringify(await db.collection('organisations').find({}, proj).toArray(), null, 2));
  await mongoose.disconnect();
}

// Run only when executed directly (`node scripts/...`), not when imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) run();
