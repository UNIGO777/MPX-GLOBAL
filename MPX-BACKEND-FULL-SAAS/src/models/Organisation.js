import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { ORG_TYPE, KYC_STATUS } from './enums.js';

const { Schema } = mongoose;

// The tenant root — its _id IS the orgId every other business document
// references, so it carries no orgId of its own (documented exception to the
// orgId convention).
const organisationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // A5: intentionally NOT unique

    type: { type: String, enum: ORG_TYPE, required: true, index: true },

    // A6: ISO 3166-1 alpha-2 code (IN, AE, AU) — never a display name.
    country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    },

    website: { type: String, trim: true },
    description: { type: String, trim: true },
    logo: { type: String, trim: true },

    businessProfile: {
      registrationNumber: { type: String, trim: true },
      taxId: { type: String, trim: true },
      establishedYear: { type: Number },
    },

    // Used later for contract signing — captured now so relations don't change.
    authorisedSignatory: {
      name: { type: String, trim: true },
      designation: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      mobile: {
        countryCode: { type: String, trim: true },
        number: { type: String, trim: true },
        e164: { type: String, trim: true },
      },
    },

    kycStatus: { type: String, enum: KYC_STATUS, default: 'pending', index: true },
    // A7 (tracker E3): select:false so no list endpoint accidentally returns KYC
    // document URLs. Documents are served via a permissioned endpoint that mints
    // signed, expiring Cloudinary URLs — public URLs are never stored here.
    kycDocuments: {
      type: [
        {
          type: { type: String, trim: true },
          url: { type: String, trim: true },
          uploadedAt: { type: Date },
          verifiedAt: { type: Date },
          verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        },
      ],
      select: false,
      default: [],
    },

    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    // Set when an employee rejects verification (kycStatus 'rejected'). Internal —
    // not exposed on public listings.
    kycRejectionReason: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

// A5: uniqueness only when a registration number exists, and it's (number,
// country) — enforced at verification time, not signup. Partial index so orgs
// without a registration number are unconstrained.
organisationSchema.index(
  { 'businessProfile.registrationNumber': 1, country: 1 },
  {
    unique: true,
    partialFilterExpression: { 'businessProfile.registrationNumber': { $type: 'string' } },
  },
);

declareScope(organisationSchema, SCOPE.SELF);

export const Organisation = mongoose.model('Organisation', organisationSchema);
