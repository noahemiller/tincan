# API Surface (MVP)

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/me`

## Servers + Channels

- `GET /api/servers`
- `POST /api/servers`
- `GET /api/servers/:serverId/members`
- `PUT /api/servers/:serverId/members/:memberUserId/role`
- `GET /api/servers/:serverId/invites`
- `POST /api/servers/:serverId/invites`
- `DELETE /api/servers/:serverId/invites/:inviteId`
- `GET /api/invites/:code`
- `POST /api/invites/:code/accept`
- `GET /api/servers/:serverId/channels`
- `POST /api/servers/:serverId/channels`

## Messages + Reactions

- `GET /api/channels/:channelId/messages`
- `POST /api/channels/:channelId/messages`
- `POST /api/messages/:messageId/reactions/toggle`
- `GET /api/messages/:messageId/thread/messages`
- `POST /api/messages/:messageId/thread/messages`
- `POST /api/channels/:channelId/uploads`

## Custom Slash Commands

- `GET /api/me/commands`
- `POST /api/me/commands`
- `GET /api/servers/:serverId/commands`
- `POST /api/servers/:serverId/commands`

## Read + Unread

- `POST /api/channels/:channelId/read`
- `GET /api/unread`
- `GET /api/channels/:channelId/preferences`
- `PUT /api/channels/:channelId/preferences`

## Search

- `GET /api/search/messages?q=...&serverId=...&channelId=...`
- Search results are ranked with Postgres full-text relevance and recency fallback

## Link Previews

- `POST /api/link-previews/batch`
- Preview rows are refreshed in background based on `next_refresh_at` with retry backoff after fetch failures

## Library + Collections

- `GET /api/library/items?serverId=...&channelId=...`
- `GET /api/library/collections?serverId=...`
- `POST /api/library/collections`
- `GET /api/library/collections/:collectionId/items`
- `POST /api/library/collections/:collectionId/items`
