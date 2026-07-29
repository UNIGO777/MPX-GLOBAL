import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import { migrateOrgSides } from '../scripts/migrate-a21-org-sides.mjs';

// A21 · Step 3 — proves the org-sides migration LOGIC (it ran against 0 legacy
// rows on Atlas). Legacy docs use type:'buyer'/'exporter', which the tightened
// enum rejects — so they are inserted via the RAW driver (as the migration reads
// them), never through the Mongoose model.
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});
afterAll(async () => {
  await mongoose.disconnect();
});
beforeEach(async () => {
  await mongoose.connection.db.collection('organisations').deleteMany({});
});

const orgs = () => mongoose.connection.db.collection('organisations');

describe('A21 migration · migrate-a21-org-sides', () => {
  it('sets sides then retypes legacy buyer/exporter orgs; platform + kycStatus untouched', async () => {
    await orgs().insertMany([
      { name: 'Legacy Buyer', type: 'buyer', kycStatus: 'pending' },
      { name: 'Legacy Exporter', type: 'exporter', kycStatus: 'verified' },
      { name: 'Platform', type: 'platform' },
    ]);

    const res = await migrateOrgSides(mongoose.connection.db);
    expect(res).toEqual({ buyerSideSet: 1, exporterSideSet: 1, retyped: 2 });

    const buyer = await orgs().findOne({ name: 'Legacy Buyer' });
    expect(buyer.type).toBe('business');
    expect(buyer.buyerSide).toBe(true);
    expect(buyer.exporterSide).toBeUndefined(); // only the matching side is set

    const exp = await orgs().findOne({ name: 'Legacy Exporter' });
    expect(exp.type).toBe('business');
    expect(exp.exporterSide).toBe(true);
    expect(exp.kycStatus).toBe('verified'); // verification state left intact

    const platform = await orgs().findOne({ name: 'Platform' });
    expect(platform.type).toBe('platform');
    expect(platform.buyerSide).toBeUndefined();
    expect(platform.exporterSide).toBeUndefined();
  });

  it('is idempotent — a second run modifies nothing', async () => {
    await orgs().insertMany([{ name: 'B', type: 'buyer' }]);
    await migrateOrgSides(mongoose.connection.db);
    const second = await migrateOrgSides(mongoose.connection.db);
    expect(second).toEqual({ buyerSideSet: 0, exporterSideSet: 0, retyped: 0 });
  });
});
