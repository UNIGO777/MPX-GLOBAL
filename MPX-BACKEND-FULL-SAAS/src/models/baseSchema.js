/**
 * MODEL CONVENTIONS — read before adding any schema. Every model reuses
 * `baseSchemaOptions` below so these hold uniformly.
 *
 * 1. TIMESTAMPS on every schema.
 *    `baseSchemaOptions` sets `timestamps: true` (createdAt / updatedAt). Do not
 *    disable it on a model.
 *
 * 2. orgId ON EVERY BUSINESS DOCUMENT, INDEXED.
 *    Every tenant-scoped model declares:
 *      orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true, index: true }
 *    Every read and write scopes by it — findOne({ _id, orgId }), never
 *    findById(_id). A record the caller's org does not own returns 404, never
 *    403 (a 403 would confirm the record exists). The only exception is a
 *    genuinely global collection (e.g. system config); such a model must say so
 *    in a comment at its declaration.
 *
 * 3. SOFT DELETE via `isActive`, not hard delete.
 *    Business models declare `isActive: { type: Boolean, default: true }`.
 *    "Deleting" sets isActive=false; normal reads filter { isActive: true }.
 *    Hard deletes are forbidden except where explicitly noted (e.g. short-lived
 *    OTP / session records that are meant to expire). Audit and approval
 *    collections are append-only: never updated, never deleted.
 *
 * 4. NO toJSON LEAKING OF SENSITIVE FIELDS.
 *    Mark every sensitive field `select: false` (tokens, secrets, password
 *    hashes, OTP material, bank numbers, IFSC, PAN, Aadhaar, KYC). That keeps
 *    them out of query results by default; the shared toJSON transform below is
 *    the second line of defence — it strips `__v` and any `select: false` path
 *    from serialized output even if the field was explicitly loaded with
 *    `.select('+field')`.
 */

// Remove a possibly-dotted path from a plain object produced by toJSON.
function deleteAtPath(target, path) {
  if (target == null || typeof target !== 'object') return;
  const dot = path.indexOf('.');
  if (dot === -1) {
    delete target[path];
    return;
  }
  deleteAtPath(target[path.slice(0, dot)], path.slice(dot + 1));
}

function stripSensitive(doc, ret) {
  // eachPath exposes every declared path and its options; drop the ones the
  // schema marked select:false.
  doc?.schema?.eachPath?.((pathname, schemaType) => {
    if (schemaType?.options?.select === false) {
      deleteAtPath(ret, pathname);
    }
  });
  delete ret.__v; // redundant with versionKey:false, kept explicit as a guarantee
  return ret;
}

/**
 * Options object every schema spreads in:
 *   const schema = new mongoose.Schema({ ... }, baseSchemaOptions);
 */
export const baseSchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: stripSensitive,
  },
  toObject: {
    virtuals: true,
    versionKey: false,
  },
};
