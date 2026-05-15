# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build (runs generateStaticParams, surfaces TS errors)
npm run lint     # ESLint
npx tsc --noEmit # TypeScript check (demo/, v0_designs/, scripts/ are excluded from tsconfig)
```

There is no test framework. Verification is done by running `npm run build` and checking the route output table.

## What This Is

Rich Picks Film Awards — a personal film criticism site tracking awards nominations and Rich's picks across ~20 award organizations (Oscar, BAFTA, DGA, SAG, ASC, etc.) from 1927 to present. Rich Picks' own nominations/winners live in the same DB as all other orgs, distinguished by `o.short_name = 'Rich Picks'`.

## Architecture

### Data Flow

```
PostgreSQL (Supabase) → lib/db.ts (query pool) → lib/awards.ts (queries + transforms) → app/*/page.tsx (Server Components, ISR) → components/ (Client Components for interactivity)
```

**`lib/db.ts`** exports a single `query(sql, params?)` function backed by a `pg.Pool` (max 10 connections). Always use parameterized queries (`$1`, `$2`). Returns `{ rows: any[], rowCount: number }`.

**`lib/awards.ts`** (~1450 lines) is the central data layer. All DB reads for the public site go through here. It handles:
- Fetching nominations, winners, and categories per year/person/film
- Computing "other awards" badges for each nominee (whether they won/were nominated at Oscar, BAFTA, etc.)
- Canonical category mapping (`canonical_categories` + `category_canonical_map` tables) used to match e.g. "Best Film" (BAFTA) to "Best Picture" (Oscar) — the mapping is loaded lazily and cached in-process
- `slugify()`, `personDisplayName()`, `formatNamesList()` utilities used throughout

### Database Schema

Central tables and relationships:

```
organizations → awards → ceremonies → nominations (hub)
                       → categories ↗              ↘→ films
                                                   ↘→ nomination_people → people
```

- **`nominations`**: The join table connecting `ceremony_id`, `category_id`, `film_id`, and `win` (boolean). All Rich Picks picks/wins are rows here with the Rich Picks organization.
- **`reviews`**: `film_id` (UNIQUE), `grade`, `review_text`, `updated_at`. One review per film. Grades are letter grades: `A+`, `A`, `A-`, `B+` … `F`. Compound grades like `A-//B+` are allowed and averaged.
- **`considerations`**: `film_id`, `category_id`, `year`, `detail` (UNIQUE together). Films Rich considered but did not nominate, with optional per-person detail strings.
- **`canonical_categories`** + **`category_canonical_map`**: Canonical cross-org category identities used for badge computation and nominee grouping. Do not modify these manually.
- **`film_crew`**: `film_id`, `person_id`, `crew_role` (Director/Editor/Cinematographer/etc.) — auto-populated from Wikipedia on review creation.

Rich Picks data starts at `RP_START_YEAR = 2005` (defined in `app/year/[year]/page.tsx`).

### Page / Caching Pattern

All dynamic pages use ISR with `revalidate = 3600`. Pages with known params implement `generateStaticParams()` to pre-build at deploy time. The build output table (○ static, ● SSG, ƒ dynamic) is the fastest way to verify caching behavior after changes.

```typescript
export const revalidate = 3600;

export async function generateStaticParams() {
  const years = await getYearsWithDBReviews();
  return years.map(y => ({ year: String(y) }));
}

export default async function Page(props: { params: Promise<{ year: string }> }) {
  const { year } = await props.params; // params are Promises in Next.js 16
  const [data1, data2] = await Promise.all([getX(year), getY(year)]);
  return <ClientComponent data1={data1} data2={data2} />;
}
```

### Admin

`proxy.ts` (not `middleware.ts`) handles auth — Next.js 16 uses `proxy.ts` as its middleware entry point. It intercepts all `/admin/*` (except `/admin/login`), checks Supabase session, and redirects unauthenticated users. Do not create a `middleware.ts`; it will conflict.

Admin writes go through API routes in `app/api/admin/`. The `add-review` route is the most complex: it finds-or-creates a film, upserts a review, inserts considerations, and auto-fetches crew from Wikipedia.

### Styling

CSS custom properties in `app/globals.css`, not a Tailwind config file. Key variables: `--background`, `--foreground`, `--card`, `--primary` (Oscar gold `#d4af37`), `--accent`, `--border`, `--muted`, `--grade-a/b/c/d/f`. The site is always in dark mode; light/dark CSS blocks exist but are identical. Use `bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border` etc. from these variables — avoid hardcoded hex values in components.

Hexagon shape utility: `clip-hexagon` class (defined in globals.css as a clip-path). Used throughout for badge/avatar styling.

### Component Conventions

- Pages are async Server Components; interactive pieces are extracted into `"use client"` components passed data as props.
- UI primitives live in `components/ui/` (Radix + shadcn wrappers). Use these rather than raw Radix.
- `award-icons.tsx` is a client component rendering award badges with Radix Popover tooltips — it handles the full badge-to-popover rendering pipeline.
- `lib/films-data.ts` loads `data/films.json` (a local flat list of Rich Picks-reviewed films used for fast client-side filtering on the homepage). This is separate from DB data.

## Non-Production Directories

`demo/`, `v0_designs/`, and `scripts/` are excluded from TypeScript compilation (see `tsconfig.json`). They are old prototypes and data-migration scripts — never served by the Next.js app. Do not modify them to fix TS errors.
