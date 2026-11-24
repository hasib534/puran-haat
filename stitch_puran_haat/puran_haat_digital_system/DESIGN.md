---
name: EcoTrade Digital System
colors:
  surface: '#fdfae7'
  surface-dim: '#dddbc8'
  surface-bright: '#fdfae7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f4e1'
  surface-container: '#f1eedb'
  surface-container-high: '#ece9d6'
  surface-container-highest: '#e6e3d0'
  on-surface: '#1c1c11'
  on-surface-variant: '#42493e'
  inverse-surface: '#313124'
  inverse-on-surface: '#f4f1de'
  outline: '#72796e'
  outline-variant: '#c2c9bb'
  surface-tint: '#3b6934'
  primary: '#154212'
  on-primary: '#ffffff'
  primary-container: '#2d5a27'
  on-primary-container: '#9dd090'
  inverse-primary: '#a1d494'
  secondary: '#556158'
  on-secondary: '#ffffff'
  secondary-container: '#d9e6da'
  on-secondary-container: '#5b675e'
  tertiary: '#6a210d'
  on-tertiary: '#ffffff'
  tertiary-container: '#883721'
  on-tertiary-container: '#ffb09b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bcf0ae'
  primary-fixed-dim: '#a1d494'
  on-primary-fixed: '#002201'
  on-primary-fixed-variant: '#23501e'
  secondary-fixed: '#d9e6da'
  secondary-fixed-dim: '#bdcabe'
  on-secondary-fixed: '#131e17'
  on-secondary-fixed-variant: '#3e4a41'
  tertiary-fixed: '#ffdbd2'
  tertiary-fixed-dim: '#ffb4a1'
  on-tertiary-fixed: '#3c0800'
  on-tertiary-fixed-variant: '#7c2e19'
  background: '#fdfae7'
  on-background: '#1c1c11'
  surface-variant: '#e6e3d0'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  display-lg-mobile:
    fontFamily: Outfit
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
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
  lg: 32px
  xl: 48px
  gutter: 16px
  margin: 20px
---

## Brand & Style

The design system is built on a philosophy of "Sustainable Modernism." It balances the organic, community-driven nature of a local exchange with the precision and reliability of a modern marketplace. The aesthetic is clean and spacious, prioritizing clarity to foster trust between neighbors.

The visual style leverages **Minimalism** with a **Tactile** edge. It uses heavy whitespace to reduce cognitive load and emphasizes "human" touches—soft shadows and organic curves—that make digital interactions feel as approachable as a face-to-face handoff. The emotional goal is to evoke a sense of calm, responsibility, and neighborly warmth.

## Colors

The palette is derived from natural landscapes to reinforce the sustainability narrative. 

- **Primary (Forest Green):** Used for core branding, primary buttons, and high-level navigation. It signifies growth and stability.
- **Secondary (Soft Mint):** A background and container color used to differentiate sections without adding visual noise.
- **Tertiary (Terracotta):** The "Action" color. Reserved strictly for primary call-to-actions (CTAs), notifications, and interactive highlights to provide high-contrast guidance.
- **Neutral (Parchment):** Used for the main app background instead of pure white to reduce eye strain and provide a warmer, more tactile feel.
- **Status Colors:** Use a desaturated Sage for success and a muted Clay for errors to maintain the earthy aesthetic.

## Typography

This design system utilizes **Outfit** for all typographic roles. Its geometric yet friendly construction aligns perfectly with the modern-eco brand personality.

- **Headlines:** Use Bold and Semi-Bold weights with slight negative letter-spacing to create a confident, editorial look.
- **Body Text:** Use Regular weight with generous line height (1.5x) to ensure maximum readability during long browsing sessions.
- **Labels:** Use All-Caps with increased letter-spacing for category tags and small metadata to ensure they remain distinct from body copy.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile-first consumption. 

- **Grid:** A 4-column grid for mobile and 8-column for tablet. 
- **Rhythm:** All spacing must be a multiple of the 4px base unit. 
- **Margins:** 20px side margins provide a generous "breathing room" that separates the content from the device edge, reinforcing the premium, clean feel.
- **Vertical Spacing:** Use `md` (24px) spacing between distinct content blocks and `sm` (16px) for elements within a single block.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows** rather than harsh lines.

- **Surface Levels:** The base layer is the Neutral (Parchment). Elevated cards use a pure White background to pop forward.
- **Shadows:** Use extremely soft, blurred shadows with a slight tint of the Primary color (Forest Green) at low opacity (5-8%). This prevents the UI from feeling "gray" or "muddy."
- **Depth Levels:** 
  - Level 0: Background.
  - Level 1: Standard Cards (Static content).
  - Level 2: Interactive elements and floating buttons (High diffusion).

## Shapes

The shape language is defined by "Organic Geometry." Every corner is rounded to remove the "sharpness" of technology, making the app feel safer and more community-oriented.

- **Standard Elements:** Buttons, input fields, and small cards use a 0.5rem (8px) radius.
- **Featured Elements:** Large image containers and primary product cards use a 1rem (16px) radius.
- **Specialty Shapes:** Search bars and specific filter chips may use "Full Rounding" (Pill-shaped) to distinguish them as highly interactive, utility-based components.

## Components

- **Buttons:** Primary buttons use the Tertiary (Terracotta) color with white text for maximum visibility. Secondary buttons use an outline of the Primary color.
- **Cards:** Product cards should feature a large image at the top with a 16px radius. Text content below should be padded by 16px. Use a subtle Level 1 shadow.
- **Input Fields:** Use a light Secondary (Mint) fill instead of a white background to make the fields feel "recessed" and ready for input.
- **Chips:** Used for categories (e.g., "Kitchen," "Garden"). These should be pill-shaped with a light tint of the Primary green and dark green text.
- **Impact Tracker:** A custom component unique to this system—a progress bar or circular graphic using the Primary green to show the "Carbon Saved" or "Items Diverted from Landfill" by the user.
- **Lists:** Use dividers with very low opacity (10% Primary color) and include a 16px horizontal gap to maintain whitespace.