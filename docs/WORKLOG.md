# Worklog

## 2026-04-12

- Initialized empty repository as Tincan monorepo
- Added foundational docs, roadmap, architecture, and ADRs
- Prepared for API and web MVP implementation
- Implemented API MVP in `apps/api` with schema bootstrap and core routes
- Added custom slash command APIs and command expansion on message create
- Added command management forms in web UI (user + server scopes)
- Added thread APIs and thread reply UI panel
- Added channel upload endpoint and attachment rendering in chat
- Added channel preference API and mode/snooze controls in UI
- Validated with `pnpm -r typecheck`, `pnpm -r build`, and Docker Compose config check
- Fixed Docker dev startup race by removing concurrent in-container installs from `api` and `web` commands
- Added search API + UI for server/channel message lookup
- Added link preview batch fetch API and automatic URL preview upsert on message ingest
- Added library item ingestion (urls + media), collections APIs, and collection UI baseline
- Replaced startup schema bootstrap with versioned SQL migrations runner (`schema_migrations`)
- Added auth session model with rotating refresh tokens, logout/logout-all endpoints, and login attempt throttling
- Added invites table + APIs and invite-accept server join flow
- Added owner/admin/member role constraints and admin-gated operations (channels, server commands, public collections)
- Added owner-only endpoint to promote/demote member roles
- Added automated permissions matrix integration script (`apps/api/scripts/permissions-matrix.ts`)
- Implemented web MVP in `apps/web` with auth and channel/message UI
- Added Docker Compose for app + postgres + redis
- Added API and setup docs plus version tracking
- Validation status: runtime checks blocked in this environment (`docker`, `node`, and `pnpm` are unavailable in sandbox)
