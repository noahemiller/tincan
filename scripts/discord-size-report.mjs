#!/usr/bin/env node

/**
 * Discord migration size scanner.
 *
 * Usage:
 *   DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... node scripts/discord-size-report.mjs
 *
 * Optional:
 *   DISCORD_API_BASE=https://discord.com/api/v10
 *   DISCORD_DELAY_MS=250
 */

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const apiBase = (process.env.DISCORD_API_BASE || "https://discord.com/api/v10").replace(/\/+$/, "");
const delayMs = Number.parseInt(process.env.DISCORD_DELAY_MS || "250", 10);

if (!token || !guildId) {
  console.error(
    "Missing required env vars. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID."
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function discordFetch(path, init = {}) {
  const url = `${apiBase}${path}`;
  for (;;) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    if (response.status === 429) {
      let retryMs = 1000;
      try {
        const payload = await response.json();
        if (typeof payload.retry_after === "number") {
          retryMs = Math.ceil(payload.retry_after * 1000);
        }
      } catch {
        // Keep default retry.
      }
      await sleep(retryMs);
      continue;
    }

    return response;
  }
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return null;
  }
  // Discord snowflake epoch offset.
  const timestamp = Math.floor(asNumber / 4194304) + 1420070400000;
  return new Date(timestamp).toISOString();
}

async function fetchGuildMeta() {
  const response = await discordFetch(`/guilds/${guildId}?with_counts=true`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch guild metadata: ${response.status} ${await response.text()}`
    );
  }
  return response.json();
}

async function fetchChannels() {
  const response = await discordFetch(`/guilds/${guildId}/channels`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch channels: ${response.status} ${await response.text()}`
    );
  }
  return response.json();
}

async function countChannelMessages(channel) {
  const channelId = channel.id;
  const summary = {
    channel_id: channelId,
    channel_name: channel.name || `(id:${channelId})`,
    channel_type: channel.type,
    messages: 0,
    attachments: 0,
    attachment_bytes: 0,
    first_message_at: null,
    last_message_at: null,
    inaccessible: false,
    error: null,
  };

  let before = null;

  for (;;) {
    const query = before ? `?limit=100&before=${before}` : "?limit=100";
    const response = await discordFetch(`/channels/${channelId}/messages${query}`);

    if (response.status === 403 || response.status === 404) {
      summary.inaccessible = true;
      summary.error = `HTTP ${response.status}`;
      return summary;
    }

    if (!response.ok) {
      summary.error = `HTTP ${response.status}`;
      return summary;
    }

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      return summary;
    }

    summary.messages += batch.length;

    for (const message of batch) {
      const createdAt = message.timestamp || null;
      if (createdAt) {
        if (!summary.first_message_at || createdAt < summary.first_message_at) {
          summary.first_message_at = createdAt;
        }
        if (!summary.last_message_at || createdAt > summary.last_message_at) {
          summary.last_message_at = createdAt;
        }
      }

      const attachments = Array.isArray(message.attachments)
        ? message.attachments
        : [];
      summary.attachments += attachments.length;
      for (const attachment of attachments) {
        const size = Number(attachment.size || 0);
        if (Number.isFinite(size) && size > 0) {
          summary.attachment_bytes += size;
        }
      }
    }

    before = batch[batch.length - 1]?.id ?? null;
    if (!before || batch.length < 100) {
      return summary;
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

function bytesToGiB(bytes) {
  return bytes / (1024 ** 3);
}

async function main() {
  const startedAt = new Date().toISOString();
  const guildMeta = await fetchGuildMeta();
  const channels = await fetchChannels();

  const messageChannelTypes = new Set([0, 5, 10, 11, 12]);
  const candidateChannels = channels.filter((channel) =>
    messageChannelTypes.has(channel.type)
  );

  const perChannel = [];
  for (let index = 0; index < candidateChannels.length; index += 1) {
    const channel = candidateChannels[index];
    process.stdout.write(
      `[${index + 1}/${candidateChannels.length}] ${channel.name || channel.id} ... `
    );
    const result = await countChannelMessages(channel);
    perChannel.push(result);
    process.stdout.write(
      `${result.messages} messages, ${result.attachments} attachments\n`
    );
  }

  const totals = perChannel.reduce(
    (acc, row) => {
      acc.messages += row.messages;
      acc.attachments += row.attachments;
      acc.attachment_bytes += row.attachment_bytes;
      if (row.inaccessible) acc.inaccessible_channels += 1;
      if (row.error) acc.error_channels += 1;
      return acc;
    },
    {
      messages: 0,
      attachments: 0,
      attachment_bytes: 0,
      inaccessible_channels: 0,
      error_channels: 0,
    }
  );

  const report = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    guild: {
      id: guildMeta.id,
      name: guildMeta.name,
      approximate_member_count: guildMeta.approximate_member_count ?? null,
      approximate_presence_count: guildMeta.approximate_presence_count ?? null,
      created_at: toIsoOrNull(guildMeta.id),
    },
    scan: {
      channel_count_total: channels.length,
      message_channel_count: candidateChannels.length,
      delay_ms_between_pages: delayMs,
    },
    totals: {
      messages: totals.messages,
      attachments: totals.attachments,
      attachment_bytes: totals.attachment_bytes,
      attachment_gib: Number(bytesToGiB(totals.attachment_bytes).toFixed(3)),
      inaccessible_channels: totals.inaccessible_channels,
      error_channels: totals.error_channels,
    },
    channels: perChannel
      .slice()
      .sort((a, b) => b.messages - a.messages),
  };

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const outDir = path.resolve(process.cwd(), "reports");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `discord-size-${guildId}-${Date.now()}.json`
  );
  await fs.writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\nDiscord migration size report complete.");
  console.log(`Guild: ${report.guild.name} (${report.guild.id})`);
  console.log(`Messages: ${report.totals.messages.toLocaleString()}`);
  console.log(`Attachments: ${report.totals.attachments.toLocaleString()}`);
  console.log(
    `Attachment volume: ${report.totals.attachment_gib.toLocaleString()} GiB`
  );
  console.log(`Report: ${outFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
