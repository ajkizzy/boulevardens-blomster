# Design System: The Floral Editorial

## 1. Overview & Creative North Star
This design system is anchored by the Creative North Star: **"The Organic Curator."**

Moving away from the sterile, rigid grids of traditional e-commerce, this system adopts a high-end editorial lens. It treats the digital screen as a curated botanical gallery—blending Scandinavian functionalism with the tactile, imperfect beauty of nature. We break the "template" look through intentional asymmetry, where images may bleed off-center or overlap subtle background containers, and through a high-contrast typographic scale that values "breathing room" (white space) as a core functional element rather than just a stylistic choice.

## 2. Colors: The Tonal Landscape
The palette is a sophisticated dialogue between the botanical (`primary`: #526349) and the human (`secondary`: #755850).

### The "No-Line" Rule
To maintain a premium, seamless feel, **1px solid borders are strictly prohibited** for sectioning or container definition. Boundaries must be defined through background color shifts. For example, a `surface-container-low` section should sit directly against a `surface` background to create a "soft edge."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers, like stacked sheets of fine handmade paper.
- **Level 0 (Base):** `surface` (#fafaf5) – The canvas.
- **Level 1 (Sections):** `surface-container-low` (#f4f4ef) – Used for large content blocks.
- **Level 2 (Interactive):** `surface-container-lowest` (#ffffff) – Used for cards and input fields to provide a "lifted" feel.

### Glass & Gradient Transitions
For the hero section and primary CTAs, avoid flat fills. Use a subtle linear gradient transitioning from `primary` (#526349) to `primary-container` (#90a384) at a 135-degree angle. This provides a "velvet" texture. For navigation overlays, use a "Glassmorphism" effect: `surface` color at 80% opacity with a `20px` backdrop-blur to allow floral photography to bleed through softly.

## 3. Typography: The Editorial Voice
Our typography balances the authority of a heritage florist with the modern clarity of Danish design.

- **Display & Headlines (Noto Serif):** These are our "signature" moments. Use `display-lg` for hero statements with tight letter-spacing (-0.02em). The serif conveys the delicate veins of a leaf and the sophistication of the craft.
- **Body & Labels (Plus Jakarta Sans):** A clean, geometric sans-serif that ensures high legibility for product descriptions and ordering flows.
- **The Hierarchy:** Use `headline-sm` for service titles and `body-lg` for descriptions. Always ensure a minimum of `spacing-8` between a headline and its preceding content to maintain the editorial "air."

## 4. Elevation & Depth: Tonal Layering
We reject heavy drop shadows. Depth is achieved through "Tonal Layering."

### The Layering Principle
Instead of a shadow, place a `surface-container-lowest` (#ffffff) card on top of a `surface-container` (#eeeee9) background. The slight delta in hex value creates a sophisticated, natural lift.

### Ambient Shadows
If a floating element (like a language switcher dropdown) requires a shadow, use an **Ambient Shadow**:
- `box-shadow: 0 12px 40px rgba(26, 28, 25, 0.06);`
The shadow color is derived from `on-surface` (#1a1c19) at a very low opacity, mimicking natural sunlight filtered through a window.

### The "Ghost Border" Fallback
If accessibility requires a container edge, use a **Ghost Border**: `outline-variant` (#c4c8bd) at **15% opacity**. Never use 100% opaque borders.

## 5. Components

### Buttons: The Tactile Interaction
- **Primary:** Gradient fill (`primary` to `primary-container`), `on-primary` text, `rounded-md` (12px).
- **Secondary:** `surface-container-high` background with `primary` text. No border.
- **Language Switcher (DA | EN):** Text-based only. Use `label-md` in `on-surface-variant`. The active language should be `on-surface` with a 2px underline in `surface-tint`, spaced `0.35rem` (spacing-1) below the text.

### Cards: The Product Showcase
- **Container:** `surface-container-lowest` background, `rounded-lg` (16px).
- **Styling:** No dividers. Use `spacing-4` (1.4rem) of internal padding. Images should have a subtle `0.5rem` (rounded-sm) corner radius to feel softer than the container.

### Form Elements: The Ordering Flow
- **Input Fields:** `surface-container-low` background. On focus, the background transitions to `surface-container-lowest` with a "Ghost Border" in `primary`.
- **Labels:** Always use `label-md` positioned outside the input field for maximum clarity.

### Service Cards (Asymmetric Layout)
For "Wedding" or "Event" services, use a horizontal card format. The image should occupy 40% of the card, slightly overlapping the card's edge by `spacing-2` to break the "box" feel.

## 6. Do’s and Don'ts

### Do:
- **Use Intentional Asymmetry:** Let images of bouquets break out of their containers slightly.
- **Embrace White Space:** If a section feels crowded, double the spacing (e.g., move from `spacing-10` to `spacing-20`).
- **Nesting Surfaces:** Use `surface-container-highest` for small call-outs (like a "Seasonal" tag) to make them pop against `surface`.

### Don't:
- **Don't use 1px black or grey borders.** It kills the Scandinavian "softness."
- **Don't use pure black (#000000).** Use `on-surface` (#1a1c19) for all text to keep the contrast "warm."
- **Don't use sharp corners.** Everything must have at least a `rounded-sm` (8px) radius to mimic organic floral shapes.
- **Don't use standard dividers.** If you need to separate content, use a `spacing-12` vertical gap or a subtle background color shift.