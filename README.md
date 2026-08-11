# DentistHub

A simple full-stack monorepo — **FastAPI** backend + **React / Vite** client —
scaffolded with the code-design principles from the Faro engineering codebase.

## Structure

```
dentisthub/
├── backend/                 # FastAPI service (managed by uv)
│   └── app/
│       ├── main.py          # create_app() + lifespan-managed startup
│       ├── config.py        # typed Settings from env
│       ├── exceptions.py    # exception hierarchy + global handlers
│       ├── dependencies.py  # FastAPI Depends() factories
│       ├── middleware/      # request-id + structured logging
│       ├── utils/           # AppState, logger, OpenAPI helpers
│       ├── logic/v1/        # business layer  (health)
│       └── routes/v1/       # thin HTTP adapters (health)
├── frontend/                # React 19 + Vite + TypeScript
│   └── src/
│       ├── App.tsx          # "Welcome to DentistHub" + live health badge
│       └── lib/api.ts       # typed API client
├── package.json             # root scripts + concurrently
└── pnpm-workspace.yaml
```

## Design principles borrowed from Faro

- **Route → Logic layering** — routes are thin HTTP adapters; business logic lives in `logic/`.
- **Lifespan-managed startup** — no module-level state; init happens in `create_app()`'s lifespan.
- **Typed `AppState`** — a `@dataclass` container, not stringly-typed `request.app.state`.
- **Exception hierarchy + one error shape** — `OpenApiErrorResponse` (`code`, `message`, `detail`) with centralized handlers.
- **`standard_error_responses()`** — every route documents the same error codes.
- **Structured logging** — structlog with a per-request `request_id`.
- **Versioned API** — routes mounted under `/api/v1`.

## Quick start

Requires [`uv`](https://docs.astral.sh/uv/), [`pnpm`](https://pnpm.io/), Node 18+, Python 3.12+.

```bash
# 1. install everything
pnpm run setup        # == uv sync --project backend && pnpm install

# 2. run backend + frontend together
pnpm run dev
```

- Frontend → http://localhost:5173  (renders "Welcome to DentistHub frontend")
- Backend  → http://localhost:8000
- Health   → http://localhost:8000/api/v1/health  → `{"status":"ok","service":"DentistHub API","message":"ready to work"}`
- API docs → http://localhost:8000/docs

Vite proxies `/api` → the backend, so the client calls `/api/v1/health` same-origin.

> **Port in use?** If something already occupies `8000`, run on another port with a
> single knob — it keeps the backend and the Vite proxy in sync:
> ```bash
> BACKEND_PORT=8010 pnpm run dev
> ```

## Handy commands

| Command | What it does |
|---|---|
| `pnpm run dev` | Run backend + frontend concurrently |
| `pnpm run build` | Production build of the frontend |
| `pnpm run lint` | ruff (backend) + biome (frontend) |
| `make setup` / `make dev` | Makefile equivalents |
