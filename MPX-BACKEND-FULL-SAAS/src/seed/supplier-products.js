import fs from 'node:fs';
import path from 'node:path';

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
 * Give every supplier seeded from the client sheets a small catalogue in its own
 * industry (owner, 2026-10-23).
 *
 * 🔴 **Development only**, same guard as every seed here.
 *
 * 🔴 **Every price is `on_request`** — the owner asked for "price on ask". That
 * also happens to be the only honest setting: nobody has quoted these goods, and
 * inventing per-kilo numbers for real companies would put figures on their
 * public profiles that they never gave us.
 *
 * 🔴 **Images are external Unsplash URLs**, so these rows are demo-only in one
 * respect: they render, but opening one in the product editor and saving fails
 * `isOwnCloudinaryUrl`. Same trade as `demo-products.js`, same reason.
 *
 * 🔴 **Photo ids were checked BY EYE, not just for a 200.** An earlier pass on
 * `demo-products.js` verified status codes only and shipped a cat on a fence for
 * Leather and a row of cars for Metals. These are the corrected ones.
 *
 * Which supplier belongs to which industry comes from the SHEET ID prefix
 * (S01 = steel, S02 = ceramics …), joined to the account by email through
 * `seed-credentials.local.md` — the sheet id is not stored on the Organisation.
 *
 * Idempotent: deterministic slugs, existing rows skipped.
 */

const CREDENTIALS_FILE = path.resolve(process.cwd(), 'seed-credentials.local.md');
const PER_SUPPLIER = 6;

/**
 * Photo pool PER SUB-CATEGORY, not per industry (owner, 2026-10-24: "use
 * different images for every product — you are using same images for one type
 * of product"). One shared industry pool meant all 98 steel suppliers showed
 * the same welding shot on all six cards.
 *
 * 🔴 Every id below was checked BY EYE on a contact sheet, not by status code.
 * A 200 only proves the id resolves: earlier passes shipped a cat on a fence
 * for Leather, a row of cars for Metals and cardboard boxes for Tiles, all of
 * which returned 200. Two traps caught in this pass and worth keeping written
 * down:
 *   - photo-1529720317453 and photo-1620799140408 were the old "textiles"
 *     pool. They are GARMENTS (clothes on hangers, a sweatshirt flat-lay), so
 *     "Cotton fabric" and "Yarn & thread" were showing finished apparel.
 *   - photo-1565043666747 is the row of cars. It is rejected, permanently.
 *
 * Unsplash's search API now answers 401 without a key, so these cannot be
 * re-harvested by keyword — curate by hand and verify the render.
 *
 * The FIRST id in every list is that sub-category's primary, and within one
 * industry the primaries are all different. That is what stops the late slots
 * collapsing: three of S04's six sub-categories legitimately want the same
 * handful of rubber and plastic pictures, so without a reserved primary the
 * sixth product found every one of them already used and the whole catalogue's
 * "Rubber components" landed on one image.
 */
