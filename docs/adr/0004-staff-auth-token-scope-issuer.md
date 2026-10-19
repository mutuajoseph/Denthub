# Staff auth token scope and issuer (accepted)

## Status
Accepted

## Context
Issue #80 requires a separate auth surface for platform staff (Admins and
Operators) at `/staff/access`. The backend currently issues JWTs with the same
signing secret and a minimal claim set (sub, role, iat, exp). Staff tokens must
be distinguishable from public tokens without leaking implementation details, so
a staff route can reject a public token even if the user is a staff role. The
umbrella rules (root `AGENTS.md`, "Auth and security") and PRD §6 call for a
second auth surface with its own token scope or issuer, sharing the same users
table for the MVP.

## Decision
Mint staff tokens with:

- `iss` (issuer): `denthub-staff`
- `scope`: `staff`

Public tokens continue to include:
- `iss` (issuer): `denthub-public`
- `scope`: `public`

Both token kinds are signed with the same `JWT_SECRET_KEY` and stored in the
same localStorage key by the frontend. The staff-only routes (e.g.
`/auth/staff/me`) require the `scope == "staff"` claim; the presence of the
right `iss` is recorded but not strictly enforced on decode for the MVP.

Only platform staff roles may use the staff surface: `admin`, `super_admin` and
`platform_operator` (`STAFF_SURFACE_ROLES`). The generic `staff` role signs in
publicly and cannot obtain a staff token via `/auth/staff/login`.

## Rationale
- Separate `iss` + `scope` claims are unambiguous and straightforward to verify
  in logic (no need for a second secret/algorithm at this point).
- Same users table keeps the data model simple; granting/role changes apply to
  both surfaces.
- Follows the least-invasive change consistent with the acceptance criteria
  while leaving room to move to separate secrets/cookies in a future ADR (see
  ADR 0003 on token storage).

## Consequences
- **Pros:** Clear token distinction, auditable via claims, easy to test, no
  schema migration required.
- **Cons:** Same signing key for both surfaces (acceptable for MVP; can be
  split later). If a staff token is leaked, it is still a JWT signed with the
  shared key; scope verification still blocks misuse on non-staff routes that
  enforce scope.
- **Mitigations:** Staff routes enforce `scope == "staff"` and also re-check the
  user's stored role; the `iss` is set for future migration. Existing public
  tokens remain valid (backward compatible), since `scope`/`iss` are new
  claims.

## Implementation notes
- Backend: `app/logic/v1/auth.py` adds `STAFF_TOKEN_ISSUER`, `PUBLIC_TOKEN_ISSUER`,
  `STAFF_SCOPE`, `PUBLIC_SCOPE`, `STAFF_SURFACE_ROLES`; `create_access_token()`
  accepts `scope` (default `public`); `login_staff()` mints staff tokens and
  rejects non-surface staff roles; `get_current_staff()` requires `scope==staff`.
- Frontend: `frontend/src/lib/auth.ts` adds `loginStaff()` calling
  `/auth/staff/login`; `frontend/src/pages/StaffAccessPage.tsx` provides the
  standalone `/staff/access` surface. The token is stored under the same key as
  public auth.
- Tests: `tests/test_staff_auth_api.py` covers staff login, rejection of public
  accounts/generic staff, and scope-based rejection on `/auth/staff/me`.

## Follow-up
- Revisit token issuance if we introduce separate signing keys or httpOnly
  cookies (ADR 0003, point 1).
- Consider adding issuer verification in `decode_access_token()` when token
  kinds diverge further.
