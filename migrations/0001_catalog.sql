CREATE TABLE catalog_ready (
  name TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  source_revision TEXT
) STRICT;

-- A slug is the public identifier, including after a job moves to the archive.
-- Practices are employment records of type "internship", not copies of jobs.
CREATE TABLE catalog_jobs (
  slug TEXT PRIMARY KEY,
  position INTEGER NOT NULL CHECK (position >= 0),
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  payload TEXT NOT NULL CHECK (json_valid(payload))
) STRICT;
CREATE INDEX catalog_jobs_position ON catalog_jobs(position, slug);

CREATE TABLE catalog_training (
  slug TEXT PRIMARY KEY,
  position INTEGER NOT NULL CHECK (position >= 0),
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  payload TEXT NOT NULL CHECK (json_valid(payload))
) STRICT;
CREATE INDEX catalog_training_position ON catalog_training(position, slug);

CREATE TABLE catalog_events (
  slug TEXT PRIMARY KEY,
  position INTEGER NOT NULL CHECK (position >= 0),
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  payload TEXT NOT NULL CHECK (json_valid(payload))
) STRICT;
CREATE INDEX catalog_events_position ON catalog_events(position, slug);

CREATE TABLE catalog_guides (
  slug TEXT PRIMARY KEY,
  position INTEGER NOT NULL CHECK (position >= 0),
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  payload TEXT NOT NULL CHECK (json_valid(payload))
) STRICT;
CREATE INDEX catalog_guides_position ON catalog_guides(position, slug);
