# Backend

FastAPI service for DentHub: async, strictly layered, typed end to end, managed
by `uv` (Python 3.12+). Commands in this file run from `backend/` (the project
is a virtual `uv` app, `package = false`, so `app` only resolves from here);
the root docs' `uv run --directory backend ...` forms run from the repo root.
Repo-wide rules (definition of done, schema checklist, API contract) live in
the root [`AGENTS.md`](../AGENTS.md).

## Layering

Dependencies point one way; a layer calls only the one below it.

```
middleware/     request-id + one `request.handled` log line
routes/v1/      thin HTTP adapter
logic/v1/       business rules, Pydantic request/response models
repositories/   SQLAlchemy models + queries
```

- A route resolves `AppState` via `Depends(get_app_state)`, calls **one** logic
  function, and returns its typed result.
- Logic takes plain arguments plus `AppState` and never touches `Request`.
- Repositories own every query. Logic owns every rule. Standalone scripts in
  `app/scripts/` go through repositories too.
- Errors are raised as `BaseApiException` subclasses (`NotFoundException`,
  `ConflictError`, ...) and the global handlers map them to the
  `{ code, message, detail? }` envelope. Routes carry no try/except.

## Adding an endpoint

Take `patients` as the example.

1. **Logic**: `app/logic/v1/patients.py` defines the Pydantic models and
   functions shaped `(state, *, ...) -> Model`. Responses are always models.
2. **Route**: `app/routes/v1/patients.py`.
   ```python
   from __future__ import annotations

   from fastapi import APIRouter, Depends

   from app.dependencies import get_app_state
   from app.logic.v1.patients import Patient, get_patient
   from app.utils.openapi_helpers import standard_error_responses
   from app.utils.state import AppState

   router = APIRouter(prefix="/patients", tags=["patients"])


   @router.get("/{patient_id}", response_model=Patient, responses=standard_error_responses())
   async def read_patient(patient_id: str, state: AppState = Depends(get_app_state)) -> Patient:
       return await get_patient(state, patient_id=patient_id)
   ```
3. **Register** it in `app/routes/v1/__init__.py`.
4. **Repository**: `app/repositories/patients.py`, then run the root
   `AGENTS.md` schema checklist.
5. **Roles**: ask the user which roles may call it (root `AGENTS.md`, "Auth and
   security").
6. **Test**: an API test in `tests/` covering the happy path and each error the
   route documents.

The step is done when the route appears in `/docs` with its error responses and
the definition-of-done commands pass.

A breaking change to a `v1` response gets a `v2` route; `v1` keeps its shape.

## Conventions

- Every module, migrations included, starts with
  `from __future__ import annotations`.
- mypy runs `strict`. When reading `request.app.state`, `cast()` it (see
  `dependencies.py`).
- Config is read once in `Settings.from_env()` (`config.py`). New settings go
  there; `os.getenv` appears nowhere else.
- A singleton (engine, HTTP client) is created in the `lifespan` in `main.py`,
  stored as a typed field on `AppState` (`utils/state.py`), and reached through
  `get_app_state`. Module-level state stays empty.
- Constrained values (role, currency, country code, supplier scope) are
  `Literal` or `Enum` types at the Pydantic boundary, like `PurchaseMode`.
  Request strings get `max_length` matching their column.
- Logging is structlog through `state.logger`. Event names are `area.event`
  (`db.init`, `app.startup`, `seed.done`) with context as keyword fields. Pass
  URLs through `describe_url()` (in `app/scripts/seed_products.py`; move it to
  `utils/` on first reuse) so credentials stay out of logs.

## Money

Money is `Decimal` in Python and `NUMERIC(12,2)` in the database. Quantize with
`quantize_money()` at the logic boundary before building a response model, or
the JSON carries float noise. Pricing regresses silently, so tests assert exact
`Decimal` values at the boundaries (threshold - 1, threshold, and 1).

## Auth

`logic/v1/auth.py` issues HS256 JWTs signed with `JWT_SECRET_KEY` and hashes
passwords with bcrypt. bcrypt rejects passwords over 72 bytes, so validate the
length at the Pydantic boundary to return a 422, not a 500.

## Testing

- `tests/conftest.py` builds an in-memory SQLite database seeded from
  `tests/factories.py` and an `AsyncClient` over `create_app()` with
  `get_app_state` overridden. Tests never touch a database file.
- Config lives in `pytest.ini` under `[pytest]`, so `[tool.pytest.ini_options]`
  in `pyproject.toml` would be silently ignored. `asyncio_mode = auto` means
  async tests need no decorator.

## Gotchas

- **Alembic owns the schema.** `create_all` creates tables without stamping a
  revision, and the next `alembic upgrade` then fails on existing tables. Only
  tests use `create_all`.
- A new model must be imported in `migrations/env.py`, or autogenerate sees
  nothing and writes an empty migration.
- The local database is `denthub.db` in `backend/`. Seed the demo catalogue with
  `uv run python -m app.scripts.seed_products`.
- **Apple Silicon:** SQLAlchemy only pulls in `greenlet` for some CPU names, and
  `arm64` is not one of them. Without it every async DB call fails with "the
  greenlet library is required". Depending on `sqlalchemy[asyncio]` fixes it;
  until then, `uv pip install greenlet`.
