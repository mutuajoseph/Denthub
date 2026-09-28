# Frontend

React 19 + Vite + TypeScript client for DentHub. Biome lints and formats;
Vitest + Testing Library test. Repo-wide rules (definition of done, API
contract, money, country) live in the root [`AGENTS.md`](../AGENTS.md).

## Talking to the backend

The chain is: component → `hooks/` (TanStack Query) → typed client in `lib/` →
`lib/apiClient.ts` → `/api/v1`.

- **`lib/apiClient.ts` is the only transport.** `apiRequest` / `getJson` /
  `postJson` add the country and currency headers, the bearer token, the
  timeout, and turn the `{ code, message, detail? }` envelope into an
  `ApiError`. Resource clients build on it; code outside `apiClient.ts` never
  calls `fetch` against `/api`.
- **One client per resource** (`productApi.ts`, `auth.ts`, ...) holds that
  resource's contract types, mirroring the backend Pydantic models, plus a
  wire-to-UI mapper (`mapProduct`). A backend model change updates it in the
  same PR.
- **Server state lives in TanStack Query hooks** in `hooks/`. The query key
  lists every input the request reads, including the region from `regionStore`,
  so a region switch refetches rather than serving another country's prices.
- Hooks expose request state as the query's `status` union (or one
  discriminated union of your own), not as parallel `loading`/`error` booleans.
- Paths are relative (`/api/v1/...`) and pass through `apiClient`, which
  already resolves the base. A `VITE_*` absolute origin is never needed.
- Third-party calls (the ipwho.is region lookup in `config/regions.ts`) stay
  outside `lib/` and sit behind a `VITE_*` flag that is off by default.

## Client state

Zustand stores in `store/` hold client-only state (theme, region, cart, UI
toggles), persisted where the store says so. Anything that comes from the
backend belongs in a query, not a store.

- The cart holds prices exactly as the API returned them (decimal strings) and
  sums them exactly (see root `AGENTS.md`, "Money"). A cart line re-prices when
  its quantity crosses the product's wholesale threshold.
- Map the backend's country with a single `toApiCountry()`-style helper; the
  `GLOBAL` → `KE` fallback lives in one place.

## Components and routing

- Components use **named exports** and typed props. Shared primitives live in
  `components/ui/`; page-level screens in `pages/`.
- Routes are declared in `App.tsx` (React Router v7) inside `components/layout/AppShell`;
  the catch-all renders `NotFound`. Role-gated screens wrap in
  `auth/RouteGuard`, with roles from `auth/roles.ts`.
- Add a screen in this order: typed client function in `lib/`, a hook in
  `hooks/`, then the component. It is done when it matches `docs/design/DESIGN.md` at
  desktop and phone width (375px), with a test covering its states.

## Styling

The design system is [`docs/design/DESIGN.md`](../docs/design/DESIGN.md) (tokens
in `theme.css` / `variables.css` / `tokens.json` beside it); product context
for design work is [`PRODUCT.md`](PRODUCT.md). The UI is **light-only**.

- Tokens live in the `@theme` block of `src/global.css`: `paper`, `ink`,
  `graphite`, `cloud`, `steel`, `slate`, `charcoal`, `aqua-relay`,
  `lime-notice`; radii `rounded-link` (4px), `rounded-button` (12px),
  `rounded-card` (16px); shadows `shadow-card-white|cloud|graphite`,
  `shadow-edge`; type `text-display-hero|display-section|feature-heading`.
  A colour that doesn't exist yet becomes a token, never an inline hex.
- Surfaces step Paper → Cloud → Graphite → Ink. Fonts: Inter Tight for display
  headings (tracking -0.04em), Inter 500 for UI, Chivo Mono only for technical
  data (codes, IDs, prices), never as decoration.
- **Aqua is the conversion signal**: filled primary buttons and selected
  markers only, never a page or section fill and never text on white. Lime is
  the announcement strip. One aqua conversion button per view.
- Reuse the primitives in `components/ui/` (`Button` variants primary /
  secondary / graphite / translucent, `Card` tones white / cloud / graphite).
  Pills (`rounded-full`) are for status chips only.
- Headings carry their own weight: no eyebrow or kicker labels above them.
- `src/global.css` holds a **revamp shim** that maps the old `orange-*`,
  `gold-*` and `navy-*` names to graphite/ink while screens are revamped phase
  by phase (#11). New code uses the design tokens; a revamped file contains no
  `orange-*`/`gold-*`/`navy-*` classes and no `dark:` variants.
- Animations keep the `prefers-reduced-motion: reduce` kill-switch in
  `global.css`; one authored motion moment per surface.

## Testing

- Tests are `*.test.ts(x)` next to the code they cover. `src/test/setup.ts`
  loads jest-dom matchers and stubs `IntersectionObserver`; add browser-API
  stubs there, not per test.
- Query by role and accessible name (`getByRole("button", { name: ... })`).
  Wrap components that use hooks in a fresh `QueryClient` per test.

## Gotchas

- `pnpm build` runs `tsc` with `strict`, `noUnusedLocals`, and
  `noUnusedParameters`. The dev server does not type-check, so build before
  calling anything done.
- `vite.config.ts` runs in Node (`process.env`), which is why `@types/node` is
  a dev dependency and `"node"` is in `tsconfig.json` `types`.
- pnpm 10 blocks native build scripts unless the package is allow-listed in the
  root `pnpm-workspace.yaml` (`onlyBuiltDependencies`, `allowBuilds`).
