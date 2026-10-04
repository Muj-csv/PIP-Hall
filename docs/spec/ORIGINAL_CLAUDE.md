# PIXEL PASS — Claude Build Instructions

## Project Identity

Build a polished progressive web app called **PIXEL PASS** (working title) that presents organization members as collectible, interactive profile cards.

The product should feel like a lovingly recreated **retro console/game universe** inspired by the visual language of classic Nintendo-era platform games and Mario-style game menus, but it must use **original branding, original pixel art, original icons, original UI copy, and no Nintendo/Mario trademarks, logos, sprites, sounds, or proprietary assets**.

Do not describe the app as official, affiliated with, endorsed by, or made by Nintendo.

## Core Product Idea

Every organization member creates their own profile and project card.

A visitor opens the app and sees a large floating card in the center of a monochrome retro game scene. Cards are arranged as a smooth carousel. The current card can be flipped to reveal a portfolio/project side.

The app is both:
- a member directory
- a personal mini portfolio system
- a collectible card experience
- a mobile-installable PWA

## Non-Negotiable Features

1. Authentication: register, login, logout.
2. Member profile creation/editing.
3. Public member cards.
4. Card front/back flip animation.
5. Horizontal/drag/swipe card carousel.
6. Member projects attached to their card.
7. GitHub, LinkedIn, personal website, and optional public email links.
8. Automatic QR code for each public profile URL.
9. Search members by name, handle, role, skill, or project.
10. Admin approval workflow for public cards.
11. Responsive design for phones, tablets, laptops, and desktops.
12. PWA installability and standalone app mode.
13. Persistence in a hosted database.
14. Zero-paid-cost architecture using free tiers only, subject to provider terms and limits.

## Product Principles

- The card is the main object, not a normal webpage with cards added afterward.
- The interface should look like a real game UI, not a generic dashboard.
- Keep the visual language cohesive and restrained.
- Use monochrome as the dominant visual rule.
- Use one or two very small accent treatments only when needed for hierarchy or state.
- Avoid visual clutter.
- Favor tactile interactions: flip, drag, snap, hover depth, pressed buttons, transitions.
- Make mobile feel first-class rather than desktop squeezed onto a phone.
- Keep all content editable by the member.
- Keep the default experience fast and lightweight.

## Visual Direction

Primary aesthetic:
- monochrome black/white/gray
- CRT/retro console mood
- pixel borders
- chunky UI
- subtle scanline/grain texture
- pixel-art clouds, blocks, coins, pipes, stars, mushrooms, platforms, and world-map motifs recreated as original artwork
- 8-bit/16-bit-inspired geometry
- depth through shadows, highlights, and layered parallax

The app should resemble a fictional retro gaming platform called PIXENDO, with PIXEL PASS as its member-card system, not a Nintendo website.

## Recommended Brand Treatment

Use the fictional platform identity **PIXENDO** and the product/card identity **PIXEL PASS**.

Use the wordmark:

PIXEL PASS

Optional internal fiction:
- PLAY PASS
- PIXEL WORLD
- MEMBER QUEST
- PLAYER CARD

Do not use Nintendo, Mario, Super Mario, Mushroom Kingdom, Nintendo Switch, official character names, or official Nintendo button/icon treatments in product copy or brand assets.

## Technical Direction

Preferred stack:
- React
- Vite
- TypeScript
- Tailwind CSS
- Framer Motion
- Embla Carousel or Swiper
- Supabase for Auth + PostgreSQL + Storage
- Vite PWA plugin
- Vercel deployment

Keep the architecture simple. Avoid an unnecessary custom backend server.

## Expected Folder Structure

```text
src/
  components/
    cards/
    carousel/
    pixel/
    projects/
    profile/
    layout/
    admin/
  pages/
  hooks/
  lib/
  services/
  types/
  data/
  assets/
  styles/
public/
  icons/
  pixel-art/
docs/
```

## Code Quality Rules

- TypeScript strict mode.
- Reusable components.
- Clear naming.
- Small focused functions.
- Accessible buttons and form controls.
- Keyboard support for carousel and card flip.
- Touch gestures on mobile.
- Reduced-motion support.
- Do not hard-code member data into UI components.
- Keep Supabase access behind service/helper modules.
- Validate forms client-side before submission.
- Never expose Supabase service-role keys in frontend code.
- Use environment variables.
- Use Row Level Security policies.
- Do not invent fake backend APIs.

## UX Requirements

Homepage:
1. Hero title/brand.
2. Short invitation to explore.
3. Main floating card carousel.
4. Card flip hint.
5. Search/member discovery.
6. Call-to-action to create a card.

Member card front should prioritize:
- profile image
- full name
- handle/tagname
- role or short identity line
- social links
- QR code

Member card back should prioritize:
- short bio
- project inventory
- selected skills
- portfolio action
- optional contact action

## Card Interaction

Desktop:
- mouse drag
- arrow controls
- keyboard left/right
- click/tap to flip

Mobile:
- swipe left/right
- tap to flip
- natural momentum/snap

The current card should be visually dominant, while adjacent cards peek from behind.

## Admin

Admin can:
- view pending cards
- approve/reject profiles
- unpublish profiles
- edit moderation state
- optionally feature a member/project

Members can:
- create draft
- submit for review
- edit their own draft
- publish only after approval

## Definition of Done

The application is not done until:
- a new user can register
- the user can build a profile
- the user can add projects
- the user can preview the card
- the user can submit it
- an admin can approve it
- approved profile appears in the public carousel
- card flips correctly
- QR code opens public member page
- links work
- the app can be installed as a PWA
- mobile and desktop layouts are usable
- database reads/writes are persistent
- protected routes are enforced
- no secret keys are exposed
- empty/loading/error states are handled

## Execution Strategy

Build in this order:

Phase 1 — project scaffolding and design system
Phase 2 — Supabase schema/auth/RLS
Phase 3 — profile editor
Phase 4 — card renderer/front/back
Phase 5 — carousel interactions
Phase 6 — public member routes
Phase 7 — projects and QR
Phase 8 — admin moderation
Phase 9 — search/filtering
Phase 10 — PWA/install UX
Phase 11 — responsive/accessibility/performance polish
Phase 12 — production verification

Before adding extras, make the core card experience excellent.

## Claude Working Style

When implementing:
- inspect the repository first
- do not delete working features without reason
- reuse existing dependencies when reasonable
- make changes in coherent commits or clearly separated patches
- after substantial changes, run the project checks
- fix lint/type/build errors before moving on
- if a design decision is ambiguous, prioritize the product and visual rules in this file
- do not silently introduce paid services
