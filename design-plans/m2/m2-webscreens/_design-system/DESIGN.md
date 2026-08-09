---
name: MPX Global Precision
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e5'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2ff'
  surface-container: '#eeedf9'
  surface-container-high: '#e8e7f3'
  surface-container-highest: '#e2e1ee'
  on-surface: '#1a1b24'
  on-surface-variant: '#444655'
  inverse-surface: '#2f3039'
  inverse-on-surface: '#f1effc'
  outline: '#747687'
  outline-variant: '#c4c5d8'
  surface-tint: '#2a4de0'
  primary: '#0032c3'
  on-primary: '#ffffff'
  primary-container: '#2a4de0'
  on-primary-container: '#d0d6ff'
  inverse-primary: '#b9c3ff'
  secondary: '#4e5f79'
  on-secondary: '#ffffff'
  secondary-container: '#cfe1ff'
  on-secondary-container: '#53647d'
  tertiary: '#00522c'
  on-tertiary: '#ffffff'
  tertiary-container: '#006d3c'
  on-tertiary-container: '#66f29e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dee1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#001158'
  on-primary-fixed-variant: '#0032c3'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#b6c8e5'
  on-secondary-fixed: '#091c32'
  on-secondary-fixed-variant: '#374860'
  tertiary-fixed: '#70fda7'
  tertiary-fixed-dim: '#51df8e'
  on-tertiary-fixed: '#00210e'
  on-tertiary-fixed-variant: '#00522c'
  background: '#fbf8ff'
  on-background: '#1a1b24'
  surface-variant: '#e2e1ee'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
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
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1200px
  card-padding: 40px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system for MPX Global is rooted in **Modern Corporate Minimalism**, emphasizing precision, high-contrast clarity, and an editorial layout common in high-tier B2B SaaS platforms. The brand personality is authoritative yet frictionless, aiming to evoke trust and efficiency for enterprise-level users. 

The aesthetic borrows from the "Linear" and "Stripe" schools of design: expansive whitespace, razor-sharp typography, and a deliberate use of color only to signal intent or action. The UI is architectural, relying on structural borders and a strict grid rather than excessive decorative elements. All text follows standard sentence case for "MPX Global" to maintain a grounded, professional tone.

## Colors
The palette is dominated by a high-contrast relationship between **Ink** (#000517) and **Card** (#FFFFFF) surfaces, set against a cool **Canvas** (#EAEEFF) backdrop. 

- **Primary Action:** The Cobalt Blue (#2A4DE0) is used exclusively for primary calls-to-action and critical interactive states.
- **Supportive Grays:** **Slate** and **Neutral** handle secondary information and metadata, ensuring hierarchy doesn't feel cluttered.
- **Semantic Feedback:** **Verified Green**, **Warning**, and **Danger** provide immediate status clarity.
- **Surface Strategy:** Use **Canvas** for the background of the page, and **Card** for the registration container to create a distinct floating effect.

## Typography
The system exclusively utilizes **Inter** to achieve a systematic, utilitarian aesthetic. 

- **Headlines:** Use tight letter-spacing (-0.01em to -0.02em) for headlines to create a dense, "editorial" feel. 
- **Wordmark:** MPX Global should be rendered in Inter SemiBold with standard sentence casing.
- **Body:** Body text uses a generous line height (1.5x) to ensure readability during the data-entry process.
- **Labels:** Use `label-sm` in all-caps for section headers or small metadata to provide visual variety without introducing a second typeface.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for the registration card to maintain focus.

- **The Registration Card:** Centered both vertically and horizontally on the desktop viewport. It should have a maximum width of 480px for a single-column form or 800px if using a split-pane editorial layout.
- **Rhythm:** An 8px base grid governs all spatial relationships. 
- **Margins:** Desktop views use 40px internal card padding to create an "airy" feel. On mobile, this reduces to 24px.
- **Breakpoints:** 
  - Mobile: < 768px (Single column, full-width margins).
  - Desktop: > 768px (Centered card, wide canvas).

## Elevation & Depth
Depth is achieved through **Low-contrast outlines** and subtle tonal shifts rather than heavy shadows.

- **Main Card:** Uses a 1px solid border (#C5C6CF) with a very soft, high-diffusion shadow (0px 4px 20px rgba(0, 5, 23, 0.05)) to separate it from the #EAEEFF canvas.
- **Interaction Depth:** Interactive elements like inputs do not use shadows; instead, they use a 2px Primary Blue focus ring when active.
- **Layers:** Use **Neutral tint** (#F2F4F7) for secondary background areas within a card (like a footer or a sidebar) to create a "recessed" look.

## Shapes
The shape language is a hybrid of structured containers and organic interactive elements.

- **Containers & Inputs:** All cards and form input fields use a consistent **8px (0.5rem)** corner radius. This provides a modern, professional look that isn't too sharp.
- **Buttons:** All buttons must be **fully rounded pills**. This creates a distinct visual contrast between "data entry" (square-ish) and "action" (rounded), making the primary path forward unmistakable.
- **Chips/Badges:** Small status indicators should use a 4px radius or be fully rounded to match buttons.

## Components
- **Primary Button:** Fully rounded pill. Background: #2A4DE0, Text: #FFFFFF. Hover state: #2340C4. Use `label-md` for text.
- **Input Fields:** 8px rounded. Border: 1px solid #C5C6CF. Focus: 2px solid #2A4DE0. Placeholder text: #667085.
- **Registration Card:** White background, 8px rounded corners, 1px border (#C5C6CF). Use internal padding of 40px for a premium feel.
- **Checkboxes:** 4px rounded (Soft). Border: #C5C6CF. Active state: #2A4DE0 with a white checkmark.
- **Secondary Actions:** Text-only or ghost buttons using Slate (#5A6B85) to ensure they do not compete with the primary registration button.
- **Validation States:** 
  - **Error:** Input border becomes #D92D20; assistive text is shown in Danger red.
  - **Success:** Use #12B76A for the "Verified" green icons or indicators.