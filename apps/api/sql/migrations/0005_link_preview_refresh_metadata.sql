ALTER TABLE link_previews
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_refresh_at TIMESTAMPTZ;

UPDATE link_previews
SET next_refresh_at = COALESCE(next_refresh_at, fetched_at + INTERVAL '7 days')
WHERE next_refresh_at IS NULL;

ALTER TABLE link_previews
  ALTER COLUMN next_refresh_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_link_previews_next_refresh_at
  ON link_previews(next_refresh_at);

