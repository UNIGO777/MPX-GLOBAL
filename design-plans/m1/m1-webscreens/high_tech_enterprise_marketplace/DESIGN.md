---
name: High-Tech Enterprise Marketplace
colors:
  surface: '#fbf8fc'
  surface-dim: '#dbd9dd'
  surface-bright: '#fbf8fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f6'
  surface-container: '#efedf0'
  surface-container-high: '#e9e7eb'
  surface-container-highest: '#e4e2e5'
  on-surface: '#1b1b1e'
  on-surface-variant: '#44474e'
  inverse-surface: '#303033'
  inverse-on-surface: '#f2f0f3'
  outline: '#75777f'
  outline-variant: '#c5c6cf'
  surface-tint: '#4d5e83'
  primary: '#000517'
  on-primary: '#ffffff'
  primary-container: '#0a1e3f'
  on-primary-container: '#7586ad'
  inverse-primary: '#b5c6f0'
  secondary: '#435d96'
  on-secondary: '#ffffff'
  secondary-container: '#a4bdfd'
  on-secondary-container: '#314b83'
  tertiary: '#0e0300'
  on-tertiary: '#ffffff'
  tertiary-container: '#351600'
  on-tertiary-container: '#ae7b59'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#b5c6f0'
  on-primary-fixed: '#061b3c'
  on-primary-fixed-variant: '#35466a'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#afc6ff'
  on-secondary-fixed: '#001944'
  on-secondary-fixed-variant: '#2a457d'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#f5ba93'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#653d20'
  background: '#fbf8fc'
  on-background: '#1b1b1e'
  surface-variant: '#e4e2e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.01em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style
This design system is engineered for a high-stakes B2B environment where confidence, efficiency, and scale are paramount. The aesthetic merges **Corporate Modernism** with **High-Tech Precision**, creating an interface that feels both institutional and cutting-edge. 

The visual language emphasizes transparency and reliability through expansive whitespace, crisp geometric shapes, and a sophisticated navy-dominant palette. The target audience—logistics managers, global trade directors, and enterprise buyers—requires a UI that minimizes cognitive load while providing dense data visualization capabilities. The emotional response is one of "total control": a calm, organized, and powerful command center for global trade.

## Colors
The palette is built on a foundation of "Navy Logic." **Deep Navy (#0A1E3F)** and **Ink (#0B1220)** provide the structural weight and authority necessary for enterprise software, while **Royal Navy (#16346B)** is reserved for interactive surfaces and headers to provide depth.

**Bright Accent Blue (#2F6BFF)** acts as the "Energy Accent," drawing the eye to primary actions and progress indicators. Backgrounds utilize **Soft Blue Tint (#EDF2FB)** to reduce eye strain compared to pure white, while **Cloud White (#FFFFFF)** is used strictly for cards and elevated sections to create a clear content hierarchy. The **Pastel Tints** are used for categorical tagging and subtle background fills in complex data tables, ensuring the UI remains light and navigable.

## Typography
The system relies exclusively on **Inter** to maintain a systematic, utilitarian, and neutral tone. To achieve the "high-tech" look, headlines utilize tight tracking (letter-spacing) and bold weights, creating a sense of density and impact. 

Large displays and headers should always be set with reduced line height to maintain a cohesive block-like appearance. Body text is prioritized for legibility with generous line heights, ensuring that long-form data or terms of service remain readable. Data labels and buttons use a semi-bold weight to stand out against monochromatic backgrounds.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop (12 columns, 1440px max-width) to ensure a controlled, "dashboard" feel. On mobile, the system transitions to a fluid 4-column layout. 

Spacing is governed by an 8pt linear scale, though a 4px "half-step" is permitted for tight UI clusters like icon-and-text pairs. The "Spacious" feel is achieved through significant vertical padding (`lg` and `xl`) between major sections, while functional components (cards) use `md` (24px) internal padding to maintain a professional density.

## Elevation & Depth
Depth is created through **Tonal Layering** rather than heavy shadows. The primary background is the softest layer, with Cloud White cards sitting one level above. 

Where shadows are necessary (e.g., hovering over a marketplace listing or a modal), they must be **Ambient Shadows**: extremely diffused (20px-40px blur), low opacity (8-12%), and tinted with the primary Deep Navy color to avoid a "dirty" grey look. Subtle navy-to-transparent gradients are used on hero sections and showcasing areas to provide a high-tech, cinematic luster without compromising content clarity.

## Shapes
The shape language is "Modern Semi-Round." Most containers, cards, and input fields utilize a **12px to 16px corner radius** (Level 2), which softens the authoritative nature of the navy palette. 

However, specialized components like Buttons and Tags utilize a **Pill-shape** (fully rounded) to maximize their "interactive" affordance and provide a clear visual distinction from static content containers. This contrast between the structured 16px cards and the fluid pill buttons is a signature element of this design system.

## Components
- **Buttons:** Primary buttons are pill-shaped, using the Bright Accent Blue background with white text. Secondary buttons use a Deep Navy outline with a soft tint hover state.
- **Input Fields:** Use a Cloud White background with a 1px Pale Slate border. On focus, the border transitions to Bright Accent Blue with a subtle 2px glow.
- **Cards:** Defined by a 16px corner radius, a subtle 1px Pale Slate border, and a Cloud White fill. No shadow in the default state; "Soft Shadow" on hover.
- **Chips/Status:** Use the Pastel Tints for backgrounds (e.g., Pale Mint for "Verified") with high-contrast text (Verified Green).
- **Lists/Data Tables:** Use alternating row fills with Pale Slate at 30% opacity. Headers should be Deep Navy with white text for maximum hierarchy.
- **Navigation:** A vertical sidebar in Deep Navy with "active" states indicated by a Bright Accent Blue vertical bar on the left and a subtle Navy gradient fill.