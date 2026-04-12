# Changelog

All notable changes to this project are tracked here.

## [0.1.0] - 2026-04-12

### Added
- Initial monorepo scaffold for Tincan
- Documentation baseline (architecture, roadmap, decisions, ADR framework)
- Backend API MVP (auth, servers, channels, messages, reactions, unread)
- Added custom slash command support (user + server scoped)
- Added basic command management UI in web client
- Added thread endpoints and web thread panel
- Added file upload pipeline and message attachments
- Added channel notification preference APIs and UI controls
- Added message search endpoint and web search panel
- Added OGP-style link preview fetching and inline message preview cards
- Added library items + collections API baseline and web collection tooling
- Added versioned SQL migrations runner with tracked migration history
- Added auth hardening: rotating refresh sessions, logout endpoints, and login attempt throttling
- Added invite link lifecycle APIs (create/list/revoke/accept + preview)
- Added role-gated authorization rules for admin/owner actions
- Added basic web UI for invite creation/join and member visibility
- Added executable permissions matrix integration test script
- Improved web viewport stability and form autocomplete behavior
- Fixed chat row sizing and sidebar overflow in wide layouts
- Added collapsible right-sidebar panels and tighter message feed density
- Swapped web theme to Glaucous/Periwinkle/Light Yellow/Banana Cream/Tomato palette
- Reduced control sizing across web UI (smaller radii, spacing, and component density)
- Moved channel mode/snooze controls into a gear-opened channel settings panel
- Added explicit profile chip in chat header and relocated app logout beside it
- Added per-channel unread count badges in channel list rows
- Added “Unread only” channel filter toggle and read/unread text contrast styling
- Fixed media posting regression by allowing image/file-only messages (without text body)
- Removed redundant right-rail unread summary block (now consolidated in channel list)
- Improved message search ranking using Postgres full-text search relevance + recency
- Added dedicated GIN full-text index for `messages.body`
- Added link preview refresh scheduler with expiry/retry metadata and exponential backoff
- Added first-column navigation tabs (`Servers`, `DMs`, `Channels`) so server management is not always expanded
- Kept library controls in right rail (deferred moving library into channel-column tabs)
- Switched first column to compact Discord-style icon rail controlling panel content in the second column
- Moved message search to middle-column toolbar above chat and removed duplicate right-rail search panel
- Added middle-column Library toggle that swaps chat area into a starter library workspace
- Added OGP preview thumbnails when `og:image` metadata is available
- Web MVP (React + Vite shell with auth, server/channel/message flows)
- Docker Compose stack and setup/version documentation
