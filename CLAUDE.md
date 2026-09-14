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
