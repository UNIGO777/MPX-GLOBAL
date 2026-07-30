import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { ATTR_INPUT_TYPE } from './enums.js';

const { Schema } = mongoose;

// Per-(sub-)category product-form fields as DATA (no per-category schemas): the
// admin defines them, the product form renders from them, and M3 filters on
// `filterable` ones. Belongs to a LEAF category only (enforced at the endpoint —
// a top has no product form).
const categoryAttributeSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    // Display label — freely editable.
    name: { type: String, required: true, trim: true },

    // Stable machine key ("gsm"). IMMUTABLE after create (enforced at the
    // endpoint): products store { key, value } snapshots, so a key rename would
    // orphan every existing value. Rename the display `name` instead.
    key: { type: String, required: true, trim: true, lowercase: true },

    // Decides the form control AND the value type stored on
    // Product.attributes[].value. IMMUTABLE after create (a number→select flip
    // would corrupt already-stored typed values).
    inputType: { type: String, enum: ATTR_INPUT_TYPE, required: true },

    // select-only: the allowed values. Validator below keeps non-select rows
    // clean so a later inputType read never meets stray options.
    options: { type: [String], default: [] },

    unit: { type: String, trim: true }, // optional display unit ("gsm", "kg", "%")
    required: { type: Boolean, default: false }, // enforced at PUBLISH, not draft
    filterable: { type: Boolean, default: false }, // surfaces as an M3 facet
    order: { type: Number, default: 0 },
  },
  baseSchemaOptions,
);

// One key per category — the product form and the M3 facets key on it.
categoryAttributeSchema.index({ categoryId: 1, key: 1 }, { unique: true });

categoryAttributeSchema.pre('validate', function optionsMatchInputType() {
  if (this.inputType === 'select') {
    if (!this.options || this.options.length === 0) {
      throw new Error('CategoryAttribute: a select attribute needs at least one option');
    }
  } else if (this.options && this.options.length > 0) {
    throw new Error('CategoryAttribute: options are only valid on a select attribute');
  }
});

declareScope(categoryAttributeSchema, SCOPE.PLATFORM);

export const CategoryAttribute = mongoose.model('CategoryAttribute', categoryAttributeSchema);
