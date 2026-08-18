# Conventional Commits Reference

Source: https://www.conventionalcommits.org/

## Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

## Types

| Type | When to use |
|---|---|
| `feat` | A new feature visible to users |
| `fix` | A bug fix visible to users |
| `docs` | Documentation changes only |
| `style` | Formatting, missing semicolons — no logic change |
| `refactor` | Code restructure with no feature change or bug fix |
| `test` | Adding or fixing tests — no production code change |
| `chore` | Build process, dependency updates, tooling |
| `ci` | CI/CD configuration changes |
| `perf` | Performance improvements |
| `build` | Build system or external dependency changes |

## Scope

Optional. Use the affected module, package, or feature area.
Examples: `auth`, `api`, `ui`, `db`, `pricing`, `receipting`

## Breaking Changes

Append `!` after type/scope, or add `BREAKING CHANGE:` in the footer:
```
feat(auth)!: drop support for cookie-only sessions

BREAKING CHANGE: clients relying on cookie auth must migrate to Bearer tokens
```

## Examples

```
feat(suppliers): add bulk create endpoint with per-row validation
fix(receipting): handle duplicate scan gracefully instead of erroring
docs(api): document rate limit headers on list endpoints
chore: upgrade SQLAlchemy to 2.0.38
refactor(pricing): extract candidate selection into its own module
test(auth): add coverage for expired JWT handling
ci: add mypy strict checks to PR workflow
```

## Rules

- Summary is imperative, present tense: "add feature" not "added feature"
- No capital letter at the start of the summary
- No period at the end of the summary
- Keep the summary under 72 characters
- If it fits in one line, skip the body