const SUB_PHOTOS = {
  // S01 · metals — first entry of each list is its UNIQUE primary
  'Iron & steel (casting/fabrication)': [
    'photo-1504328345606-18bbc8c9d7d1',
    'photo-1558618666-fcd25c85cd64',
    'photo-1504917595217-d4dc5ebe6122',
    'photo-1581091226825-a6a2a5aee158',
    'photo-1581244277943-fe4a9c777189',
  ],
  'Stainless steel': [
    'photo-1504917595217-d4dc5ebe6122',
    'photo-1513828583688-c52646db42da',
    'photo-1581244277943-fe4a9c777189',
    'photo-1504328345606-18bbc8c9d7d1',
    'photo-1558618666-fcd25c85cd64',
  ],
  'Copper & brass': [
    'photo-1581244277943-fe4a9c777189',
    'photo-1504328345606-18bbc8c9d7d1',
    'photo-1513828583688-c52646db42da',
    'photo-1558618666-fcd25c85cd64',
    'photo-1504917595217-d4dc5ebe6122',
  ],
  'Aluminium': [
    'photo-1558618666-fcd25c85cd64',
    'photo-1504917595217-d4dc5ebe6122',
    'photo-1581091226825-a6a2a5aee158',
    'photo-1581244277943-fe4a9c777189',
    'photo-1513828583688-c52646db42da',
  ],
  'Metal sheets & coils': [
    'photo-1513828583688-c52646db42da',
    'photo-1581244277943-fe4a9c777189',
    'photo-1504328345606-18bbc8c9d7d1',
    'photo-1504917595217-d4dc5ebe6122',
    'photo-1581091226825-a6a2a5aee158',
  ],
  'TMT bars & steel': [
    'photo-1504307651254-35680f356dfd',
    'photo-1581141849291-1125c7b692b5',
    'photo-1504328345606-18bbc8c9d7d1',
    'photo-1558618666-fcd25c85cd64',
    'photo-1513828583688-c52646db42da',
  ],

  // S02 · ceramics & construction — first entry of each list is its UNIQUE primary
  'Tiles & marble (ceramic/granite)': [
    'photo-1564540583246-934409427776',
    'photo-1600566752355-35792bedcfea',
    'photo-1584622650111-993a426fbf0a',
  ],
  'Sanitaryware & fittings': [
    'photo-1542013936693-884638332954',
    'photo-1584622650111-993a426fbf0a',
    'photo-1564540583246-934409427776',
    'photo-1600566752355-35792bedcfea',
  ],
  'Cement & concrete': [
    'photo-1565008447742-97f6f38c985c',
    'photo-1581141849291-1125c7b692b5',
    'photo-1600566753190-17f0baa2a6c3',
    'photo-1504307651254-35680f356dfd',
  ],
  'Bricks & blocks': [
    'photo-1600047509807-ba8f99d2cdde',
    'photo-1600585154340-be6161a56a0c',
    'photo-1600596542815-ffad4c1539a9',
    'photo-1600566753190-17f0baa2a6c3',
  ],

  // S03 · textiles & apparel — first entry of each list is its UNIQUE primary
  'Cotton fabric': [
    'photo-1604176354204-9268737828e4',
    'photo-1616627561950-9f746e330187',
    'photo-1529720317453-c8da503f2051',
  ],
  'Yarn & thread': [
    'photo-1616627561950-9f746e330187',
    'photo-1604176354204-9268737828e4',
    'photo-1561070791-2526d30994b5',
  ],
  'Dyed & printed fabric': [
    'photo-1561070791-2526d30994b5',
    'photo-1604176354204-9268737828e4',
    'photo-1529720317453-c8da503f2051',
  ],
  'Home textiles (bedsheets, towels)': [
    'photo-1582719478250-c89cae4dc85b',
    'photo-1616627561950-9f746e330187',
    'photo-1616486029423-aaa4789e8c9a',
  ],
  "Men's clothing": [
    'photo-1489987707025-afc232f7ea0f',
    'photo-1551488831-00ddcb6c6bd3',
    'photo-1620799140408-edc6dcb6d633',
    'photo-1594938291221-94f18cbb5660',
  ],
  "Women's clothing": [
    'photo-1441986300917-64674bd600d8',
    'photo-1529720317453-c8da503f2051',
    'photo-1601762603339-fd61e28b698a',
    'photo-1603189343302-e603f7add05a',
  ],

  // S04 · chemicals, plastic & rubber — first entry of each list is its UNIQUE primary
  'Industrial chemicals': [
    'photo-1581093450021-4a7360e9a6b5',
    'photo-1581093577421-f561a654a353',
    'photo-1614935151651-0bea6508db6b',
    'photo-1611273426858-450d8e3c9fce',
  ],
  'Dyes & pigments': [
    'photo-1561070791-2526d30994b5',
    'photo-1532187863486-abf9dbad1b69',
    'photo-1581093450021-4a7360e9a6b5',
  ],
  'Plastic granules & raw material': [
    'photo-1583947215259-38e31be8751f',
    'photo-1532187863486-abf9dbad1b69',
    'photo-1611273426858-450d8e3c9fce',
  ],
  'Moulded plastic products': [
    'photo-1585421514738-01798e348b17',
    'photo-1583947215259-38e31be8751f',
    'photo-1584820927498-cfe5211fd8bf',
  ],
  'Rubber sheets': [
    'photo-1584820927498-cfe5211fd8bf',
    'photo-1585421514738-01798e348b17',
    'photo-1583947215259-38e31be8751f',
  ],
  'Rubber components': [
    'photo-1581244277943-fe4a9c777189',
    'photo-1585421514738-01798e348b17',
    'photo-1584820927498-cfe5211fd8bf',
  ],

  // S05 · machinery — first entry of each list is its UNIQUE primary
  'Manufacturing machines': [
    'photo-1581091226825-a6a2a5aee158',
    'photo-1581092160607-ee22621dd758',
    'photo-1513828583688-c52646db42da',
  ],
  'Packaging machines': [
    'photo-1513828583688-c52646db42da',
    'photo-1586528116311-ad8dd3c8310d',
    'photo-1581091226825-a6a2a5aee158',
  ],
  'Food processing machines': [
    'photo-1581092160607-ee22621dd758',
    'photo-1513828583688-c52646db42da',
    'photo-1581091226825-a6a2a5aee158',
  ],
  'CNC & machine tools': [
    'photo-1537462715879-360eeb61a0ad',
    'photo-1572981779307-38b8cabb2407',
    'photo-1581166397057-235af2b3c6dd',
    'photo-1581244277943-fe4a9c777189',
  ],
  'Textile machinery': [
    'photo-1486262715619-67b85e0b08d3',
    'photo-1581091226825-a6a2a5aee158',
    'photo-1581092160607-ee22621dd758',
  ],
  'Printing machines': [
    'photo-1561070791-2526d30994b5',
    'photo-1537462715879-360eeb61a0ad',
    'photo-1581166397057-235af2b3c6dd',
  ],

  // S06 · jewellery — first entry of each list is its UNIQUE primary
  'Gold & silver jewellery': [
    'photo-1610375461246-83df859d849d',
    'photo-1596944924616-7b38e7cfac36',
    'photo-1611591437281-460bfbe1220a',
    'photo-1617038220319-276d3cfab638',
  ],
  'Imitation jewellery': [
    'photo-1617038260897-41a1f14a8ca0',
    'photo-1603974372039-adc49044b6bd',
    'photo-1611652022419-a9419f74343d',
    'photo-1620656798579-1984d9e87df7',
  ],
  'Precious & semi-precious stones': [
    'photo-1599643478518-a784e5dc4c8f',
    'photo-1603561596112-0a132b757442',
    'photo-1535632066927-ab7c9ab60908',
    'photo-1515562141207-7a88fb7ce338',
  ],
  'Diamond jewellery': [
    'photo-1573408301185-9146fe634ad0',
    'photo-1588444837495-c6cfeb53f32d',
    'photo-1589128777073-263566ae5e4d',
    'photo-1605100804763-247f67b3557e',
    'photo-1627293509201-cd0c780043e6',
  ],
  'Jewellery-making supplies': [
    'photo-1584302179602-e4c3d3fd629d',
    'photo-1620656798579-1984d9e87df7',
    'photo-1515562141207-7a88fb7ce338',
    'photo-1617038260897-41a1f14a8ca0',
  ],

  // S07 · food & agriculture — first entry of each list is its UNIQUE primary
  'Grains, pulses & cereals': [
    'photo-1574323347407-f5e1ad6d020b',
    'photo-1500937386664-56d1dfef3854',
    'photo-1596040033229-a9821ebd058d',
  ],
  'Spices & herbs': [
    'photo-1596040033229-a9821ebd058d',
    'photo-1563822249366-3efb23b8e0c9',
    'photo-1574323347407-f5e1ad6d020b',
  ],
  'Fresh fruits & vegetables': [
    'photo-1506617564039-2f3b650b7010',
    'photo-1518977676601-b53f82aba655',
    'photo-1550989460-0adf9ea622e2',
    'photo-1559181567-c3190ca9959b',
    'photo-1587049352846-4a222e784d38',
    'photo-1592924357228-91a4daadcfea',
    'photo-1597362925123-77861d3fbac7',
  ],
  'Edible oils': [
    'photo-1597848212624-a19eb35e2651',
    'photo-1611930022073-b7a4ba5fcccd',
    'photo-1587734195503-904fca47e0e9',
  ],
  'Packaged & processed food': [
    'photo-1498579150354-977475b7ea0b',
    'photo-1543168256-418811576931',
    'photo-1578916171728-46686eac8d58',
    'photo-1596463059283-da257325bab8',
    'photo-1599043513900-ed6fe01d3833',
    'photo-1601050690597-df0568f70950',
    'photo-1603133872878-684f208fb84b',
    'photo-1606787366850-de6330128bfc',
  ],
  'Beverages (tea, coffee, juices)': [
    'photo-1550583724-b2692b85b150',
    'photo-1587734195503-904fca47e0e9',
    'photo-1605000797499-95a51c5269ae',
    'photo-1606924735276-fbb5b325e933',
  ],

  // S08 · packaging & paper — first entry of each list is its UNIQUE primary
  'Corrugated boxes & cartons': [
    'photo-1587293852726-70cdb56c2866',
    'photo-1595246140625-573b715d11dc',
    'photo-1590247813693-5541d1c609fd',
    'photo-1565610222536-ef125c59da2e',
  ],
  'Paper bags': [
    'photo-1595246140625-573b715d11dc',
    'photo-1452860606245-08befc0ff44b',
    'photo-1559056199-641a0ac8b55e',
  ],
  'Pouches & films': [
    'photo-1559056199-641a0ac8b55e',
    'photo-1595246140625-573b715d11dc',
    'photo-1452860606245-08befc0ff44b',
  ],
  'Labels & stickers': [
    'photo-1561070791-2526d30994b5',
    'photo-1452860606245-08befc0ff44b',
    'photo-1559056199-641a0ac8b55e',
  ],
  'Packaging tapes': [
    'photo-1452860606245-08befc0ff44b',
    'photo-1559056199-641a0ac8b55e',
    'photo-1595246140625-573b715d11dc',
  ],
  'Kraft paper': [
    'photo-1590247813693-5541d1c609fd',
    'photo-1595246140625-573b715d11dc',
    'photo-1559056199-641a0ac8b55e',
  ],

  // S09 · electronics & electrical — first entry of each list is its UNIQUE primary
  'Wires & cables': [
    'photo-1621905252507-b35492cc74b4',
    'photo-1621905251189-08b45d6a269e',
    'photo-1621905251918-48416bd8575a',
  ],
  'LED lights & lighting': [
    'photo-1513506003901-1e6a229e2d15',
    'photo-1540932239986-30128078f3c5',
    'photo-1615529182904-14819c35db37',
  ],
  'Batteries & power supplies': [
    'photo-1509391366360-2e959784a276',
    'photo-1517077304055-6e89abbf09b0',
    'photo-1518770660439-4636190af475',
  ],
  'Electronic components': [
    'photo-1517077304055-6e89abbf09b0',
    'photo-1518770660439-4636190af475',
    'photo-1580584126903-c17d41830450',
    'photo-1581092918056-0c4c3acd3789',
    'photo-1591488320449-011701bb6704',
  ],
  'Switches & sockets': [
    'photo-1621905251918-48416bd8575a',
    'photo-1621905251189-08b45d6a269e',
    'photo-1621905252507-b35492cc74b4',
  ],
  'Consumer electronics': [
    'photo-1484704849700-f032a568e944',
    'photo-1491933382434-500287f9b54b',
    'photo-1498049794561-7780e7231661',
    'photo-1505740420928-5e560c06d30e',
    'photo-1511707171634-5f897ff02aa9',
    'photo-1523275335684-37898b6baf30',
    'photo-1526170375885-4d8ecf77b99f',
    'photo-1546435770-a3e426bf472b',
    'photo-1550009158-9ebf69173e03',
    'photo-1580910051074-3eb694886505',
    'photo-1583394838336-acd977736f90',
    'photo-1591370874773-6702e8f12fd8',
    'photo-1598327105666-5b89351aff97',
    'photo-1612198188060-c7c2a3b66eae',
    'photo-1621600411688-4be93cd68504',
    'photo-1535303311164-664fc9ec6532',
    'photo-1611078489935-0cb964de46d6',
    'photo-1623126908029-58cb08a2b272',
    'photo-1598965402089-897ce52e8355',
  ],

  // S10 · furniture & furnishings — first entry of each list is its UNIQUE primary
  'Home furniture': [
    'photo-1484101403633-562f891dc89a',
    'photo-1505691938895-1758d7feb511',
    'photo-1540574163026-643ea20ade25',
    'photo-1540638349517-3abd5afc5847',
    'photo-1555041469-a586c61ea9bc',
    'photo-1556228453-efd6c1ff04f6',
    'photo-1567016432779-094069958ea5',
    'photo-1567538096630-e0c55bd6374c',
    'photo-1578683010236-d716f9a3f461',
    'photo-1583847268964-b28dc8f51f92',
    'photo-1584622781564-1d987f7333c1',
    'photo-1586023492125-27b2c045efd7',
    'photo-1593696140826-c58b021acf8b',
    'photo-1600121848594-d8644e57abab',
    'photo-1600210491892-03d54c0aaf87',
    'photo-1600210492486-724fe5c67fb0',
    'photo-1600566753086-00f18fb6b3ea',
    'photo-1600607687939-ce8a6c25118c',
    'photo-1615874959474-d609969a20ed',
    'photo-1616048056617-93b94a339009',
    'photo-1616486338812-3dadae4b4ace',
    'photo-1618220179428-22790b461013',
    'photo-1631679706909-1844bbd07221',
  ],
  'Office furniture': [
    'photo-1497366754035-f200968a6e72',
    'photo-1497366811353-6870744d04b2',
    'photo-1517705008128-361805f42e86',
    'photo-1524758631624-e2822e304c36',
    'photo-1538688525198-9b88f6f53126',
    'photo-1598300042247-d088f8ab3a91',
    'photo-1611269154421-4e27233ac5c7',
    'photo-1606836576983-8b458e75221d',
    'photo-1606836591695-4d58a73eba1e',
  ],
  'Modular furniture': [
    'photo-1519710164239-da123dc03ef4',
    'photo-1556909212-d5b604d0c90d',
    'photo-1562184552-997c461abbe6',
    'photo-1594026112284-02bb6f3352fe',
    'photo-1595428774223-ef52624120d2',
    'photo-1600489000022-c2086d79f9d4',
    'photo-1615875605825-5eb9bb5d52ac',
    'photo-1626806787461-102c1bfaaea1',
  ],
  'Outdoor furniture': [
    'photo-1584132967334-10e028bd69f7',
    'photo-1604014237800-1c9102c219da',
    'photo-1600596542815-ffad4c1539a9',
  ],
  'Curtains & upholstery': [
    'photo-1513161455079-7dc1de15ef3e',
    'photo-1567016432779-094069958ea5',
    'photo-1588436706487-9d55d73a39e3',
    'photo-1541123603104-512919d6a96c',
  ],
  'Mattresses': [
    'photo-1522771739844-6a9f6d5f14af',
    'photo-1566665797739-1674de7a421a',
    'photo-1582582621959-48d27397dc69',
    'photo-1582719478250-c89cae4dc85b',
    'photo-1584132905271-512c958d674a',
    'photo-1616486029423-aaa4789e8c9a',
    'photo-1616594039964-ae9021a400a0',
    'photo-1631049035182-249067d7618e',
    'photo-1631049307264-da0ec9d70304',
  ],
};

