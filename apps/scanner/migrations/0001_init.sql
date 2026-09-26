-- `05-interim-waitlist-plan.md` §3.3. Apply with:
--   npx wrangler d1 migrations apply cfm-waitlist --local   (local dev, no account needed)
--   npx wrangler d1 migrations apply cfm-waitlist --remote  (the real EU-jurisdiction database)

CREATE TABLE subscriber (
  email TEXT PRIMARY KEY,           -- trimmed + lowercased by validateSubscription
  sku_count TEXT,                   -- free text, optional; never coerced to a number
  consented_at TEXT NOT NULL,       -- ISO 8601 UTC
  consent_text_version TEXT NOT NULL
);

CREATE TABLE scan_counts (
  iso TEXT NOT NULL,                -- ISO 3166-1 alpha-2 market code
  day TEXT NOT NULL,                -- YYYY-MM-DD, UTC
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (iso, day)
);
