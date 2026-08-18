# Frontend — Architecture & Conventions

React 19 + Vite + TypeScript client for DentHub. Biome for lint/format.
Talks to the backend only through the `/api` proxy.

> For the product this UI must eventually deliver (roles, screens, flows), see
> [`../docs/PRD.md`](../docs/PRD.md).

---

## Structure (`src/`)

| Path | Responsibility |
|---|---|
| `main.tsx` | React entry — mounts `<App>` into `#root`, imports `global.css`. |
| `App.tsx` | Top-level component. Today: the welcome hero + live backend-health badge. |
| `components/` | Reusable presentational components (e.g. `ToothMark.tsx`, the brand glyph). |
| `lib/api.ts` | **Typed API client.** One function per backend call; response interfaces mirror the backend Pydantic models. |
| `global.css` | Design tokens + component styles (see Styling below). |

## Data flow & the API contract

- **All network access goes through `lib/api.ts`.** Components never call `fetch`
  directly — they import a typed function (`fetchHealth()`, and future
  `fetchPatients()` etc.). This keeps the contract in one place.
- Types in `lib/api.ts` **mirror the backend response models** (`HealthStatus` ↔
  backend `HealthStatus`). If a backend model changes, update the matching interface
  here. As the surface grows this is the natural point to switch to generated types
  from the FastAPI OpenAPI spec (`openapi-typescript`).
- **Never hard-code the backend origin.** Call relative paths (`/api/v1/...`); Vite's
  proxy (`vite.config.ts`) forwards `/api` to the backend at `localhost:8000` (the port
  the `dev:backend` script pins).
- Errors: the backend returns `{ code, message, detail? }`. `fetchHealth` throws on
  non-`ok`; model UI state as an explicit union (see the `BackendState` type in
  `App.tsx`) rather than juggling loading/error booleans.

## Styling conventions

- **CSS custom properties are the design system.** Colours, radii, and shadows are
  tokens on `:root` in `global.css`; components reference `var(--…)` — never hex
  literals inline.
- **Theme-aware.** Every colour is defined for light and dark. The dark palette is
  the default `:root`; the light palette overrides under
  `@media (prefers-color-scheme: light)`. Add new colours to **both**.
- **Accessible motion.** All animation is wrapped by a
  `@media (prefers-reduced-motion: reduce)` kill-switch at the bottom of the file —
  keep it that way when adding animations.
- Brand: dental teal (`--brand`) → sky (`--brand-2`) gradient; the tooth mark is the
  logo. Keep it clean and clinical.

## How to add a component / screen

1. Presentational component → `src/components/Name.tsx` (named export, typed props).
2. Needs backend data? Add a typed function to `lib/api.ts` first, then consume it.
3. Style with existing tokens; add new tokens (light + dark) to `global.css` if
   genuinely needed.
4. Routing: none yet (single view). When the app needs multiple screens, add a router
   (React Router or TanStack Router) and note the choice here.

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
