# DentHub

DentHub is a multi-sided dental marketplace (patients, facilities and dentists,
suppliers, training providers, job seekers), Kenya-first and multi-country by
design. This repo holds the FastAPI backend (`backend/`) and the React/Vite
client (`frontend/`); each has its own `AGENTS.md` with that side's rules. Read
the relevant one before editing there.

`CLAUDE.md` in each directory is a symlink to its `AGENTS.md`. Edit `AGENTS.md`.

The product spec is [`docs/PRD.md`](docs/PRD.md). Read it before any domain
modelling, new entity, or role/permission work. It defines the roles, entities,
and multi-country constraints the architecture has to serve. Where the code and
the PRD disagree, raise it with the user rather than silently picking one.

## Agent skills

Engineering skills are vendored in [`.claude/skills/`](.claude/skills/) (mostly
[Matt Pocock's](https://github.com/mattpocock/skills); see its `README.md`).

### Issue tracker

GitHub issues on `mutuajoseph/Denthub`, driven with `gh`. See
[`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

The default five-label vocabulary. See
[`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context: `CONTEXT.md` glossary and `docs/adr/` at the root. See
[`docs/agents/domain.md`](docs/agents/domain.md).

### Workflow gates

- Use `create-pr` before opening a pull request.
- Use `tdd` when fixing a bug: the fix lands with a test that was red first.
- Use `domain-modeling` when a term or a hard-to-reverse decision gets settled,
  so it lands in `CONTEXT.md` or `docs/adr/`.

## Environments

| Environment | Where it runs | How it gets there |
|---|---|---|
| Local | your machine, SQLite `backend/denthub.db` | `pnpm run dev` |
| Preview | Vercel preview URL, frontend only | every PR, automatically |
| Production | Vercel (frontend) + Render (backend, Postgres) | every merge to `main` |

Always know which environment a request is about. Local is the only place to
mutate freely. Treat Production as read-only unless the user explicitly asks for
a write. **Every merge to `main` is a production release** (tag, then deploy,
with migrations run first), so merge, re-run a release, or touch deploy secrets
only on the user's explicit say-so. Release mechanics:
[`docs/RELEASE.md`](docs/RELEASE.md).

## Issues

**No implementation work starts without an approved GitHub issue.** Search the
open issues for a match and propose it. Finding a plausible match is not
approval: the user has to say yes to that specific issue.

Needs an issue: anything intended to become a commit on a branch that will open
a PR. Does not need one: reading, searching, diagnosis, scratch scripts,
answering questions, reviewing PRs, and writing plans. **Production incidents**
are the exception to the ordering: fix first, then file the issue, always before
the PR opens.

### Creating an issue

- Confirm the title, description, and acceptance criteria with the user first.
  Once approved, create it without asking again.
- **Write the description for two readers.** Open with a short plain-language
  paragraph (the problem, and why it matters). Then give enough detail that the
  issue link is a sufficient brief on its own: an agent handed only that URL
  should be able to do the work. Name the files, tables, and PRD sections rather
  than alluding to them.
- **Ask who it should be assigned to.** Do not default to whoever is in the chat.
- Apply labels that already exist (`gh label list`) and say which you applied.
  Propose a new label only with a reason, and create it only after approval.
- Work too big for one PR becomes a parent issue with sub-issues, one per
  PR-sized unit in merge order. Offer the breakdown; create it after approval.

### Working from an issue

- **The issue is a brief, not ground truth.** Validate every claim in it against
  the code and the PRD before implementing. Where it is wrong, comment on the
  issue with what is actually true instead of quietly implementing around it.
- Adjacent work found mid-issue gets its own issue. Keep each issue's scope to
  what was approved.
- Closing an issue needs the user's explicit say-so. A merge or a release is not
  that signal.

## Branches, commits, and PRs

- Branch off `main` as `feat/<slug>` or `fix/<slug>` (`docs/`, `chore/`, `ci/`
  likewise). Reference the issue number in the PR body (`Closes #N`).
- **The PR title is a Conventional Commit** and it sets the release version:
  `feat:` is minor, `fix:`/`chore:`/`docs:` are patch, `feat!:` is major.
- **Squash-merge only.** The release job reads the squashed commit subject; a
  merge commit ("Merge pull request #N") makes every release a patch.
- Put `[skip release]` in the squash message for docs- or CI-only changes that
  should not ship.
- Commits carry no `Co-Authored-By: Claude` trailer. This is the maintainer's
  explicit rule and overrides tool defaults.
- `origin` is `git@github-personal:mutuajoseph/Denthub.git`. The
  `github-personal` SSH alias authenticates as **mutuajoseph**; this machine's
  default `github.com` key is a different account with no access here. Push
  through `origin` as configured.

## Definition of done

A change is done when every command below passes for the side(s) it touched,
run from the repo root. The first five mirror CI exactly. CI does not run the
tests yet, so running them is on you.

```bash
uv run --directory backend ruff check app
uv run --directory backend ruff format --check app
uv run --directory backend mypy app
pnpm --filter frontend exec biome check .
pnpm --filter frontend build          # tsc + vite; the real type gate
uv run --directory backend pytest -q
pnpm --filter frontend test
```

If a change edits dependencies, commit the regenerated lockfile (`uv.lock` or
`pnpm-lock.yaml`). CI installs with `--frozen` and fails on drift.

## The API contract

- The client calls relative `/api/v1/...` paths only. Vite proxies `/api` in
  dev (to `BACKEND_PORT`, default 8000). `frontend/vercel.json` rewrites it to
  Render in production, so the browser stays same-origin.
- Every error response is `{ code, message, detail? }` (`OpenApiErrorResponse`).
- Backend Pydantic models are the source of truth. A change to a response model
  updates the matching TypeScript type in `frontend/src/lib/` **in the same PR**.
- **Money is exact decimal end to end.** The backend uses `Decimal` /
  `NUMERIC(12,2)` and serialises amounts as strings; the client keeps them exact
  (integer minor units or a decimal library) when multiplying or summing.
- **Country and currency are inputs to every catalogue request** (PRD §5–6). A
  new endpoint takes `Accept-Country` into account from day one, and a client
  cache key includes every input the request reads, country included.

## Auth and security

- **A user's role is set by the server, never taken from request input.** Public
  signup creates only the public account types (PRD §2); staff roles are granted
  by staff.
- **New routes default to role-gated.** Ask the user which roles may call a new
  route; never pick the roles yourself.
- Secrets come from the environment. Production refuses to start without them
  rather than falling back to a dev default. Add each new secret to
  `render.yaml` (`sync: false`) and `docs/RELEASE.md`.
- Log connection strings and tokens only in redacted form.

## Schema changes

Any change that adds, renames, drops, or repurposes a table, column, or enum
runs this whole checklist. Check every item before calling the plan done.

1. **Migration.** `alembic revision --autogenerate`, import new models in
   `backend/migrations/env.py`, then read the generated file end to end.
2. **Forward-only.** A migration already on `main` is never edited; fix it with
   a new migration. Render runs `alembic upgrade head` *before* new code goes
   live, so the old code must tolerate the new schema: use expand, migrate,
   contract across releases for renames and drops.
3. **One head after merging `main`.** Run `uv run --directory backend alembic
   heads`. If there are two, re-point your migration's `down_revision` at
   `main`'s head.
4. **Seed and fixtures.** Update `backend/tests/factories.py` and
   `backend/app/scripts/seed_products.py` in the same PR.
5. **Contract.** Update the client types (see "The API contract").

## Domain language

Use the terms in [`CONTEXT.md`](CONTEXT.md) in code, issues, PR titles, and test
names, and avoid the synonyms it lists. Hard-to-reverse decisions are recorded
in [`docs/adr/`](docs/adr/). If your work contradicts an ADR, say so explicitly.
