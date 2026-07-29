import 'dotenv/config';
import mongoose from 'mongoose';

// A21 Step 3 — drop the OLD global-unique user indexes and create the compound
// (identifier + role) pair. autoIndex CREATES schema indexes but NEVER drops
// removed ones, and the app runs no syncIndexes at startup — so this must be run
// once per environment before deploy. Run AFTER migrate-a21-org-sides.mjs.
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const users = mongoose.connection.db.collection('users');

for (const name of ['email_1', 'mobile.e164_1']) {
  try {
    await users.dropIndex(name);
    console.log('dropped', name);
  } catch (e) {
    console.log(e.codeName === 'IndexNotFound' ? `absent (already gone) ${name}` : `ERROR ${name}: ${e.message}`);
  }
}
await users.createIndex({ email: 1, role: 1 }, { unique: true });
console.log('created email_1_role_1 [unique]');
await users.createIndex({ 'mobile.e164': 1, role: 1 }, { unique: true });
console.log('created mobile.e164_1_role_1 [unique]');

console.log('FINAL users indexes:');
for (const i of await users.indexes()) {
  console.log(`  ${i.name}  ${JSON.stringify(i.key)}${i.unique ? '  [UNIQUE]' : ''}`);
}
await mongoose.disconnect();
