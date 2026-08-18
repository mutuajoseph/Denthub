# Vendored Claude Code skills

These project-level skills are **vendored** (committed into the repo) so every
contributor gets them on clone — no marketplace, no per-machine setup. Claude Code
auto-discovers each `.claude/skills/<name>/SKILL.md` when working in this repo.

## Sources & license

Most skills come from Matt Pocock's collection; `create-pr` was borrowed from the
Faro engineering skills.

- **Matt Pocock:** [github.com/mattpocock/skills](https://github.com/mattpocock/skills) — MIT (see [`LICENSE`](LICENSE)), vendored at the commit in [`.source-commit`](.source-commit). Flattened from the upstream `skills/<category>/<name>/` layout to `.claude/skills/<name>/` (the path Claude Code discovers). Skills reference each other by name, so the flattening is transparent.
- **`create-pr`:** adapted from `faro-skills/skills/create-pr` — retargeted to this repo's checks (ruff/mypy + biome/build), the vendored `grill-with-docs` skill, and the `github-personal` push routing.

## What's included (curated for this stack)

All of Matt's **engineering** skills, plus git-safety and agent-writing helpers:

| Area | Skills |
|---|---|
| Plan / spec | `to-spec`, `to-tickets`, `domain-modeling`, `grill-with-docs`, `grilling`, `research`, `wayfinder` |
| Build | `implement`, `tdd`, `prototype`, `codebase-design`, `improve-codebase-architecture` |
| Debug / review | `diagnosing-bugs`, `triage`, `code-review`, `resolving-merge-conflicts` |
| Tooling / meta | `git-guardrails-claude-code`, `writing-for-agents`, `handoff`, `wizard`, `ask-matt` (skill router), `setup-matt-pocock-skills` |

**Deliberately excluded:** upstream `deprecated/*` and `in-progress/*` (unstable),
teaching/personal skills (`teach`, `scaffold-exercises`, `grill-me`, `to-questionnaire`,
`wait-what`), the TS-lib-specific `migrate-to-shoehorn`, and `setup-pre-commit`
(assumes Husky + Prettier — this repo uses Biome + ruff, so it would mislead).

## Updating / adding more

Re-vendor from upstream:

```bash
git clone --depth 1 https://github.com/mattpocock/skills.git /tmp/mp-skills
# copy the skill dir you want, flattened:
cp -R /tmp/mp-skills/skills/<category>/<name> .claude/skills/<name>
git -C /tmp/mp-skills rev-parse HEAD > .claude/skills/.source-commit
```

Start typing a task the skill covers (e.g. "diagnose this bug", "turn this into tickets")
and Claude will surface the matching skill.
