import { config } from '../config.js';
import { pool } from '../db/pool.js';

function pickMeta(content: string, key: string) {
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const match = content.match(regex);
  return match?.[1] ?? null;
}

function pickTitle(content: string) {
  const match = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

async function fetchLinkPreview(url: string) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'TincanBot/0.1 (+https://tincan.local)' },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status})`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return {
      url,
      title: null as string | null,
      description: null as string | null,
      image_url: null as string | null,
      site_name: null as string | null
    };
  }

  const html = await response.text();
  return {
    url,
    title: pickMeta(html, 'og:title') ?? pickTitle(html),
    description: pickMeta(html, 'og:description') ?? pickMeta(html, 'description'),
    image_url: pickMeta(html, 'og:image'),
    site_name: pickMeta(html, 'og:site_name')
  };
}

function nextRefreshAtIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function nextRetryAtIso(failureCount: number) {
  const minutes = Math.min(config.linkPreviewRetryMaxMinutes, config.linkPreviewRetryBaseMinutes * 2 ** Math.max(0, failureCount - 1));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export async function upsertLinkPreview(url: string, options?: { forceRefresh?: boolean }) {
  const existing = await pool.query(
    `
    SELECT url, title, description, image_url, site_name, fetched_at, next_refresh_at, failure_count, last_error
    FROM link_previews
    WHERE url = $1
    `,
    [url]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    const row = existing.rows[0] as {
      next_refresh_at?: string | null;
    };

    if (!options?.forceRefresh && row.next_refresh_at && new Date(row.next_refresh_at).getTime() > Date.now()) {
      return existing.rows[0];
    }
  }

  try {
    const preview = await fetchLinkPreview(url);
    const stored = await pool.query(
      `
      INSERT INTO link_previews (
        url, title, description, image_url, site_name,
        fetched_at, last_attempted_at, failure_count, last_error, next_refresh_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0, NULL, $6::timestamptz)
      ON CONFLICT (url)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        site_name = EXCLUDED.site_name,
        fetched_at = NOW(),
        last_attempted_at = NOW(),
        failure_count = 0,
        last_error = NULL,
        next_refresh_at = EXCLUDED.next_refresh_at
      RETURNING url, title, description, image_url, site_name, fetched_at, next_refresh_at, failure_count, last_error
      `,
      [preview.url, preview.title, preview.description, preview.image_url, preview.site_name, nextRefreshAtIso(config.linkPreviewTtlHours)]
    );

    return stored.rows[0];
  } catch (error) {
    const errorText = error instanceof Error ? error.message : 'Preview fetch failed';
    const failure = await pool.query(
      `
      INSERT INTO link_previews (
        url, title, description, image_url, site_name,
        fetched_at, last_attempted_at, failure_count, last_error, next_refresh_at
      )
      VALUES ($1, NULL, NULL, NULL, NULL, NOW(), NOW(), 1, $2, $3::timestamptz)
      ON CONFLICT (url)
      DO UPDATE SET
        last_attempted_at = NOW(),
        failure_count = link_previews.failure_count + 1,
        last_error = EXCLUDED.last_error,
        next_refresh_at = EXCLUDED.next_refresh_at
      RETURNING url, title, description, image_url, site_name, fetched_at, next_refresh_at, failure_count, last_error
      `,
      [url, errorText.slice(0, 1000), nextRetryAtIso(existing.rowCount && existing.rowCount > 0 ? (existing.rows[0].failure_count as number) + 1 : 1)]
    );

    return failure.rows[0];
  }
}

export async function refreshDueLinkPreviews(limit: number) {
  const dueRows = await pool.query(
    `
    SELECT url
    FROM link_previews
    WHERE next_refresh_at <= NOW()
    ORDER BY next_refresh_at ASC
    LIMIT $1
    `,
    [limit]
  );

  let refreshed = 0;
  for (const row of dueRows.rows) {
    await upsertLinkPreview(row.url as string, { forceRefresh: true });
    refreshed += 1;
  }

  return { refreshed };
}

