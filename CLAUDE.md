@AGENTS.md

## Responsive breakpoints

GymWiki uses Tailwind's default breakpoint scale consistently across the app —
no custom breakpoints. Three tiers, gated on specific prefixes so future pages
stay consistent with existing ones instead of picking ad-hoc widths:

- **Mobiel** (`< md`, < 768px): bottom navigation, single-column stacks,
  full-width buttons, filters/detail-metadata in a `Sheet` drawer.
- **Tablet** (`md`–`lg`, 768–1023px): the sidebar nav replaces the bottom bar
  (see `components/app-layout.tsx`); grids widen to 2–3 columns, but page
  containers and desktop-only layout changes (extra grid columns, side-by-side
  sections, inline filter sidebars) are NOT yet active — those wait for `lg`.
- **Desktop** (`>= lg`, >= 1024px): the real desktop layout. Page containers
  raise their `max-w-*` (typically `lg:max-w-5xl`/`6xl`, `xl:max-w-[1400px]`
  on the widest pages) so content doesn't stay phone-width forever; sections
  that are stacked on mobile/tablet may become side-by-side; drawers/sheets
  used for filters or actions on mobile get an inline, always-visible
  equivalent instead.

When adding a new page: use `md:` only for the nav-shell switch (rarely needed
directly — `AppLayout` already handles it), use `sm:` for small tablet/phone
nuances, and gate any "this is a real desktop layout now" change behind `lg:`
(with `xl:`/`2xl:` only for capping max-width on very wide monitors).

## Performance standard: code-splitting, images, bundle budget

GymWiki targets a Lighthouse mobile performance score of **≥90** on Dashboard,
Bibliotheek, Activiteit-detail, Activiteit maken/bewerken (les-maken), the
fullscreen canvas-editor, and Kennisbank — and a client-side JS bundle that
doesn't creep back up over time. Three concrete rules keep it that way:

- **Code-split any client-only library that isn't needed on first paint of
  the page it lives on.** `next/dynamic` (see
  `components/canvas/FullscreenDiagramEditor.tsx` for the canvas-editor) for
  a whole component; a plain `await import(...)` *inside the event handler
  that actually needs it* (see `components/pdf/ActivityPdfButton.tsx` and its
  siblings) when the component itself is cheap but a dependency it only uses
  on click/submit is not. `@react-pdf/renderer` is the running example: it's
  ~2.8MB and used by maybe 1 in 100 page visits, so it must never appear in a
  page's static import graph — only inside the download handler.
- **Use `next/image`, not a raw `<img>`, for any raster image with a known
  display box.** `next.config.ts`'s `images.remotePatterns` already allows
  both external hosts (Firebase Storage for the original library import,
  `*.supabase.co` for everything uploaded since). Use `fill` inside a
  `relative` parent with a fixed height (see `library-item-card.tsx`,
  `my-activity-card.tsx`) for grid thumbnails, explicit `width`/`height` for
  fixed-size icons/avatars (see `profile/ProfileHeader.tsx`). Two documented
  exceptions where a raw `<img>` stays correct: SVGs (`next/image` only
  optimizes them behind `dangerouslyAllowSVG`, which widens the XSS surface —
  not worth it for the materials-library icons in `MaterialPicker.tsx`), and
  images whose box is deliberately unconstrained-aspect-ratio/auto-height
  (`ActivityImageLightbox`, `les/share/[id]`'s plattegrond preview) — forcing
  those into `next/image`'s box model would mean redesigning them to accept
  letterboxing, which is a visual change, not a drop-in perf fix.
- **`npm run check:bundle-size`** (wired into `.github/workflows/ci.yml`,
  runs after every build) fails the build if the total client JS chunk size
  exceeds budget, or if any single chunk exceeds its own budget — see
  `scripts/check-bundle-size.mjs` for the exact numbers and why it measures
  total chunk size rather than a precise per-route "First Load JS" (Next
  16.3.0/webpack-mode doesn't expose that cleanly, and the internal manifests
  that do are undocumented and version-fragile). If this check fails after
  adding a dependency, the fix is almost always "make the new import
  dynamic," not "raise the budget."

## Instant-reacting UI standard

Every user action (click, toggle, form submit) must produce a visible
reaction within ~100ms, whether or not the underlying server round-trip has
finished yet. Two shared primitives exist for this — reach for them before
hand-rolling loading/error state again:

- **`useOptimisticAction`** (`lib/hooks/useOptimisticAction.ts`) — for a
  value that a user flips (a toggle, a bookmark button, a chip) and a server
  action persists. Updates the UI immediately, reverts and toasts an error
  only if the server action actually fails. See
  `components/activity-detail-actions.tsx` (bewaren-toggle) and
  `components/profile/AvailableForInternshipToggle.tsx` for the two current
  uses — both used to hand-roll the same `useState` + `useTransition` +
  revert-on-error logic separately before this hook existed. Not every toggle
  needs it: if there's no server round-trip at all (e.g.
  `components/material-checklist.tsx`'s localStorage-only checklist), plain
  state is already instant and the hook would add nothing.
- **`Skeleton`** (`components/ui/skeleton.tsx`) + route-level `loading.tsx` —
  for anything that has to wait on a data fetch. Every top-level route has a
  `loading.tsx`; a data-dependent section *within* a page that streams in via
  its own `Suspense` boundary (see `dashboard/page.tsx`'s
  `ContributionStatusSection`) should get its own `Skeleton` fallback sized
  to roughly match the real content, not a generic spinner.

## Component/lib folder structure

`lib/` is the reference pattern: grouped by domain (`lib/ai`, `lib/services`,
`lib/constants`, `lib/supabase`, `lib/stripe`), never a flat dump. `components/`
is only partially there — `components/ui` (shadcn primitives), `components/profile`,
`components/canvas`, and now `components/pdf` (the PDF export buttons/documents,
grouped together when they were split into dynamic imports) are real domain
folders; everything else still sits flat at the top level from years of
one-off additions. Match `lib/`'s pattern for **new** components: a
component that's part of a recognizable feature area gets a folder
(`components/<domain>/Thing.tsx`), not another loose top-level file. Existing
flat files migrate opportunistically when they're touched for another reason
(as `components/pdf/` was) rather than in one large, high-risk mechanical
rename pass across the whole app.
