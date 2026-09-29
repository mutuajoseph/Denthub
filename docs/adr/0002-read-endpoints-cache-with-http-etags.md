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
