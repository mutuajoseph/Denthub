---
name: create-pr
description: >
  Opens a draft GitHub pull request for the current branch. Runs this repo's
  pre-commit checks, grills the user on design decisions, collects screenshots,
  posts the review thread as a PR comment, and addresses feedback before handoff.
  Use when the user says "open a PR", "create a PR", "make a pull request",
  "ship this", or "prepare this for review".
argument-hint: "[branch-name]"
disable-model-invocation: true
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(pnpm *)
  - Bash(uv *)
  - Bash(make *)
  - Read
  - Write
  - Edit
---

# Create PR

Borrowed from the Faro engineering skills and adapted for this repo (DentHub —
FastAPI + React/Vite monorepo). Use when the user asks to open, create, publish,
or prepare a PR for the current branch.

## Required order

1. Gather branch/diff context.
2. Run this repo's **pre-commit checks** (below). Fix failures before continuing.
3. Choose a PR title that follows Conventional Commits.
4. Fill the PR body from `.github/PULL_REQUEST_TEMPLATE.md`.
5. Ask the user for screenshots (mandatory for any UI change).
6. Run the interactive **grill-with-docs** review session in this chat (hard gate).
7. Push the branch, open the PR **as a draft**.
8. Post the review discussion as a PR comment.
9. Address actionable feedback, push follow-ups, append resolution comments.

Do not skip pre-commit checks or the grill gate unless the user explicitly says to.

---

## 1. Gather context

```bash
git branch --show-current
git status --short
git fetch origin
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

If the default branch isn't `main`, use the real one:

```bash
git remote show origin | sed -n '/HEAD branch/s/.*: //p'
```

If the branch has no commits relative to the base branch, stop — there's no PR to open.

> **Push routing (this repo):** `origin` is `git@github-personal:mutuajoseph/Denthub.git`.
> The `github-personal` SSH alias authenticates as **mutuajoseph**; the machine's
> default `github.com` key is a different account with no write access. Always push
> through `origin` (never rewrite the URL to `github.com`), and never force-push a
> shared branch — a collaborator (Brenda-Wangechi) also pushes here, so `git fetch`
> and rebase first if the remote has moved.

---

## 2. Pre-commit checks (this repo)

Run the same checks CI runs (`.github/workflows/ci.yml`). From the repo root:

```bash
# Secrets: make sure nothing sensitive is staged
git diff --cached --name-only | xargs -I{} grep -nEI '(SECRET|PASSWORD|API_KEY|PRIVATE KEY|BEGIN.*PRIVATE)' {} 2>/dev/null || true

# Backend (ruff + mypy, strict)
uv run --directory backend ruff check app
uv run --directory backend ruff format --check app
uv run --directory backend mypy app

# Frontend (biome + typecheck + build)
pnpm --filter frontend lint
pnpm --filter frontend build

# Database (sqlfluff, postgres) — only if the PR touches SQL; no-op otherwise
sql=$(git diff --name-only origin/main...HEAD -- '*.sql'); [ -n "$sql" ] && uvx --from 'sqlfluff>=3,<4' sqlfluff lint $sql
```

Run narrower checks while iterating, but finish with the full set before opening the PR.
If a check fails, fix it — or clearly document the blocker and ask before continuing.

---

## 3. PR title — Conventional Commits

Choose the title before writing the body. Allowed shapes:

`feat(scope): …` · `fix(scope): …` · `docs(scope): …` · `refactor(scope): …` ·
`test(scope): …` · `chore(scope): …` · `ci(scope): …` · `perf(scope): …` · `build(scope): …`

Pick the type from the primary user-visible change. Scope is optional but helpful —
use the area touched: `backend`, `frontend`, `api`, `ci`, `deps`, or a domain module
(`patients`, `suppliers`, …). Never use a raw branch name, ticket number, or sentence
as the title. See `references/conventional-commits.md`.

---

## 4. PR body

Prefer the repo template:

```bash
cp .github/PULL_REQUEST_TEMPLATE.md /tmp/pr-body.md
```

Fill in Description (what & why), Screenshots (or "Not applicable" + reason), and the
Checklist honestly based on checks actually run. Fallback template: `templates/pr-body.md`.

---

## 5. Screenshots

Before opening the PR, prompt:

> Please drag and drop any screenshots you want attached to the PR — I'll put them in
> the Screenshots section.

For a UI change, screenshots are expected (light **and** dark theme when relevant, per
the frontend conventions). If there's no visual change, write "Not applicable" and say why.

---

## 6. Interactive review — grill-with-docs (hard gate)

**Do not open or update the PR until the user has answered the review questions.**

Invoke the vendored **`grill-with-docs`** skill (`.claude/skills/grill-with-docs/`) and
run it as a live session in this chat:

- Read nearby docs first: root/`backend`/`frontend` `CLAUDE.md`, `docs/PRD.md`, any ADRs.
- Challenge changed terminology, domain assumptions, and design decisions against the
  PRD and code. The PRD has explicit open questions (§8–9) — surface any the PR touches.
- Ask one question at a time, include your recommended answer, wait for each reply.
- If the codebase can answer, inspect code instead of asking.
- Capture the real Q&A thread in `/tmp/grill-with-docs-thread.md` — not a private summary.

---

## 7. Open the draft PR

Always open as **draft**, only after the review session has produced enough context.

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --draft --title "<conventional-commit-title>" --body-file /tmp/pr-body.md
```

If a PR already exists for the branch, update it:

```bash
gh pr view --json url,number,title
gh pr edit --title "<conventional-commit-title>" --body-file /tmp/pr-body.md
```

---

## 8. Post the review thread as a PR comment

```bash
gh pr comment --body-file /tmp/grill-with-docs-thread.md
```

Keep the comment URL/ID — you'll append resolutions to it.

---

## 9. Address feedback

For each accepted action: make the change, re-run the relevant checks, commit, push, and
append a resolution comment noting **what changed, the commit SHA, checks run, and any
deferred follow-up**. If nothing needs changing, say the feedback was reviewed and no
blocking issues were found.

```bash
gh pr comment --body-file /tmp/grill-resolution.md
```

---

## Final response

Return: PR URL · draft status · checks run + pass/fail · screenshots (or why N/A) ·
review-thread comment posted · feedback addressed + resolution comment.

---

## Gotchas

- **Don't skip the grill gate.** Opening the PR before the interactive session leaves an
  empty review thread. The PR body is much better when the Q&A is captured first.
- **Draft ≠ ready.** This skill always opens a draft. Marking "Ready for review" is the
  user's call after threads resolve — not part of this skill.
- **Push before `gh pr create`.** `gh pr create` targets the pushed branch; push with
  `-u origin` first or it fails / targets the wrong ref.
- **Wrong-account push.** If a push is denied ("Permission … denied to joseph-faro"),
  the URL got rewritten off the `github-personal` alias — restore
  `git@github-personal:mutuajoseph/Denthub.git` rather than switching to HTTPS.
- **Scope checks to `app`.** Backend ruff/mypy run against `app/` (not `.`) so they don't
  trip over Python snippets inside Markdown docs.
