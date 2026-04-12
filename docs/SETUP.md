# Setup Guide

## Prerequisites

- Docker + Docker Compose

## Quick start

1. Copy env template:
   - `cp .env.example .env`
2. Install deps once on host:
   - `corepack pnpm install`
3. Start stack:
   - `docker compose up --build`
4. Open:
   - Web: `http://localhost:5173`
   - API health: `http://localhost:4000/api/health`

## Permissions Matrix Test

- Run: `pnpm test:permissions`
- Optional target override: `API_BASE_URL=http://localhost:4000 pnpm test:permissions`

## Notes

- API runs versioned SQL migrations on startup from `apps/api/sql/migrations`.
- This is a development-oriented Compose file and expects dependencies to already be installed in the workspace.
