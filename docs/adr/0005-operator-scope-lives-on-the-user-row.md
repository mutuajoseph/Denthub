# Operator scope lives on the user row (accepted)

## Status
Accepted

## Context
PRD §2 gives a Platform Operator one Division (Jobs, Shop, Training, Dentist,
International, Suppliers) at a Lead or Assistant tier, and says they work from
`/operations` (#83). The rest of the platform's authorization already lives on
the `users` row: `role`, `account_status`, `is_active`, `facility_id`. Staff
tokens carry `scope=staff` and a role claim (ADR 0004) but no Division or tier.

Three shapes were possible:

1. Two nullable columns on `users` (`operator_division`, `operator_tier`).
2. A separate `operators` table joined to `users`.
3. Division and tier as claims in the staff token.

The console has to answer "may this account write here?" on every request, and
a revoked Division must stop working immediately rather than at the next token
refresh.

## Decision
Store an Operator's Division and tier as two nullable enum columns on `users`,
and read them from the row on each `/operations` request:

- `operator_division` is one of `jobs`, `shop`, `training`, `dentist`,
  `international`, `suppliers`; `operator_tier` is `lead` or `assistant`.
- Both are null for every non-operator. A `platform_operator` with either value
  null is refused with `403` rather than treated as a wider scope.
- The server, never request input, decides scope. Cross-Division reads and
  writes are refused before any row is queried; an Assistant may read their
  Division and a Lead may write to it.
- Reads are fresh, so promoting, demoting, or revoking an Operator takes effect
  on the next request. No second source of truth exists.

## Rationale
- The columns sit beside the authorization data the platform already trusts and
  need no join on every request.
- Fresh reads satisfy "revocation is immediate"; a token claim would keep a
  stale Division alive until it expires.
- Nullable columns are an additive migration: old code tolerates the new
  schema, and a non-operator row is unchanged.
- A separate table would add a lifecycle (one row per operator, deletion rules)
  without buying anything this role needs yet.

## Consequences
- **Pros:** One source of truth, immediate revocation, a trivial query, and a
  schema that matches the existing `role` + `facility_id` pattern.
- **Cons:** Assignment currently needs a database write because the admin users
  screen is deferred; there is no API that sets the pair. The wire vocabulary
  is lowercase while the PRD writes the Divisions capitalized (the UI supplies
  the labels).
- **Mitigations:** `CONTEXT.md` defines the terms; the migration and
  `backend/app/logic/v1/operations.py` document the null-means-no-scope rule.
  Assigning an Operator through the admin console becomes a follow-up issue.

## Implementation notes
- Backend: `app/repositories/user.py` (columns and the `OperatorDivision` /
  `OperatorTier` literals), `app/logic/v1/operations.py` (gate, Division
  scoping, Lead-only writes), `app/routes/v1/operations.py`, migration
  `4b75c2480490`.
- A write also appends an `admin_audit_log` row with the operator's role, so
  operator and Admin moderation share one trail.
- Frontend: `auth/roles.ts` already maps `platform_operator` to `/operations`;
  the screen lives in `pages/OperationsDashboard.tsx`.
- Tests: `tests/test_operations_api.py`, `pages/OperationsDashboard.test.tsx`.

## Follow-up
- Add Division/tier assignment to the admin users screen when it is scheduled.
- Revisit if an Operator ever spans more than one Division; that changes the
  columns to a join table.
