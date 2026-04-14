# Channel Module Config (Per Channel)

Channel-level module tuning is available in the channel settings accordion (gear icon in chat header).

## What you can configure

- Notification mode + snooze (existing)
- Module toggles:
  - Dice
  - Survey
  - Music embeds
  - Link previews
  - Thread replies
- UI toggles:
  - Show avatars
  - Message density (comfortable/compact)
  - Corner radius (0-96)
  - Border thickness (0-24)
  - Channel color theme (toggle + 4-color palette):
    - Background 1
    - Background 2
    - Main color
    - Highlight
    - Text
    - Border
- Notification behavior:
  - Auto-mark read at bottom
  - Show unread badge

## Import / Export

- `Download` exports JSON for the currently selected channel.
- `Upload` imports JSON and applies it to the currently selected channel.
- Config is also persisted in browser local storage.

## File format

Top-level object:

- `format`: `tincan-channel-module-config-v1`
- `exportedAt`: ISO datetime
- `channelId`: source channel id
- `channelName`: source channel name
- `config`: channel config payload

For compatibility, importer accepts either full wrapper object or raw `config` payload.
