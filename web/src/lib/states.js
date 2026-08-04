/**
 * States / provinces for the countries where we can offer a real list.
 *
 * Deliberately NOT a world dataset. The address form falls back to a free-text
 * field for any country not listed, which is also what the server expects —
 * `address.state` is an unconstrained string (auth.validators.js), so a country
 * missing from this map costs nothing but the dropdown.
 *
 * India is listed first because it is every exporter's country; the Gulf
 * entries cover the buyer side we see most.
 */
export const STATES_BY_COUNTRY = {
  IN: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
    'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ],
  AE: ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'],
  SA: ['Al Bahah', 'Al Jawf', 'Al Madinah', 'Al Qassim', 'Asir', 'Eastern Province', 'Hail', 'Jazan', 'Makkah', 'Najran', 'Northern Borders', 'Riyadh', 'Tabuk'],
  US: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
    'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
    'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  ],
};

/** The list for a country, or null when we should fall back to free text. */
export function statesFor(countryCode) {
  return STATES_BY_COUNTRY[countryCode] ?? null;
}
