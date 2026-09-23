/**
 * Standard trade units for the product form's Unit picker (owner, 2026-09-24).
 * `value` is what is stored and shown after a price ("₹120 / meter"), so it is
 * the singular, lower-case word; `label` is what the seller sees in the list.
 * Sellers may still type a unit that isn't here — the list is a strong default,
 * not a rule (the server keeps `unit` as free text ≤40 characters).
 *
 * The dev data this replaced had one unit spelled five ways ("meter", "meters",
 * "Meter", "Pieces", "Pieace") — a list is what makes them one.
 */
export const TRADE_UNITS = [
  { value: 'piece', label: 'Piece', hint: 'pcs' },
  { value: 'unit', label: 'Unit', hint: 'nos' },
  { value: 'pair', label: 'Pair' },
  { value: 'set', label: 'Set' },
  { value: 'dozen', label: 'Dozen', hint: '12' },
  { value: 'kg', label: 'Kilogram', hint: 'kg' },
  { value: 'gram', label: 'Gram', hint: 'g' },
  { value: 'metric ton', label: 'Metric ton', hint: 't' },
  { value: 'quintal', label: 'Quintal', hint: '100 kg' },
  { value: 'meter', label: 'Meter', hint: 'm' },
  { value: 'yard', label: 'Yard', hint: 'yd' },
  { value: 'foot', label: 'Foot', hint: 'ft' },
  { value: 'square meter', label: 'Square meter', hint: 'm²' },
  { value: 'square foot', label: 'Square foot', hint: 'ft²' },
  { value: 'cubic meter', label: 'Cubic meter', hint: 'm³' },
  { value: 'liter', label: 'Liter', hint: 'L' },
  { value: 'box', label: 'Box' },
  { value: 'carton', label: 'Carton' },
  { value: 'pack', label: 'Pack' },
  { value: 'bag', label: 'Bag' },
  { value: 'roll', label: 'Roll' },
  { value: 'bale', label: 'Bale' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'drum', label: 'Drum' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'container', label: 'Container', hint: '20/40 ft' },
];
