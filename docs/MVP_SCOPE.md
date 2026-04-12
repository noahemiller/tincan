# MVP Scope (Chosen)

Date: 2026-04-12

This scope was selected to maximize a usable private-community chat baseline quickly.

## Included in MVP

1. Account registration and login
2. Profile baseline fields (`name`, `handle`, `email`, optional `avatar_url`, optional `bio`)
3. Server creation and membership model
4. Channel creation and listing per server
5. Message posting and retrieval by channel
6. Emoji reaction toggle
7. Custom slash commands (user and server scope) with command expansion at message send time
8. Per-channel read watermark endpoint + unread summary query
9. Docker-first local deployment

## Deferred

1. Threads and deep reply UX
2. Slash commands and custom command execution
3. Rich media upload, OGP scraping, and gallery/library UI
4. Notification modes UI and timed snoozes
5. Full-text search
6. AI librarian metadata generation
7. Federation and module marketplace

## Rationale

- Establishes core social loop: join -> channel -> message -> catch up
- Creates stable schema primitives that later features can reuse
- Keeps implementation small enough to iterate rapidly with frequent commits
