# Next Up (Near-Term)

## Priority sequence

1. Add thread model and thread timeline endpoints
2. Add media uploads (S3-compatible object storage) and OGP enrichment jobs
3. Add channel notification mode APIs + UI (hidden/passive/active + temporary snooze)
4. Add search endpoint and indexed strategy (Postgres FTS first)

## Hardening

1. Move from startup schema bootstrap to explicit versioned migrations
2. Add integration tests around auth and channel authorization
3. Add rate limiting and brute force protection for auth endpoints
4. Add refresh token/session revocation model
