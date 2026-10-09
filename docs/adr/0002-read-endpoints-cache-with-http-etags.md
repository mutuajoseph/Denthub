# Read endpoints cache with HTTP ETags, not Redis

Read endpoints serve `Cache-Control` and `ETag` headers so the browser and the
Vercel CDN absorb repeat traffic, and the client keys its TanStack Query cache on
every input the request reads — country, currency, and language included. No
server-side cache is added yet. PRD §7 places "Redis caching/queues" out of MVP
scope as investor narrative, and an in-process TTL cache on `AppState` would be
per-worker and lost on every deploy, so it buys no CDN offload anyway. This is
revisit-able: the responses are already built from small immutable objects, so
swapping `ETag` for a Redis `Vary`-aware key is a middleware change, not a
rewrite.

Client cache keys currently omit country and currency
(`frontend/src/hooks/useProductSearch.ts`), so switching region served the
previous country's prices. That is the bug this decision has to fix, not just
avoid.

## Implementation (issue #23)

A `HttpCacheMiddleware` (`backend/app/middleware/http_cache.py`) applies to every
public GET answer; auth, users, and health are never publicly cached.

- **ETag** is a strong SHA-256 over the serialised body; a matching
  `If-None-Match` returns `304` with the cache headers and no body.
- **`Vary: Accept-Country, Accept-Currency, Accept-Language`** is always set, so
  a shared cache cannot serve one market's bytes to another.
- **Per-endpoint policy:** reference data under `/config/` is
  `public, max-age=300, must-revalidate`; every other read (listings, products,
  home, jobs, magazine, training) is `public, no-cache` — stored but revalidated
  on every read via its ETag.
- **Negotiation is presentation-only.** Money is never converted and labels are
  not re-translated; the response instead reflects the market it actually
  resolved to in `Content-Country`, `Content-Currency`, and `Content-Language`,
  so a client that asked for an unsupported market/currency/language fails
  honestly ("prices in KES") instead of quietly.
