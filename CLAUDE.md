# DentHub — Project Guide (root)

DentHub is a multi-sided dental marketplace (patients ↔ facilities/dentists ↔
suppliers ↔ training providers ↔ job seekers), Kenya-first and multi-country by
design. This repo is the **greenfield backend + client** for that product.

> **Product spec:** the full product context lives in [`docs/PRD.md`](docs/PRD.md).
> Read it before doing any domain modelling — it defines roles, entities, and the
> multi-country/RBAC constraints that shape the architecture. What exists in code
> today is an MVP scaffold (a health endpoint + a welcome page); the PRD is the map
> of where it's going.

@docs/PRD.md

---

## What this repo is

A pnpm-orchestrated monorepo with two deployables:

| Part | Stack | Location | Deep-dive guide |
|---|---|---|---|
| Backend API | FastAPI · Python 3.12 · uv | [`backend/`](backend/) | [`backend/CLAUDE.md`](backend/CLAUDE.md) |
| Web client | React 19 · Vite · TypeScript | [`frontend/`](frontend/) | [`frontend/CLAUDE.md`](frontend/CLAUDE.md) |

The design principles are lifted from the Faro engineering codebase (see the root
`README.md`): strict layering, typed application state, a single error envelope,
lifespan-managed startup, and end-to-end type safety.

```
dentisthub/
├── CLAUDE.md              ← you are here (project-wide guide)
├── README.md              # human-facing quick start
├── docs/
│   └── PRD.md             # product requirements (source of domain truth)
├── backend/               # FastAPI service  → see backend/CLAUDE.md
├── frontend/              # React + Vite app → see frontend/CLAUDE.md
├── package.json           # root scripts + `concurrently`
└── pnpm-workspace.yaml
```

## Golden-path commands

Always run these from the repo root (`dentisthub/`).

```bash
pnpm run setup     # uv sync (backend) + pnpm install (frontend)
pnpm run dev       # backend + frontend concurrently
pnpm run build     # production build of the frontend
pnpm run lint      # ruff (backend) + biome (frontend)
```

- Frontend → http://localhost:5173 · Backend → http://localhost:8000 · Docs → `/docs`
- The dev command pins the backend to **8000** (`dev:backend` uses `uv run --directory
  backend …`, kept shell-agnostic for cross-platform use). Free `:8000` before running
  if it's occupied locally. The Vite `/api` proxy targets `localhost:8000` by default.

## Conventions that span both sides

- **API is versioned under `/api/v1`.** The client only ever talks to `/api/*`
  (Vite proxies it to the backend in dev). Never hard-code the backend origin in
  client code.
- **One error shape everywhere:** `{ code, message, detail? }` (`OpenApiErrorResponse`).
  The client can rely on that contract for every endpoint.
- **The API contract is the seam.** Backend Pydantic response models are the source
  of truth; the client mirrors them in `frontend/src/lib/api.ts` (hand-written today,
  a candidate for OpenAPI codegen as the surface grows).
- **Multi-country is not an afterthought** (see PRD §5–6): design new endpoints to be
  country/currency-aware from the start rather than retrofitting.

## Working agreements for Claude

- Keep the **Route → Logic → (Repository)** layering intact on the backend and the
  typed-client pattern on the frontend. The per-directory `CLAUDE.md` files spell out
  each and show how to add a new feature — read the relevant one before editing there.
- Match the surrounding style; don't introduce a new lib/pattern without a reason.
- After changes, run the relevant `lint`/`build` before calling something done.

## Git / GitHub

- Remote `origin` → `git@github-personal:mutuajoseph/Denthub.git` (the `github-personal`
  SSH host alias maps to the **mutuajoseph** account; the default `github.com` key on
  this machine is a different account and is **not** authorized on this repo).
- Default branch: `main`.
