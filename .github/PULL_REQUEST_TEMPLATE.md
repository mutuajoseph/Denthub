## Description

<!-- What changed and why. Link the relevant issue or PRD section (docs/PRD.md §…). -->

## Type of change

<!-- Match the Conventional Commits type in the PR title. -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` / `chore` — no behaviour change
- [ ] `ci` / `build` — tooling or pipeline

## Screenshots

<!-- UI change? Add before/after (light AND dark theme). Otherwise: "Not applicable: <reason>". -->

Not applicable:

## Checklist

- [ ] PR title follows Conventional Commits (it sets the release version) and the body says `Closes #N`
- [ ] Definition of done passes for each side touched: lint, format, types, build, **and tests** (see `AGENTS.md`)
- [ ] Schema change? The `AGENTS.md` schema checklist is done (migration, single Alembic head, factories + seed, client types)
- [ ] API contract change? Matching types in `frontend/src/lib/` updated in this PR
- [ ] New route? Its allowed roles were confirmed with the maintainer
- [ ] No secrets or credentials committed; new secrets added to `render.yaml` + `docs/RELEASE.md`
- [ ] Docs updated (`AGENTS.md` / `CONTEXT.md` / `docs/`) if behaviour, terms, or setup changed
