import { describe, it, expect } from 'vitest';

const { ROUTED_NOTICE, countryName, presentBody } = await import('../src/utils/messageText.js');
const { composeEnquiryMessage } = await import('../src/services/inquiry.service.js');

/**
 * Presentation of append-only chat text (owner, 2026-09-24): the "connected"
 * notice reads the same, neutral line to both parties, and enquiry messages
 * show a country NAME — for new messages (written that way) and old ones
 * (presented that way), since stored messages can never be edited.
 */
describe('chat text presentation', () => {
  it('country codes become names; anything else passes through', () => {
    expect(countryName('AU')).toBe('Australia');
    expect(countryName('AE')).toBe('United Arab Emirates');
    expect(countryName('Australia')).toBe('Australia');
    expect(countryName(undefined)).toBeUndefined();
  });

  it('a new enquiry message writes the country name', () => {
    const text = composeEnquiryMessage({ fields: { quantity: 3000, unit: 'metre', deliveryCountry: 'AU' }, note: 'Cotton twill' });
    expect(text).toContain('Delivery to: Australia');
    expect(text).not.toContain('Delivery to: AU');
  });

  it('an OLD stored message with a code is shown with the name — only on its own line', () => {
    expect(presentBody('Quantity: 3000\nDelivery to: AU\nCotton')).toBe('Quantity: 3000\nDelivery to: Australia\nCotton');
    expect(presentBody('We ship. Delivery to: AU is fine by us')).toBe('We ship. Delivery to: AU is fine by us');
  });

  it('every "connected by MPX Global" notice shows the neutral line, whatever was stored', () => {
    expect(presentBody('MPX Global connected you with this supplier at your request.', { systemKind: 'routed' })).toBe(ROUTED_NOTICE);
    expect(ROUTED_NOTICE).not.toMatch(/at your request|this supplier/);
  });
});
