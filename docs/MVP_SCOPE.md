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
8. Thread replies (single thread depth per root message)
9. Media upload and message attachment linking (local storage in dev)
10. Per-channel read watermark endpoint + unread summary query
11. Channel preference mode + optional snooze (`hidden`, `passive`, `active`)
12. Docker-first local deployment
13. Message search endpoint + UI
14. Link preview extraction and preview metadata persistence
15. Library items and collections baseline (API + minimal UI)

## Deferred

1. Advanced relevance tuning and ranking for search
2. Library/gallery advanced UI and metadata pipelines
3. AI librarian metadata generation
4. Federation and module marketplace

## Rationale

- Establishes core social loop: join -> channel -> message -> catch up
- Creates stable schema primitives that later features can reuse
- Keeps implementation small enough to iterate rapidly with frequent commits
