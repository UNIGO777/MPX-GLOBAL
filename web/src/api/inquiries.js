import { apiClient } from './client.js';

/**
 * M4-B — enquiry creation. The single door into the whole chat module: there
 * are no product-less enquiries (M4-4), and only a BUYER account can open one.
 *
 *   POST /inquiries { productId, note, fields } → { conversationId, inquiry }
 *
 * Status carries meaning and both are success:
 *   201  a new thread was created
 *   200  a thread already existed — a second enquiry never opens a second one
 *        (M4-5), so this is the normal answer to a duplicate, not an error.
 *
 * The caller only ever needs `conversationId`, which is the same in both cases.
 *
 * Field sets follow the sub-category's `type` and are validated server-side.
 * UNKNOWN KEYS ARE REJECTED, not stripped — send exactly the set for the leaf's
 * type, or the whole enquiry 400s.
 */
export const GOODS_FIELDS = Object.freeze([
  'quantity',
  'unit',
  'targetPrice',
  'currency',
  'deliveryCountry',
  'deliveryTimeline',
]);

export const SERVICE_FIELDS = Object.freeze([
  'engagementType',
  'budget',
  'currency',
  'timeline',
  'deliveryModel',
]);

export function fieldsForType(categoryType) {
  return categoryType === 'service' ? SERVICE_FIELDS : GOODS_FIELDS;
}

/**
 * Drop anything the buyer left blank. The server stores `fields` verbatim into a
 * Mixed path, so an empty string would be saved and then rendered as
 * "Quantity: " in the thread's first message.
 */
function compactFields(fields, categoryType) {
  const allowed = fieldsForType(categoryType);
  return Object.fromEntries(
    Object.entries(fields ?? {}).filter(
      ([key, value]) => allowed.includes(key) && value !== '' && value !== null && value !== undefined,
    ),
  );
}

export const inquiriesApi = {
  /**
   * Returns the conversation id to open. `note` is the only required field and
   * the only free text (1–200 chars); every structured field is optional,
   * except that an amount without a currency is refused.
   */
  create: async ({ productId, note, fields, categoryType }) => {
    const payload = { productId, note };
    const compacted = compactFields(fields, categoryType);
    if (Object.keys(compacted).length > 0) payload.fields = compacted;

    const { data } = await apiClient.post('/inquiries', payload);
    return data.conversationId;
  },
};
