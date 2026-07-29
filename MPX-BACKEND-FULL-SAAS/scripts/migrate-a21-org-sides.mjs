import 'dotenv/config';
import mongoose from 'mongoose';

// A21 Step 3 — backfill Organisation side flags, THEN retype. Raw driver only
// (no Mongoose schema validation), so it can write type:'business' before the
// enum-tightened code exists. ORDER: buyerSide → exporterSide → retype.
// Re-run once per environment before deploying the tightened enum.
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const orgs = mongoose.connection.db.collection('organisations');

const proj = { projection: { name: 1, type: 1, buyerSide: 1, exporterSide: 1 } };
console.log('BEFORE:', JSON.stringify(await orgs.find({}, proj).toArray(), null, 2));

const r1 = await orgs.updateMany({ type: 'buyer' }, { $set: { buyerSide: true } });
console.log('1. buyerSide=true where type=buyer     → modified', r1.modifiedCount);
const r2 = await orgs.updateMany({ type: 'exporter' }, { $set: { exporterSide: true } });
console.log('2. exporterSide=true where type=exporter → modified', r2.modifiedCount);
const r3 = await orgs.updateMany({ type: { $in: ['buyer', 'exporter'] } }, { $set: { type: 'business' } });
console.log('3. retype buyer|exporter → business      → modified', r3.modifiedCount);

console.log('AFTER:', JSON.stringify(await orgs.find({}, proj).toArray(), null, 2));
await mongoose.disconnect();
