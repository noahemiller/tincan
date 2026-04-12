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

## Custom Slash Commands

- `GET /api/me/commands`
- `POST /api/me/commands`
- `GET /api/servers/:serverId/commands`
- `POST /api/servers/:serverId/commands`

## Read + Unread

- `POST /api/channels/:channelId/read`
- `GET /api/unread`
