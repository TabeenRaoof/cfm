-- One row per UTC day: completed scans, counted from the scanner's one-per-scan fetch of
-- catalog/index.json (decisions.md D-047). scan_counts (0001) stays, relabelled as per-market
-- slice loads — useful for which markets people check, but not a count of scans.
CREATE TABLE scan_runs (
  day TEXT PRIMARY KEY,             -- YYYY-MM-DD, UTC
  n INTEGER NOT NULL DEFAULT 0
);
