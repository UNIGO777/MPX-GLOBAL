---
name: Executive Trade Narrative
colors:
  surface: '#16130f'
  surface-dim: '#16130f'
  surface-bright: '#3c3933'
  surface-container-lowest: '#100e0a'
  surface-container-low: '#1e1b17'
  surface-container: '#221f1b'
  surface-container-high: '#2d2a25'
  surface-container-highest: '#38342f'
  on-surface: '#e9e1da'
  on-surface-variant: '#d0c5b5'
  inverse-surface: '#e9e1da'
  inverse-on-surface: '#33302b'
  outline: '#998f81'
  outline-variant: '#4d463a'
  surface-tint: '#e3c281'
  primary: '#e5c483'
  on-primary: '#402d00'
  primary-container: '#c8a96a'
  on-primary-container: '#533d07'
  inverse-primary: '#735b24'
  secondary: '#ffb4a8'
  on-secondary: '#690000'
  secondary-container: '#e60000'
  on-secondary-container: '#fff6f5'
  tertiary: '#bac7f5'
  on-tertiary: '#222f54'
  tertiary-container: '#9facd8'
  on-tertiary-container: '#334065'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9f'
  primary-fixed-dim: '#e3c281'
  on-primary-fixed: '#261a00'
  on-primary-fixed-variant: '#5a430e'
  secondary-fixed: '#ffdad4'
  secondary-fixed-dim: '#ffb4a8'
  on-secondary-fixed: '#410000'
  on-secondary-fixed-variant: '#930100'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b8c5f2'
  on-tertiary-fixed: '#0b1a3d'
  on-tertiary-fixed-variant: '#38456b'
  background: '#16130f'
  on-background: '#e9e1da'
  surface-variant: '#38342f'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 84px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  eyebrow:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.15em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  grid-columns: '12'
  gutter: 32px
  margin-desktop: 80px
  margin-mobile: 24px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 64px
---

## Brand & Style

This design system embodies the "Luxury Global-Trade House"—a sophisticated intersection of editorial elegance and industrial authority. It is designed for high-stakes B2B commerce where trust is the primary currency.

The aesthetic blends **Minimalism** with **High-Contrast Dark Mode** to create a focused, prestigious environment. Large-scale typography, generous negative space, and a refined "dark rhythm" define the experience. The UI evokes the atmosphere of a private banking suite or a high-end logistics terminal at dusk—efficient, expensive, and powerful.

## Colors

The palette is anchored in **Midnight Navy** (#0B1F3A), providing a deep, intellectual foundation for the interface. **Charcoal** (#232323) acts as a secondary surface color to differentiate content blocks and create a rhythmic flow down the page.

**Champagne Gold** (#C8A96A) is the primary functional and decorative accent, used for interactive elements, highlights, and status indicators. **Vodafone Red** (#E60000) is used sparingly as "punctuation"—drawing the eye to critical CTAs or marking the end of a powerful statement. Text and fine details are rendered in **Ivory White** (#F8F7F3) to ensure high legibility against the dark backgrounds while maintaining a softer, more premium feel than pure white.

## Typography

The typography system relies on the contrast between the high-stroke variance of **Playfair Display** and the utilitarian precision of **Inter**.

**Headlines:** Always use Playfair Display. For primary headers, select one key word to be highlighted in Champagne Gold. Every major headline should terminate with a small Red full-stop dot to signify finality and confidence.

**Section Eyebrows:** Use Inter in Uppercase with 15% letter spacing, colored in Champagne Gold, to categorize sections.

**Body & UI:** Inter is used for all functional text, data, and body copy. Maintain generous line-heights (1.5x minimum) to ensure an editorial, breathable feel.

## Layout & Spacing

This design system utilizes a **Fixed Grid** model for desktop to maintain a cinematic, controlled composition. A 12-column grid with wide 32px gutters creates a sturdy framework for complex logistics data.

**Vertical Rhythm:** Use large vertical spacing (64px+) between sections to emphasize the "luxury" aspect of the brand—space suggests exclusivity. 
**Mobile Adaptation:** On mobile, margins shrink to 24px and the 12-column grid collapses to a single-column stack. Headlines should scale down significantly using the `-mobile` variants to prevent excessive wrapping.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** rather than heavy shadows. 
- **Level 0 (Base):** Midnight Navy (#0B1F3A).
- **Level 1 (Cards/Containers):** Charcoal (#232323) with a 1px hairline border in Champagne Gold at 30% opacity.
- **Overlays:** Use subtle ambient shadows (Black, 40% opacity, 20px blur) only on floating elements like dropdowns or modals to lift them off the dark base.

Use backdrop blurs on navigation bars to allow the "glowing" map imagery to peek through as the user scrolls, creating a sense of environmental depth.

## Shapes

The shape language is "Tailored"—meaning it is precise and clean, avoiding overly bubbly or aggressive sharp corners. 

Standard components (Buttons, Inputs) use an **8px radius**. Larger containers like Cards use a **12px radius** to feel slightly more approachable. The use of hairline borders (1px) in Gold is the primary way to define shape boundaries within the dark UI.

## Components

**Buttons:**
- **Primary:** Champagne Gold fill with Midnight Navy text. Include a small right-facing chevron icon. Shape is slightly squared (8px).
- **Secondary:** Transparent fill with a 1px Red outline and Red text. Used for high-priority secondary actions.

**Cards:**
Constructed with Charcoal backgrounds. They feature a 1px Champagne Gold hairline border and a 12px corner radius. Content should have 32px of internal padding.

**Icons & Badges:**
- **Icons:** 1.5pt stroke weight, Gold line icons. Never filled.
- **Verified Badge:** A specific Champagne Gold tick icon, used to validate "Trade Houses" and "Verified Suppliers."

**Inputs:**
Dark background (Midnight Navy), 1px Gold border (inactive at 20% opacity, active at 100%), with Ivory White labels positioned above the field in Inter (Label-md).

**Imagery:**
Photographic assets must be high-contrast and desaturated. Overlay a dark navy gradient on images of ports, ships, and warehouses to ensure text legibility. Use "Glowing Gold" vector lines for global connection maps to emphasize the network's reach.