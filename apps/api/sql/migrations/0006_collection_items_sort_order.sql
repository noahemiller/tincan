ALTER TABLE collection_items
ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ranked AS (
  SELECT
    collection_id,
    library_item_id,
    ROW_NUMBER() OVER (
      PARTITION BY collection_id
      ORDER BY created_at ASC, library_item_id ASC
    ) AS row_index
  FROM collection_items
)
UPDATE collection_items ci
SET sort_order = ranked.row_index
FROM ranked
WHERE ci.collection_id = ranked.collection_id
  AND ci.library_item_id = ranked.library_item_id
  AND ci.sort_order IS NULL;

UPDATE collection_items
SET sort_order = 1
WHERE sort_order IS NULL;

ALTER TABLE collection_items
ALTER COLUMN sort_order SET DEFAULT 1;

ALTER TABLE collection_items
ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_items_collection_sort_order
  ON collection_items(collection_id, sort_order ASC, created_at ASC);
