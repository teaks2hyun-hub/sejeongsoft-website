CREATE TABLE IF NOT EXISTS inquiries (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  name_company TEXT NOT NULL,
  contact TEXT NOT NULL,
  region TEXT DEFAULT '',
  message TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_base64 TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries(created_at DESC);
