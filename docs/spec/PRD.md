# PIXEL PASS — Product Requirements Document

## 1. Product Summary

PIXEL PASS is an interactive organization member showcase presented as a collection of digital player cards.

Instead of a conventional directory, every member owns a profile card containing their identity, links, and projects. Visitors browse the cards through a central floating carousel and can flip a card to explore the member's project portfolio.

## 2. Problem

Traditional organization/member directories are static, visually repetitive, and disconnected from the personal work of each member.

The goal is to make member discovery memorable while still giving every person a practical portfolio-style page.

## 3. Target Users

### Members

People who want a simple way to present:
- who they are
- what they do
- their social/professional links
- their projects
- their portfolio

### Visitors

People who want to discover organization members and their work quickly.

### Admins

Organization officers managing submissions and public visibility.

## 4. Core User Journey

Visitor:

Open app → browse card carousel → flip card → inspect projects → open profile/link.

Member:

Register → create profile → upload photo → add links → add projects → preview card → submit → wait for approval → profile becomes public.

Admin:

Login → open moderation queue → inspect submission → approve/reject → manage published profiles.

## 5. Card Content

### Front

- photo
- full name
- handle/tagname
- role/title
- short identity line
- GitHub
- LinkedIn
- portfolio
- optional email
- QR code

### Back

- short bio
- projects
- skills
- selected achievement or organization role
- view full profile

## 6. Project Content

Each project can contain:

- project title
- short description
- cover image
- project URL
- GitHub URL
- technologies/tags
- optional date

## 7. Visibility

Members can have:
- draft
- pending_review
- approved
- rejected
- unpublished

Optional visibility control:
- public
- organization_only

## 8. Search

Search fields:
- full name
- username
- role
- skills
- project title

Optional filters:
- department
- role
- skill
- featured

## 9. PWA Requirements

The application must:
- provide a web app manifest
- provide installable icons
- support standalone display mode
- include a suitable theme color
- work responsively on mobile/tablet/desktop
- provide an iOS-friendly install explanation
- maintain a good offline shell experience where practical

Do not depend on offline mutation unless needed. The critical requirement is installability and a reliable online experience.

## 10. Non-Goals for MVP

Do not build:
- chat
- private messaging
- comments
- complex social feed
- public follower counts
- real-time multiplayer
- gamified rankings
- payments
- subscription system
- paid APIs

## 11. Success Criteria

A visitor should understand the product in under 10 seconds.

A member should be able to publish a card without developer assistance.

A visitor should be able to reach a member's portfolio in two or three interactions.

The visual experience should be memorable enough that people remember the card system rather than thinking of it as another member directory.
