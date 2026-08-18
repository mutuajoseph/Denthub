# Backend — Architecture & Conventions

FastAPI service for DentHub. Async-first, strictly layered, typed end to end.
Managed by [`uv`](https://docs.astral.sh/uv/). Python 3.12+.

> Read this before adding endpoints or touching startup/config/error handling.
> For the product domain this backend must eventually serve, see
> [`../docs/PRD.md`](../docs/PRD.md).

---

## Layered architecture

Dependencies point one way. A layer may call the one below it, never above.

```
HTTP request
  → Middleware        app/middleware/         cross-cutting: request-id + logging
  → Route handler     app/routes/v1/          thin HTTP adapter — no business logic
  → Logic             app/logic/v1/           business rules, orchestration
  → (Repository)      app/repositories/       persistence + external I/O  [planned]
  → data source                               DB / external API           [planned]
```

Today there is no database, so the chain is **Route → Logic**. When persistence
lands, introduce a **Repository** layer (constructed by the logic function, à la
Faro) rather than putting I/O in routes or logic. Keep the direction intact.

**Hard rules**
- Routes never contain business logic — they pull `AppState`, call one logic
  function, return its typed result.
- Logic never reads `request`/HTTP concerns — it takes plain args + `AppState`.
- No raw DB access above the repository layer (once it exists).

## Module map (`app/`)

| File | Responsibility |
|---|---|
| `main.py` | `create_app()` factory + `lifespan`. **All** init happens in the lifespan — no module-level state. Registers middleware, exception handlers, mounts `/api/v1`. |
| `config.py` | `Settings` (frozen dataclass) read once from env via `Settings.from_env()`. Add new config here; never call `os.getenv` deep in the stack. |
| `dependencies.py` | FastAPI `Depends()` factories. `get_app_state()` is the one seam handlers use to reach singletons. |
| `exceptions.py` | Exception hierarchy (`BaseApiException` → `NotFoundException`, `InvalidRequestError`, `ConflictError`, …), the `OpenApiErrorResponse` envelope, and the global handlers. |
| `utils/state.py` | `AppState` dataclass — the typed container of app singletons. Grows one field per singleton (logger, and later db engines, external clients). |
| `utils/logger.py` | structlog config: console renderer in dev, JSON otherwise. |
| `utils/openapi_helpers.py` | `standard_error_responses()` — attach the shared error codes to a route's OpenAPI. |
| `middleware/logging.py` | Binds a per-request `request_id` into structlog contextvars, logs one `request.handled` line with method/status/latency. |
| `routes/v1/` | Route modules. `__init__.py` aggregates them into `v1_router`. |
| `logic/v1/` | Business layer, one module per domain area. |

## Request lifecycle

1. `RequestLoggingMiddleware` assigns/propagates `x-request-id`, binds it to the
   log context.
2. CORS middleware (dev: allows the Vite origin).
3. Route handler resolves `AppState` via `Depends(get_app_state)`.
4. Handler calls its logic function; logic returns a Pydantic model.
5. On error: a raised `BaseApiException` subclass → serialized to
   `OpenApiErrorResponse` by `base_api_exception_handler`; anything else → generic
   500 via `general_exception_handler`. **Don't** scatter try/except in routes.

## Conventions

- **Every module starts with `from __future__ import annotations`.**
- **Typed everything** — mypy runs in `strict` mode. When you must read off
  `request.app.state`, `cast()` it (see `dependencies.py`).
- **Responses are Pydantic models**, never bare dicts. Define the model next to its
  logic function.
- **Document errors:** add `responses=standard_error_responses()` to route decorators.
- **Versioned routes:** new endpoints go under `app/routes/v1/`; breaking changes get
  a `v2`, they don't mutate `v1`.

## How to add a new endpoint / domain module

Say you're adding `patients` (a real PRD entity):

1. **Logic** — `app/logic/v1/patients.py`: define request/response Pydantic models
   and pure functions `(state, *, ...) -> Model`.
2. **Route** — `app/routes/v1/patients.py`:
   ```python
   from __future__ import annotations
   from fastapi import APIRouter, Depends
   from app.dependencies import get_app_state
   from app.logic.v1.patients import Patient, get_patient
   from app.utils.openapi_helpers import standard_error_responses
   from app.utils.state import AppState

   router = APIRouter(prefix="/patients", tags=["patients"])

   @router.get("/{patient_id}", response_model=Patient,
               responses=standard_error_responses())
   async def read_patient(patient_id: str,
                          state: AppState = Depends(get_app_state)) -> Patient:
       return get_patient(state, patient_id=patient_id)
   ```
3. **Register** it in `app/routes/v1/__init__.py`:
   `v1_router.include_router(patients.router)`.
4. When persistence exists: add `app/repositories/patients.py`, construct it inside
   the logic function, and move all DB access there.
5. Raise the right exception on failure (`NotFoundException(...)`) — the handler does
   the HTTP mapping.

## Adding a singleton (db engine, external client)

1. Initialize it in the `lifespan` in `main.py`.
2. Add a typed field to `AppState` (`utils/state.py`).
3. Reach it in handlers via `Depends(get_app_state)`. Never use module globals.

## Commands (run from `backend/`, or use the root `pnpm` scripts)

```bash
uv run uvicorn app.main:app --reload --port 8000   # dev server
uv run ruff check .                                 # lint
uv run ruff format .                                # format
uv run mypy app                                     # type-check (strict)
```

## Gotchas

- `pyproject.toml` has `[tool.uv] package = false` and **no** `[build-system]` — this
  is an app (virtual project), not a library. Run modules from the `backend/` dir so
  `app` resolves on the path.
- `Settings.from_env()` is called in `create_app()` (for title/CORS) and the heavy
  init is in the lifespan closure — keep env reads pure and cheap.
