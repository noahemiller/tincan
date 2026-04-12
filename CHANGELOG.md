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
- Web MVP (React + Vite shell with auth, server/channel/message flows)
- Docker Compose stack and setup/version documentation
