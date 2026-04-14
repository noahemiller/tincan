# Discord Migration Size Report

Use this when you want a concrete migration estimate before building an importer.

## What it measures

- Total messages across message-capable channels
- Total attachment count
- Total attachment bytes (and GiB)
- Per-channel breakdown (sorted by message volume)
- Approximate member count (from guild metadata)

## Prerequisites

1. Create a Discord bot in the Developer Portal.
2. Invite it to the target server with at least:
   - `View Channels`
   - `Read Message History`
3. Get:
   - Bot token (`DISCORD_BOT_TOKEN`)
   - Server (guild) ID (`DISCORD_GUILD_ID`)

## Run

From the repo root:

```bash
DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN" \
DISCORD_GUILD_ID="YOUR_GUILD_ID" \
node scripts/discord-size-report.mjs
```

Or via npm script:

```bash
DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN" \
DISCORD_GUILD_ID="YOUR_GUILD_ID" \
pnpm discord:size
```

## Output

A JSON report is written to:

`reports/discord-size-<guildId>-<timestamp>.json`

Use this report to estimate:

- Initial migration runtime
- Storage requirements
- Which channels are highest-risk / highest-volume

## Notes

- Channels the bot cannot read are marked `inaccessible`.
- The script handles Discord `429` rate limits automatically.
- For very large servers, expect the scan to take a while.
