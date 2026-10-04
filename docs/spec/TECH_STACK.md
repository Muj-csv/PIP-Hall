# PIXEL PASS — Technical Stack

## Preferred Stack

### Frontend
- React
- Vite
- TypeScript

### UI
- Tailwind CSS
- CSS variables for design tokens
- Framer Motion for motion

### Carousel
- Embla Carousel preferred
- Swiper acceptable if already installed or clearly simpler

### Backend
- Supabase
  - PostgreSQL
  - Auth
  - Storage

### PWA
- vite-plugin-pwa

### Hosting
- Vercel

## Cost Constraint

The project must be implementable with zero mandatory paid services.

Use free tiers only.

Do not add:
- paid image APIs
- paid AI APIs
- paid analytics
- paid database providers
- paid email services
- paid icon packs
- paid font licenses

Before deployment, verify the provider's current free-tier and usage policies.

## Environment Variables

Expected frontend-safe variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never expose a Supabase service-role key in browser code.

## Routing

Use client-side routing with public and protected routes.

Suggested routes:

```text
/
/explore
/member/:username
/login
/register
/create
/edit
/admin
/settings
```

## State

Prefer local component state and small focused hooks.

Use a larger state library only when there is a demonstrated need.

## Data Fetching

Keep database queries in service modules rather than scattering Supabase calls across presentation components.

Example:

```text
src/services/profileService.ts
src/services/projectService.ts
src/services/adminService.ts
```

## Image Handling

Store avatars and project images in Supabase Storage.

Optimize uploads before sending where practical:
- resize oversized avatars
- compress project thumbnails
- reject obviously huge files

## Error Handling

Provide friendly UI states for:
- network failure
- auth failure
- missing profile
- invalid link
- upload failure
- empty project list
- pending moderation

## Performance

Prioritize:
- lazy loaded routes
- lazy images
- small pixel assets
- limited third-party JavaScript
- avoiding giant background images
- avoiding unnecessary re-renders during carousel interaction
