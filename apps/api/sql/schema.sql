CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, server_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  topic TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, slug)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  thread_root_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS channel_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'passive',
  snoozed_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);
ALTER TABLE channel_preferences
  DROP CONSTRAINT IF EXISTS channel_preferences_mode_check;
ALTER TABLE channel_preferences
  ADD CONSTRAINT channel_preferences_mode_check
  CHECK (mode IN ('hidden', 'passive', 'active'));

CREATE TABLE IF NOT EXISTS read_states (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_created_at
  ON messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_server_created_at
  ON messages(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_root_created_at
  ON messages(thread_root_message_id, created_at ASC);

CREATE TABLE IF NOT EXISTS custom_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope = 'server' AND server_id IS NOT NULL AND user_id IS NULL)
    OR
    (scope = 'user' AND user_id IS NOT NULL AND server_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_commands_server_unique
  ON custom_commands(server_id, command)
  WHERE scope = 'server';

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_commands_user_unique
  ON custom_commands(user_id, command)
  WHERE scope = 'user';

CREATE TABLE IF NOT EXISTS media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_attachments (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, media_item_id)
);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS thread_root_message_id UUID REFERENCES messages(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS link_previews (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  posted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  url TEXT,
  media_item_id UUID REFERENCES media_items(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  taxonomy_terms TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (item_type = 'url' AND url IS NOT NULL)
    OR
    (item_type = 'media' AND media_item_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_library_items_server_created_at
  ON library_items(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_channel_created_at
  ON library_items(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_url
  ON library_items(url);
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_items_message_url_unique
  ON library_items(source_message_id, url)
  WHERE item_type = 'url';
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_items_message_media_unique
  ON library_items(source_message_id, media_item_id)
  WHERE item_type = 'media';

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (visibility IN ('private', 'public'))
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  library_item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  added_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, library_item_id)
);