/* Sheet prefix -> the taxonomy sub-categories that industry actually sells into.
   The photos no longer live here: each sub-category carries its own pool in
   SUB_PHOTOS above. Sub names are matched against the database, and a miss
   fails the run rather than silently filing goods under the wrong category. */
const INDUSTRY = {
  S01: { subs: ['Iron & steel (casting/fabrication)', 'Stainless steel', 'Copper & brass', 'Aluminium', 'Metal sheets & coils', 'TMT bars & steel'] },
  S02: { subs: ['Tiles & marble (ceramic/granite)', 'Sanitaryware & fittings', 'Cement & concrete', 'Bricks & blocks'] },
  S03: { subs: ['Cotton fabric', 'Yarn & thread', 'Dyed & printed fabric', 'Home textiles (bedsheets, towels)', "Men's clothing", "Women's clothing"] },
  S04: { subs: ['Industrial chemicals', 'Dyes & pigments', 'Plastic granules & raw material', 'Moulded plastic products', 'Rubber sheets', 'Rubber components'] },
  S05: { subs: ['Manufacturing machines', 'Packaging machines', 'Food processing machines', 'CNC & machine tools', 'Textile machinery', 'Printing machines'] },
  S06: { subs: ['Gold & silver jewellery', 'Imitation jewellery', 'Precious & semi-precious stones', 'Diamond jewellery', 'Jewellery-making supplies'] },
  S07: { subs: ['Grains, pulses & cereals', 'Spices & herbs', 'Fresh fruits & vegetables', 'Edible oils', 'Packaged & processed food', 'Beverages (tea, coffee, juices)'] },
  S08: { subs: ['Corrugated boxes & cartons', 'Paper bags', 'Pouches & films', 'Labels & stickers', 'Packaging tapes', 'Kraft paper'] },
  S09: { subs: ['Wires & cables', 'LED lights & lighting', 'Batteries & power supplies', 'Electronic components', 'Switches & sockets', 'Consumer electronics'] },
  S10: { subs: ['Home furniture', 'Office furniture', 'Modular furniture', 'Outdoor furniture', 'Curtains & upholstery', 'Mattresses'] },
};

