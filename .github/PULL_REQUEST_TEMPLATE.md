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

- [ ] PR title follows Conventional Commits
- [ ] Backend: `uv run --directory backend ruff check app` + `mypy app` pass
- [ ] Frontend: `pnpm --filter frontend lint` + `pnpm --filter frontend build` pass
- [ ] Follows the Route → Logic layering / typed-client conventions (see `CLAUDE.md`)
- [ ] No secrets or credentials committed
- [ ] Docs updated (`CLAUDE.md` / `README` / `docs/`) if behaviour or setup changed
