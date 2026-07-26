import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Ownership scoping (decisions B1, B4). Every model declares HOW it is scoped;
 * the ownership helper refuses to build a filter for a model that hasn't — a
 * forgotten declaration fails loudly instead of leaking data unscoped (the same
 * default-deny philosophy as route permissions).
 *
 *   PARTIES  — two-party deal documents. Scoped by an indexed `parties` array
 *              holding [buyerOrgId, exporterOrgId]. One clean single-field query
 *              (`{ parties: myOrgId }`) instead of a repeated $or.
 *   ORG      — single-tenant documents owned by one org (`{ orgId: myOrgId }`).
 *   USER     — documents owned by one user (`{ userId: myUserId }`).
 *   SELF     — the Organisation record itself (`{ _id: myOrgId }`).
 *   PLATFORM — not org-scoped; gated by permission only (returns no org filter).
 */
export const SCOPE = Object.freeze({
  PARTIES: 'parties',
  ORG: 'org',
  USER: 'user',
  SELF: 'self',
  PLATFORM: 'platform',
});

export function declareScope(schema, type) {
  if (!Object.values(SCOPE).includes(type)) {
    throw new Error(`declareScope: unknown scope type "${type}"`);
  }
  schema.$scope = type;
}

// Returns the ownership fragment for a model, or throws if the model never
// declared a scope. Compose with an id via scopedFilter().
export function ownershipFilter(model, user) {
  const scope = model?.schema?.$scope;
  if (!scope) {
    throw new Error(
      `Ownership scope not declared for model "${model?.modelName ?? 'unknown'}" — refusing to build an unscoped query`,
    );
  }
  switch (scope) {
    case SCOPE.PARTIES:
      return { parties: user.orgId };
    case SCOPE.ORG:
      return { orgId: user.orgId };
    case SCOPE.USER:
      return { userId: user._id ?? user.id };
    case SCOPE.SELF:
      return { _id: user.orgId };
    case SCOPE.PLATFORM:
      return {};
    default:
      throw new Error(`Unknown ownership scope "${scope}" for model "${model.modelName}"`);
  }
}

export function scopedFilter(model, id, user) {
  return { _id: id, ...ownershipFilter(model, user) };
}

const orgRef = () => ({ type: Schema.Types.ObjectId, ref: 'Organisation' });

// --- Field mixins for the skeleton models -------------------------------------

export function withPartiesScope(schema) {
  schema.add({
    buyerOrgId: { ...orgRef(), required: true, index: true },
    exporterOrgId: { ...orgRef(), required: true, index: true },
    parties: { type: [Schema.Types.ObjectId], ref: 'Organisation', required: true, index: true },
    isActive: { type: Boolean, default: true },
  });
  // Keep `parties` derived from the two party orgs so scoping can never disagree
  // with role-specific logic. Runs before validation, so `required` is satisfied.
  schema.pre('validate', function syncParties() {
    if (this.buyerOrgId && this.exporterOrgId) {
      this.parties = [this.buyerOrgId, this.exporterOrgId];
    }
  });
  declareScope(schema, SCOPE.PARTIES);
}

export function withOrgScope(schema) {
  schema.add({
    orgId: { ...orgRef(), required: true, index: true },
    isActive: { type: Boolean, default: true },
  });
  declareScope(schema, SCOPE.ORG);
}

export function withPlatformScope(schema) {
  schema.add({ isActive: { type: Boolean, default: true } });
  declareScope(schema, SCOPE.PLATFORM);
}
