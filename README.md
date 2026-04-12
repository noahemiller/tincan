<<<<<<< HEAD
# tincan
repo for tincan social app
=======
# Tincan

Tincan is a private, self-hostable chat platform experiment inspired by Discord/Slack, built for small trusted communities.

## Current status

This repository is being built iteratively with architecture-first documentation and frequent, auditable commits.

Implemented now:
- Backend MVP API with auth, servers/channels, messages, reactions, and unread summary
- React web MVP for account/session, server/channel navigation, and messaging
- Docker Compose stack for Postgres + Redis + API + Web
- ADR and version tracking docs

## Monorepo layout

- `apps/api` - backend API and realtime gateway
- `apps/web` - frontend client (React + Vite)
- `packages/config` - shared TypeScript and lint config fragments
- `docker` - Dockerfiles and helper assets
- `docs` - specs, decisions, roadmaps, and work logs

## Principles for v1

- Single-server first (no federation in v1)
- Self-hosted and Docker-first
- Strong docs and changelog discipline
- Extensible architecture for plugins/modules later
<<<<<<< HEAD
>>>>>>> c0fd2e4 (chore: initialize Tincan monorepo and docs baseline)
=======

## MVP API endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/servers`
- `POST /api/servers`
- `GET /api/servers/:serverId/channels`
- `POST /api/servers/:serverId/channels`
- `GET /api/channels/:channelId/messages`
- `POST /api/channels/:channelId/messages`
- `POST /api/messages/:messageId/reactions/toggle`
- `GET /api/messages/:messageId/thread/messages`
- `POST /api/messages/:messageId/thread/messages`
- `POST /api/channels/:channelId/uploads`
- `GET /api/me/commands`
- `POST /api/me/commands`
- `GET /api/servers/:serverId/commands`
- `POST /api/servers/:serverId/commands`
- `POST /api/channels/:channelId/read`
- `GET /api/unread`
- `GET /api/channels/:channelId/preferences`
- `PUT /api/channels/:channelId/preferences`
- `GET /api/search/messages`
- `POST /api/link-previews/batch`
- `GET /api/library/items`
- `GET /api/library/collections`
- `POST /api/library/collections`
- `GET /api/library/collections/:collectionId/items`
- `POST /api/library/collections/:collectionId/items`

## Run locally

See [`docs/SETUP.md`](docs/SETUP.md).
>>>>>>> cc648c1 (feat(web+infra): add React MVP client, docker compose stack, and runbooks)
