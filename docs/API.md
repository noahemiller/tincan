# API Surface (MVP)

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`

## Servers + Channels

- `GET /api/servers`
- `POST /api/servers`
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

## Link Previews

- `POST /api/link-previews/batch`

## Library + Collections

- `GET /api/library/items?serverId=...&channelId=...`
- `GET /api/library/collections?serverId=...`
- `POST /api/library/collections`
- `GET /api/library/collections/:collectionId/items`
- `POST /api/library/collections/:collectionId/items`
