# DentistHub

[![CI](https://github.com/mutuajoseph/Denthub/actions/workflows/ci.yml/badge.svg)](https://github.com/mutuajoseph/Denthub/actions/workflows/ci.yml)

A simple full-stack monorepo — **FastAPI** backend + **React / Vite** client —
scaffolded with the code-design principles from the Faro engineering codebase.

## Structure

```
Denthub/
├── backend/     # FastAPI service (uv): routes → logic → repositories, Alembic migrations
├── frontend/    # React 19 + Vite + TypeScript client
├── docs/        # PRD, release guide, ADRs, agent config
├── AGENTS.md    # engineering rules for humans and coding agents (CLAUDE.md → symlink)
└── CONTEXT.md   # domain glossary
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

Requires [`uv`](https://docs.astral.sh/uv/), [`pnpm`](https://pnpm.io/), Node 22+, Python 3.12+.

```bash
# 1. install everything
pnpm run setup        # == uv sync --project backend && pnpm install

# 2. create the local SQLite database, and optionally seed the shop catalogue
uv run --directory backend alembic upgrade head
uv run --directory backend python -m app.scripts.seed_products

# 3. run backend + frontend together
pnpm run dev
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:8000 (API docs at `/docs`, health at `/api/v1/health`)

Vite proxies `/api` → the backend, so the client calls `/api/v1/...` same-origin.

> **Port 8000 in use?** Run the backend on another port and point the proxy at it:
> `BACKEND_PORT=8010 npx concurrently "uv run --directory backend python -m uvicorn app.main:app --reload --port 8010" "pnpm --filter frontend dev"`
>
> **Apple Silicon: "the greenlet library is required"?** Run
> `uv pip install --directory backend greenlet` (see `backend/AGENTS.md`).

## Project docs & guides

- [`docs/PRD.md`](docs/PRD.md) — product requirements (DentHub marketplace, domain truth)
- [`docs/RELEASE.md`](docs/RELEASE.md) — trunk-based flow + tag-triggered deploys (Vercel + Render)
- [`AGENTS.md`](AGENTS.md) — engineering rules (issues, PRs, definition of done, schema checklist) · [`backend/AGENTS.md`](backend/AGENTS.md) · [`frontend/AGENTS.md`](frontend/AGENTS.md)
- [`CONTEXT.md`](CONTEXT.md) — domain glossary · [`docs/adr/`](docs/adr/) — architecture decisions

## Handy commands

| Command | What it does |
|---|---|
| `pnpm run dev` | Run backend + frontend concurrently |
| `pnpm run build` | Production build of the frontend |
| `pnpm run lint` | ruff (backend) + biome (frontend) |
| `pnpm --filter frontend test` / `uv run --directory backend pytest` | Frontend / backend tests |
| `make setup` / `make dev` | Makefile equivalents |
