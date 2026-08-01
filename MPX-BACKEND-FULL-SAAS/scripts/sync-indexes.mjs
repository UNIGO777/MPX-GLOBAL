import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * FINALIZE F-C — create every schema-declared index on a target database.
 *
 * WHY THIS EXISTS. `database.js` sets `autoIndex: env.NODE_ENV !== 'production'`
 * — deliberately, so startup never blocks on a large index build — and nothing
 * runs `syncIndexes()` at boot. That means a fresh PRODUCTION deploy comes up
 * with no indexes at all beyond `_id`, and until now the only things that ever
 * created any were the seed scripts (User, Organisation, Category,
 * CategoryAttribute, Product) and the two A21 migrations. Every other
 * collection — Conversation, Message, Inquiry, DeviceToken, SavedItem, AuditLog,
 * ErrorLog — would have had none.
 *
 * That is not only a performance problem. `ErrorLog`'s 90-day retention (A19) IS
 * a TTL index: without it nothing ever expires and the collection grows forever.
 * The uniqueness guarantees are indexes too.
 *
 * Run this once per environment as part of deployment, before traffic.
 *
 *   node scripts/sync-indexes.mjs --dry-run   # report the diff, change nothing
 *   node scripts/sync-indexes.mjs             # apply it
 *
 * ⚠️  `syncIndexes()` also DROPS indexes that are no longer declared in a schema.
 * That is what makes it a sync rather than a create, and it is why --dry-run
 * exists: read the drop list before applying it on a live database.
 */

const dryRun = process.argv.includes('--dry-run');

// Importing the barrel registers every model on the default connection.
await import('../src/models/index.js');

// `autoIndex: false` is REQUIRED, not a tidiness choice. Mongoose defaults it to
// true, and with it on, merely connecting with the models registered kicks off a
// background build of every schema index — which would make --dry-run silently
// create the very indexes it claims only to be reporting. Index creation here
// must happen through syncIndexes() alone, where it is deliberate and printed.
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  autoIndex: false,
});

const names = mongoose.modelNames().sort();
console.log(`${dryRun ? 'DRY RUN — ' : ''}${names.length} models against ${mongoose.connection.name}\n`);

let created = 0;
let dropped = 0;
let failed = 0;

for (const name of names) {
  const Model = mongoose.model(name);
  try {
    // diffIndexes reports without touching anything; syncIndexes applies and
    // returns the names it dropped.
    const diff = await Model.diffIndexes();
    const toCreate = diff.toCreate ?? [];
    const toDrop = diff.toDrop ?? [];

    if (toCreate.length === 0 && toDrop.length === 0) {
      console.log(`  ${name}: up to date`);
      continue;
    }

    if (!dryRun) await Model.syncIndexes();

    for (const key of toCreate) {
      created += 1;
      console.log(`  ${name}: ${dryRun ? 'would create' : 'created'} ${JSON.stringify(key)}`);
    }
    for (const key of toDrop) {
      dropped += 1;
      console.log(`  ⚠️  ${name}: ${dryRun ? 'would DROP' : 'DROPPED'} ${JSON.stringify(key)}`);
    }
  } catch (err) {
    // Keep going: one model's failure must not leave the rest unindexed. A
    // non-zero exit at the end makes sure a deploy still notices.
    failed += 1;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

console.log(
  `\n${dryRun ? 'would create' : 'created'} ${created}, ${dryRun ? 'would drop' : 'dropped'} ${dropped}, failed ${failed}`,
);

await mongoose.disconnect();
if (failed > 0) process.exitCode = 1;
