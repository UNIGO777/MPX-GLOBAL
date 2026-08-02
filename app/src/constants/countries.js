/**
 * Countries for the signup pickers.
 *
 * `code` is ISO 3166-1 alpha-2 — the backend validator accepts exactly two
 * characters (`country: zString({ min: 2, max: 2 })`), so the code is what gets
 * submitted and the name is display only.
 *
 * `dial` is the E.164 calling code for the mobile field. India is first because
 * the exporter side of this marketplace is Indian; the rest are alphabetical.
 *
 * This is a trimmed working list, not the full ISO table — it covers India plus
 * the trade corridors the platform targets. Adding a country is a one-line
 * change here; nothing else needs to know.
 */
export const COUNTRIES = [
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'BD', name: 'Bangladesh', dial: '+880' },
  { code: 'BR', name: 'Brazil', dial: '+55' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'CN', name: 'China', dial: '+86' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'EG', name: 'Egypt', dial: '+20' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'ID', name: 'Indonesia', dial: '+62' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'KR', name: 'South Korea', dial: '+82' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94' },
  { code: 'MY', name: 'Malaysia', dial: '+60' },
  { code: 'NG', name: 'Nigeria', dial: '+234' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'NP', name: 'Nepal', dial: '+977' },
  { code: 'NZ', name: 'New Zealand', dial: '+64' },
  { code: 'OM', name: 'Oman', dial: '+968' },
  { code: 'PH', name: 'Philippines', dial: '+63' },
  { code: 'PK', name: 'Pakistan', dial: '+92' },
  { code: 'PL', name: 'Poland', dial: '+48' },
  { code: 'QA', name: 'Qatar', dial: '+974' },
  { code: 'RU', name: 'Russia', dial: '+7' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'TH', name: 'Thailand', dial: '+66' },
  { code: 'TR', name: 'Turkey', dial: '+90' },
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'VN', name: 'Vietnam', dial: '+84' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountry(code) {
  return COUNTRIES.find((c) => c.code === code) ?? null;
}
