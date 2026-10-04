# COPY/PASTE PROMPT FOR CLAUDE

You are the lead engineer and product designer for a project called **PIXEL PASS**.

Read these project files before modifying code:

- `/CLAUDE.md`
- `/docs/PRD.md`
- `/docs/DESIGN_SYSTEM.md`
- `/docs/TECH_STACK.md`
- `/docs/DATABASE.md`
- `/docs/IMPLEMENTATION_PLAN.md`
- `/docs/UI_SCREENS.md`
- `/docs/BRAND_AND_COPYRIGHT.md`

Your job is to build the application described in those documents.

## First

Inspect the existing repository and explain briefly:
1. current framework
2. current package manager
3. existing pages/components
4. existing backend/database integration
5. what can be reused
6. what should be replaced

Then begin implementation.

## Build Priority

Do not jump to advanced features first.

Build in this order:

1. foundation/design system
2. authentication
3. profile editor
4. member card front/back
5. project management
6. card carousel
7. public profile route
8. QR code
9. admin moderation
10. search/filtering
11. PWA
12. responsive/accessibility/performance polish

## Visual Requirement

The app must feel like a monochrome retro game interface from the classic console era.

The main screen must have a floating central card with neighboring cards behind it.

The current card is the hero object.

The card must flip in 3D to reveal the portfolio side.

Use original pixel-art motifs and a fictional brand identity. Do not use official Nintendo/Mario assets or branding.

## Functional Requirement

A member must be able to:

register → create a profile → upload photo → add links → add projects → preview card → submit for approval.

An admin must be able to approve or reject it.

Once approved, the member must appear in the public collection.

## Engineering Requirement

Keep the code modular.

Do not hard-code profile records into React components.

Do not expose service-role credentials.

Use Supabase RLS.

Handle loading/error/empty states.

Keep everything deployable with no mandatory paid services.

## Quality Gate

Before saying the implementation is complete:

- run type checking
- run linting if configured
- run production build
- verify database access
- verify auth flow
- verify card flip
- verify carousel swipe/drag
- verify QR routing
- verify public profile URL
- verify mobile layout
- verify PWA metadata

Fix errors rather than documenting them as acceptable.

When there is a choice between adding another feature and making the card interaction more polished, choose the card interaction.
