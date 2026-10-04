# PIXEL PASS — Implementation Plan

## Phase 0 — Inspect

- inspect current repository
- identify existing stack
- preserve useful code
- determine whether this is a greenfield app or retrofit
- confirm package manager

## Phase 1 — Foundation

- React/Vite/TypeScript setup if needed
- Tailwind setup
- Supabase client
- router
- global design tokens
- base pixel components
- PWA plugin

Deliverable:
A clean shell that visually demonstrates the intended design.

## Phase 2 — Auth + Profile

Build:
- register
- login
- logout
- session persistence
- protected routes
- profile editor
- avatar upload
- profile validation

Deliverable:
A member can create and save a profile.

## Phase 3 — Card System

Build:
- MemberCard
- CardFront
- CardBack
- flip state
- project inventory
- links
- QR code
- responsive card sizing

Deliverable:
A single member's complete card looks production quality.

## Phase 4 — Carousel

Build:
- data-driven member collection
- center-card emphasis
- side-card previews
- mouse drag
- touch swipe
- keyboard controls
- selection state

Deliverable:
The homepage feels like a collectible-card browser.

## Phase 5 — Public Profiles

Build:
- /member/:username
- direct share URL
- public profile page
- QR destination
- invalid profile state

Deliverable:
Every approved member has a shareable destination.

## Phase 6 — Projects

Build:
- add project
- edit project
- delete project
- project image upload
- link validation
- reorder projects

Deliverable:
Members can manage their own portfolio content.

## Phase 7 — Moderation

Build:
- admin route
- pending queue
- approve
- reject
- unpublish
- featured toggle

Deliverable:
Public content is controlled by organization admins.

## Phase 8 — Discovery

Build:
- search bar
- filters
- role/department filtering
- project search
- random member button

Deliverable:
Visitors can efficiently discover members.

## Phase 9 — PWA

Build:
- manifest
- icons
- install metadata
- standalone mode
- safe-area support
- install instructions
- iOS-friendly instructions

Deliverable:
The app can be added to a phone Home Screen and launched like an app.

## Phase 10 — Polish

- loading states
- skeletons
- empty states
- error states
- accessibility
- responsive testing
- keyboard testing
- reduced motion
- image optimization
- Lighthouse-style performance review

## Phase 11 — Production

- environment variable verification
- production Supabase URL
- RLS verification
- production build
- deployment
- smoke test
- verify QR links
- verify mobile install flow

## Priority Order

P0 = authentication, profiles, projects, card, carousel, public profile, database, PWA, responsive UI.

P1 = moderation, search, filters, featured members.

P2 = themes, reactions, random member, world-map expansion, advanced discovery.

Never let P2 work delay a broken P0 feature.