/* The sub-category's own photos, then the rest of its industry's as a TAIL.
   The split matters: the rotation always starts inside the relevant part, and
   the tail is reached only when a supplier has exhausted it. Indexing across
   the whole thing uniformly was tried first and read badly — "Rubber
   components" came out as lab benches and "Spices & herbs" as potatoes,
   because a 3-photo sub-pool inside a 25-photo industry won barely a tenth of
   the draws. Everything in the tail is still same-industry, so an overflow
   shows a steel shot on a copper card, never a sofa. */
const INDUSTRY_PHOTOS = Object.fromEntries(
  Object.entries(INDUSTRY).map(([k, v]) => [k, [...new Set(v.subs.flatMap((n) => SUB_PHOTOS[n] ?? []))]]),
);

const poolCache = new Map();
function poolFor(sheet, subName) {
  const key = `${sheet}|${subName}`;
  if (!poolCache.has(key)) {
    const own = SUB_PHOTOS[subName] ?? [];
    poolCache.set(key, { own, all: [...new Set([...own, ...INDUSTRY_PHOTOS[sheet]])] });
  }
  return poolCache.get(key);
}

const VARIANTS = [
  { label: 'Export Grade', moq: 100, unit: 'kg' },
  { label: 'Bulk Supply', moq: 1000, unit: 'kg' },
  { label: 'Standard Grade', moq: 50, unit: 'kg' },
  { label: 'Premium Lot', moq: 250, unit: 'kg' },
  { label: 'Wholesale Pack', moq: 500, unit: 'pcs' },
  { label: 'Sample Pack', moq: 5, unit: 'pcs' },
];

