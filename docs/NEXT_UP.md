# Next Up (Near-Term)

## Priority sequence

1. Improve search relevance and add dedicated Postgres full-text indexes
2. Add OGP refresh/expiry jobs and failure retry strategy
3. Add collection item curation UX (bulk select, remove, reorder, filters)
4. Add library taxonomy editing and validated-vs-suggested metadata states

## Hardening

1. Move from startup schema bootstrap to explicit versioned migrations
2. Add integration tests around auth and channel authorization
3. Add rate limiting and brute force protection for auth endpoints
4. Add refresh token/session revocation model
