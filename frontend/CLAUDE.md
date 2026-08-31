# Frontend — Architecture & Conventions

React 19 + Vite + TypeScript client for DentHub. Biome for lint/format.
Talks to the backend only through the `/api` proxy.

> For the product this UI must eventually deliver (roles, screens, flows), see
> [`../docs/PRD.md`](../docs/PRD.md).

---

## Structure (`src/`)

| Path | Responsibility |
|---|---|
| `main.tsx` | React entry — mounts `<App>` into `#root`, imports `global.css`, initialises persisted theme. |
| `App.tsx` | Top-level component — hosts the router (React Router v7); routes to pages, catch-all → `NotFound`. |
| `pages/` | Route-level screens (e.g. `Home.tsx`, `NotFound.tsx`). |
| `components/` | Reusable presentational components — `ui/` (Button, Badge, StarRating), `home/` (HeroSection, StatsBar, HowItWorks, FeaturedClinics), plus `Navbar.tsx`, `CartDropdown.tsx`, `CountrySelector.tsx`. |
| `hooks/` | Shared React hooks (`useRegion`, `useCountryConfig`, `useDentistSearch`). |
| `store/` | Zustand stores: `themeStore`, `cartStore`, `regionStore`, `countryConfigStore`, `siteContentStore` (persisted where noted). |
| `config/` | Static domain config — `regions.ts`, `subdivisions.ts`, `dentistConstants.ts`. |
| `lib/` | Typed API clients and contract types (see Data flow below). `api.ts` mirrors the backend Pydantic models. |
| `utils/` | `cn` (clsx + tailwind-merge), `iconMap`, `subdivisionCopy`. |
| `global.css` | Tailwind v4 entry + design tokens (see Styling below). |

## Data flow & the API contract

- **Backend-facing network access lives in `lib/`.** `lib/api.ts` is the typed client
  for backend endpoints — one function per backend call, response interfaces mirroring
  the backend Pydantic models (`HealthStatus` ↔ backend `HealthStatus`). As the surface
  grows, newer clients (`lib/searchApi.ts`, `lib/countryConfigApi.ts`) follow the same
  typed-function-per-call pattern. Keep all backend calls behind these typed clients —
  components never call `fetch` against `/api` directly.
- **Third-party calls** (e.g. IP geolocation in `config/regions.ts`) are separate from
  `lib/` and are optional, gated behind env flags — see `IP_DETECTION_ENV_FLAG`.
- Types in `lib/api.ts` **mirror the backend response models**; if a backend model
  changes, update the matching interface here. As the surface grows this is the natural
  point to switch to generated types from the FastAPI OpenAPI spec (`openapi-typescript`).
- **Never hard-code the backend origin.** Call relative paths (`/api/v1/...`); Vite's
  proxy (`vite.config.ts`) forwards `/api` to the backend at `localhost:8000` (the port
  the `dev:backend` script pins).
- Errors: the backend returns `{ code, message, detail? }`. Clients throw on `!res.ok`;
  model UI state as explicit unions rather than juggling loading/error booleans.

## Styling & theming

- **Tailwind v4 `@import "tailwindcss"` with a custom `@theme` block.** Design tokens
  (navy/gold palette, fonts, shadows) are declared in `@theme` in `global.css`; Tailwind
  utilities like `bg-navy-900` / `text-gold-500` resolve to them. Reuse tokens over
  inline literals.
- **Theme-aware.** The palette is defined for light and dark. Theme is applied via a
  `.dark` class on `<html>`, toggled by `store/themeStore.ts` (persisted, follows the
  system preference until the user overrides). `global.css` sets
  `@custom-variant dark (&:where(.dark, .dark *));` so `dark:` utilities respond to the
  class. Add new colours to **both** the light `:root` and `.dark` blocks.
- Fonts: Playfair Display (display), Sora (heading), DM Sans (body). Brand accent:
  gold/orange.
- **Accessible motion.** Animation is wrapped by `@media (prefers-reduced-motion: reduce)`
  kill-switches in `global.css` — keep that when adding animations.

## How to add a component / screen

1. Presentational component → `src/components/…` (named export, typed props); shared
   primitives go under `components/ui/`.
2. Needs backend data? Add a typed function to the relevant `lib/` client first, then
   consume it via a `hooks/` hook.
3. Style with existing tokens; add new tokens (light + dark) to `global.css` `@theme` /
   `:root` / `.dark` if genuinely needed.
4. Routing: add a `<Route>` in `App.tsx` (React Router v7). The catch-all `<Route path="*">`
   renders `NotFound`.

## Commands (run from `frontend/`, or use the root `pnpm` scripts)

```bash
pnpm dev        # Vite dev server (proxies /api → backend)
pnpm build      # tsc (typecheck) + vite build → dist/
pnpm lint       # biome check .
pnpm format     # biome format --write .
```

## Gotchas

- `vite.config.ts` runs in Node, so it uses `process.env` — that's why `@types/node`
  is a dev dependency and `"node"` is in `tsconfig.json` `types`.
- `tsconfig.json` is `strict` with `noUnusedLocals`/`noUnusedParameters`; `pnpm build`
  fails on unused symbols and type errors, so it's the real gate (dev server does not
  typecheck).
- Native deps (`esbuild`, `@biomejs/biome`) are allow-listed in the root
  `pnpm-workspace.yaml` under `onlyBuiltDependencies` — pnpm 10 blocks build scripts
  otherwise.
- Optional runtime features are gated by `VITE_*` env flags read via `import.meta.env`
  (e.g. `VITE_ENABLE_IP_DETECTION` to enable the ipwho.is region lookup). Off by default.