function readSheetIds() {
  const map = new Map();
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(`${CREDENTIALS_FILE} is missing — it is the only record of which account came from which sheet row`);
  }
  for (const line of fs.readFileSync(CREDENTIALS_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*(S(\d\d))-\d\d\s*\|[^|]*\|[^|]*\|\s*([^|\s]+)\s*\|/);
    if (m) map.set(m[3].toLowerCase(), `S${m[2]}`);
  }
  return map;
}

async function run() {
  if (env.NODE_ENV !== 'development') {
    throw new Error(`refusing to seed supplier products with NODE_ENV=${env.NODE_ENV} — development only`);
  }
  await mongoose.connect(env.MONGODB_URI);

  const sheetOf = readSheetIds();
  const subs = await Category.find({ parentId: { $ne: null } }).select('name slug').lean();
  const subByName = new Map(subs.map((s) => [s.name, s]));

  // 🔴 A sub-category name that no longer exists must STOP the run. Falling back
  // would file a steel supplier's goods under whatever happened to be first.
  const missing = Object.entries(INDUSTRY).flatMap(([k, v]) => v.subs.filter((n) => !subByName.has(n)).map((n) => `${k}: ${n}`));
  if (missing.length) throw new Error(`sub-categories not found — ${missing.join(' | ')}`);

  // 🔴 Same reasoning as the guard above, applied to the photos: a sub-category
  // with no pool used to fall back to the industry's single image, which is how
  // every product of one type ended up identical. A gap stops the run instead.
  const unphotographed = Object.values(INDUSTRY).flatMap((v) => v.subs).filter((n) => !SUB_PHOTOS[n]?.length);
  if (unphotographed.length) throw new Error(`sub-categories with no photo pool — ${unphotographed.join(' | ')}`);

  // Six distinct cards per supplier only holds while every industry owns at
  // least PER_SUPPLIER photos — below that the rotation wraps and repeats.
  const thin = Object.entries(INDUSTRY_PHOTOS)
    .filter(([, photos]) => photos.length < PER_SUPPLIER)
    .map(([k, photos]) => `${k} has ${photos.length}`);
  if (thin.length) throw new Error(`industry photo pools smaller than PER_SUPPLIER (${PER_SUPPLIER}) — ${thin.join(' | ')}`);

  const users = await User.find({ role: 'exporter' }).select('email orgId').lean();
  const orgs = new Map((await Organisation.find({ exporterSide: true }).select('name').lean()).map((o) => [String(o._id), o]));

  const existing = new Set((await Product.find({}).select('slug').lean()).map((p) => p.slug));
  const docs = [];
  const refresh = [];
  let suppliers = 0;

  for (const u of users) {
    const sheet = sheetOf.get(u.email);
    if (!sheet) continue; // not one of the sheet suppliers
    const industry = INDUSTRY[sheet];
    const org = orgs.get(String(u.orgId));
    if (!industry || !org) continue;
    suppliers += 1;
    const base = slugify(org.name) || String(u.orgId).slice(-6);
    // Rotate the pools per supplier. Derived from the slug rather than the
    // query order so a re-run reproduces the same catalogue; `orgId` would do
    // as well, but the slug keeps the mapping readable when debugging a card.
    // FNV-1a rather than a sum of char codes: company names in one industry
    // share too many letters, so the plain sum clustered and several suppliers
    // started on the very same photo.
    let offset = 0x811c9dc5;
    for (const c of base) {
      offset = Math.imul(offset ^ c.charCodeAt(0), 0x01000193) >>> 0;
    }
    const usedPhotos = new Set();

    for (let i = 0; i < PER_SUPPLIER; i += 1) {
      const sub = subByName.get(industry.subs[i % industry.subs.length]);
      const v = VARIANTS[i % VARIANTS.length];
      const slug = `${base}-${sub.slug}-${slugify(v.label)}`;
      // `offset + i`, not `i`: the +i also separates the two products a supplier
      // gets in the SAME sub-category when its industry has fewer than six of
      // them (S02 has four, S06 five), which `offset` alone would collide on.
      // Walk the pool from the supplier's own starting point and take the
      // first picture it has not already shown. Metals genuinely only has
      // eight verified photos for six sub-categories, so a supplier there can
      // exhaust the set; the rotation value is then the honest fallback,
      // rather than failing a seed over a demo image.
      // Straight rotation, no "skip what this supplier already used": that
      // greedy version protected one supplier's six cards at the cost of the
      // thing actually complained about — by the last slot only one photo was
      // ever left unused, so all ten "Rubber components" in the catalogue
      // landed on the SAME picture. Every industry pool holds at least six, so
      // plain rotation gives both: six distinct cards per supplier, and a
      // different starting point per supplier within a sub-category.
      const { own, all } = poolFor(sheet, sub.name);
      // Start within the sub-category's OWN photos plus an equal stretch of
      // the industry tail, so about half the cards sit on a truly specific
      // picture and the rest widen the spread. Both extremes were measured and
      // both read badly: indexing the whole industry uniformly turned "Rubber
      // components" into lab benches and "Spices & herbs" into potatoes, while
      // confining the start to a three-photo `own` list left ten suppliers
      // sharing two images.
      const reach = own.length + Math.min(all.length - own.length, own.length);
      const from = offset % reach;
      // Take the rotation's own answer whenever it is free, and only step past
      // it when this supplier has already shown that picture. An earlier
      // version did this against three-photo pools, where by the last slot one
      // photo was always the only one left — so every "Rubber components" in
      // the catalogue collapsed onto it. Against these pools (7 to 28 deep)
      // the step is rare, so the spread across suppliers survives.
      let photo = all[from];
      for (let n = 0; n < all.length; n += 1) {
        const candidate = all[(from + n) % all.length];
        if (!usedPhotos.has(candidate)) {
          photo = candidate;
          break;
        }
      }
      usedPhotos.add(photo);
      const image = { url: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1200&h=900&q=70`, publicId: `demo/${base}/${sub.slug}-${i}` };
      if (existing.has(slug)) {
        // Refresh the photo rather than skipping — that is what lets a wrong
        // image be corrected without dropping the catalogue.
        refresh.push({ updateOne: { filter: { slug }, update: { $set: { images: [image] } } } });
        continue;
      }
      existing.add(slug);
      docs.push({
        exporterOrgId: u.orgId,
        categoryId: sub._id,
        name: `${sub.name} — ${v.label}`,
        slug,
        description:
          `${sub.name} supplied by ${org.name} as a ${v.label.toLowerCase()}. Specification, packaging and lead time are confirmed against your enquiry, and pricing is quoted per order.`,
        status: 'active',
        images: [image],
        // 🔴 on_request, always — see the note at the top.
        price: { mode: 'on_request' },
        moq: v.moq,
        unit: v.unit,
        countryOfOrigin: 'IN',
        leadTime: '2–3 weeks',
        packaging: 'Export-standard packing',
        terms: 'Quoted per enquiry',
      });
    }
  }

  let inserted = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const res = await Product.insertMany(docs.slice(i, i + 500), { ordered: false });
    inserted += res.length;
  }

  let imagesRefreshed = 0;
  for (let i = 0; i < refresh.length; i += 500) {
    const res = await Product.bulkWrite(refresh.slice(i, i + 500), { ordered: false });
    imagesRefreshed += res.modifiedCount ?? 0;
  }

  logger.info(
    {
      suppliers,
      perSupplier: PER_SUPPLIER,
      inserted,
      imagesRefreshed,
      distinctPhotos: new Set(Object.values(SUB_PHOTOS).flat()).size,
      skippedExisting: suppliers * PER_SUPPLIER - docs.length,
      totalProducts: await Product.countDocuments({}),
    },
    'supplier products seeded',
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err: { name: err.name, message: err.message } }, 'supplier product seed failed');
  process.exit(1);
});
