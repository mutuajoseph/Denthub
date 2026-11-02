# Auth token storage in localStorage (accepted for MVP)

## Status
Accepted for the MVP; **superseded for session storage by the follow-up below**
(#121). The access token is no longer persisted — see the Addendum.

## Context
The frontend currently persists the access token in localStorage so the API
client can attach "Authorization: Bearer <token>" (see
frontend/src/lib/auth.ts and frontend/src/lib/apiClient.ts). Storing tokens in
localStorage exposes them to XSS; a malicious script running in the browser can
read and exfiltrate them. Cookies (httpOnly, Secure, SameSite) with refresh
tokens mitigate XSS but require CSRF protection, CORS/credentials configuration
and backend changes to set/read cookies.

The PRD §6 ("Auth and security") anticipates a JWT-bearer-plus-cookie model.
The present implementation keeps the bearer token in localStorage for the MVP
to avoid cookie complexity until the full session/refresh design is done.

## Decision
Accept localStorage token storage for the MVP. Track the follow-up work below
and document the residual risk until a cookie-based refresh flow is
implemented.

## Consequences
- **Pros:** Simple, works with the existing client code and SSR-free SPA; no
  CSRF surface added now; easy to test.
- **Cons:** XSS can read tokens; tokens survive across tab close/reload (as
  intended) but are exposed to scripts. Not suitable for long-lived refresh
  tokens without extra controls.
- **Mitigations:** Maintain CSP/escape-first rendering, avoid injecting
  untrusted HTML, and use HTTP-only cookies for refresh tokens before raising
  token lifetime or allowing sensitive operations.

## Follow-up
1. Move the refresh token to an httpOnly, Secure, SameSite cookie and return
   short-lived access tokens only. Set cookies on login/refresh from the
   backend.
2. Adjust the client so it reads the access token from a safer source (e.g.
   in-memory) and updates on refresh; stop writing the access token to
   localStorage if not strictly necessary.
3. Add CSRF protection (e.g. double-submit or SameSite) as part of step 1.
4. Revisit token lifetimes and logout on XSS detection where feasible.

## Addendum (#121): the follow-up is delivered

Steps 1–3 are now in place, so the MVP decision above no longer describes the
running system.

- **Access token**: 15 minutes, held **in memory** by the client. It is no
  longer written to localStorage; a page reload recovers it through refresh.
- **Refresh token**: a JWT signed with its own `REFRESH_TOKEN_SECRET` (a second
  secret, so an access-token compromise cannot mint refresh tokens), delivered
  only in an `HttpOnly`, `Secure` (production), `SameSite=Lax` cookie. One
  cookie name and one narrow `Path` per surface: `denthub_refresh` on
  `/api/v1/auth`, `denthub_staff_refresh` on `/api/v1/auth/staff`.
- **Rotation and reuse detection**: each refresh token's `jti` is a row in
  `refresh_tokens` with its `family_id`. Refreshing revokes the presented row
  and issues a new one in the same family; presenting a revoked row is treated
  as theft and revokes the whole family. Logout revokes the family.
- **CSRF (step 3)**: `SameSite=Lax` on a POST-only, narrowly-pathed cookie.
  Because a Lax cookie is not sent on a cross-site POST, a third-party page
  cannot drive `/refresh` or `/logout`; no separate double-submit token is
  needed. Revisit if the API is ever called from another origin.
- **Consequences**: an XSS bug can still act as the user while its page is
  open (any in-memory token can), but it can no longer read a long-lived
  credential from storage or survive the tab. Refresh tokens are revocable
  server-side, which is the property localStorage could not offer.
