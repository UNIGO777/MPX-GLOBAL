import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import '../models/index.js';
import { Category } from '../models/Category.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { Product } from '../models/Product.js';
import { slugify } from '../utils/slug.js';
import { CATALOGUE, subTypeForTopIndex } from './catalogue.data.js';

/**
 * M2-C — seed the category taxonomy + attribute defaults.
 *
 * IDEMPOTENT and NON-DESTRUCTIVE: rows are inserted only when missing (matched
 * by slug / (categoryId, key)); existing rows are NEVER updated, so admin edits
 * (renames, toggles, synonyms, added options) survive a re-run.
 *
 * Slugs are computed here deterministically (explicit overrides in the data
 * file resolve known clashes like leather-footwear) — no random suffixes, so
 * re-runs match the same rows.
 */
export async function seedCatalogue() {
  const counts = { topsInserted: 0, subsInserted: 0, attrsInserted: 0 };

  for (const [i, top] of CATALOGUE.entries()) {
    const topSlug = slugify(top.name);
    let topDoc = await Category.findOne({ slug: topSlug });
    if (!topDoc) {
      topDoc = await Category.create({
        name: top.name,
        slug: topSlug,
        parentId: null, // A16: NO type on a top
        active: true,
        order: i + 1,
      });
      counts.topsInserted += 1;
    }

    for (const [j, subEntry] of top.subs.entries()) {
      const sub = typeof subEntry === 'string' ? { name: subEntry } : subEntry;
      const subSlug = sub.slug ?? slugify(sub.name);
      const type = sub.type ?? subTypeForTopIndex(i);

      let subDoc = await Category.findOne({ slug: subSlug });
      if (!subDoc) {
        subDoc = await Category.create({
          name: sub.name,
          slug: subSlug,
          parentId: topDoc._id,
          type,
          active: true,
          order: j + 1,
        });
        counts.subsInserted += 1;
      }

      // §A25.2 attribute defaults — the top's field set applies to each of its
      // subs (the Form-Fields list is per top). Insert-if-missing by (cat, key).
      for (const [k, [key, name, inputType, unit]] of top.attrs.entries()) {
        const exists = await CategoryAttribute.findOne({ categoryId: subDoc._id, key }).select('_id');
        if (exists) continue;
        await CategoryAttribute.create({
          categoryId: subDoc._id,
          key,
          name,
          inputType,
          ...(unit ? { unit } : {}),
          required: false, // admin tightens later (§A25.2)
          filterable: inputType === 'number' || inputType === 'boolean',
          order: k + 1,
        });
        counts.attrsInserted += 1;
      }
    }
  }

  return counts;
}

// CLI: npm run seed:catalogue (connects, syncs indexes, seeds, disconnects).
const isCli = process.argv[1] && process.argv[1].endsWith('catalogue.js');
if (isCli) {
  try {
    await mongoose.connect(env.MONGODB_URI);
    await Category.syncIndexes();
    await CategoryAttribute.syncIndexes();
    await Product.syncIndexes();
    const counts = await seedCatalogue();
    logger.info(counts, 'catalogue seed complete');
    await mongoose.disconnect();
  } catch (err) {
    logger.error({ err: { name: err.name, message: err.message } }, 'catalogue seed failed');
    process.exit(1);
  }
}
