ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS tg_publish_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS tg_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS tg_posted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS tg_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS tg_message_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS tg_chat_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_blog_posts_tg_schedule
  ON blog_posts (tg_status, tg_publish_at);
