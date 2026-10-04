# PIXEL PASS — Design System

## 1. Design Goal

Create a monochrome retro-game interface that feels like a fictional classic-console universe.

The visual language may evoke Mario-era platform games through composition, pixels, world navigation, blocks, platforms, coins, pipes, stars, and character-card presentation, but all artwork and branding must be original.

## 2. Color System

Base palette:

```text
INK        #111111
BLACK      #000000
DARK       #2A2A2A
MID        #666666
LIGHT      #B8B8B8
PAPER      #F2F2F2
WHITE      #FFFFFF
```

Optional extremely limited accent:

```text
ACCENT     #D9D9D9
```

Rule: the application must remain visually monochrome even if an accent is used for focus or interaction state.

## 3. Typography

Use a pixel/arcade-inspired display font for titles and a highly legible sans-serif or readable pixel font for body/UI.

Do not rely on an obscure commercial font that requires payment.

Use a free/open font or a strong system fallback.

## 4. Shape Language

Use:
- square corners
- stepped corners
- pixelated borders
- thick outlines
- hard shadows
- intentionally chunky controls

Avoid:
- glossy glassmorphism
- soft modern SaaS gradients
- excessive rounded cards
- generic dashboard UI

## 5. Card Design

The member card is the visual centerpiece.

Desktop target proportions:
- approximately 3:4 or credit-card-inspired proportions
- thick outer frame
- inner border
- strong hard shadow
- depth through stacked layers

Mobile:
- width should fit comfortably inside viewport
- preserve card readability
- allow adjacent cards to peek into frame

## 6. Card Front Composition

Order of visual priority:

1. photo
2. name
3. handle
4. role/identity line
5. links
6. QR code
7. decorative pixel motifs

## 7. Card Back Composition

Order of visual priority:

1. member summary
2. project inventory
3. selected skills
4. main portfolio action

## 8. Carousel

Desired visual model:

```text
    previous       CURRENT        next
       card          card          card
        \           [BIG]          /
         \________________________/
```

Current card:
- larger
- elevated
- sharper shadow
- full opacity

Side cards:
- smaller
- reduced opacity
- slightly rotated or translated
- still recognizable

## 9. Background

Use a fictional pixel landscape:
- repeating sky/screen texture
- clouds
- distant hills
- platforms
- floating blocks
- coins/stars

The background should remain subtle enough that the card stays dominant.

## 10. Motion

Use animations sparingly:
- card flip
- carousel snap
- hover lift
- button press
- modal entrance
- route transition

Default transition duration: about 200–400ms.

Respect prefers-reduced-motion.

## 11. Interaction Feedback

Buttons should feel tactile:
- hover raises 1–2px
- active state moves down 1–3px
- hard shadow changes
- focus uses a clear pixel-outline

## 12. Pixel Artwork Rules

Create simple original SVG/CSS pixel motifs where possible.

Do not download and ship Nintendo/Mario assets.
Do not trace official sprites.
Do not use official logos or sound effects.

## 13. Accessibility

- readable contrast
- focus states
- keyboard navigation
- aria labels
- button elements for actions
- alt text for profile/project images
- reduced motion support
- no information communicated by color alone
