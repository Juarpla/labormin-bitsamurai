CREATE TABLE catalog_programs (
  slug TEXT PRIMARY KEY,
  center_slug TEXT NOT NULL REFERENCES catalog_training(slug),
  position INTEGER NOT NULL CHECK (position >= 0),
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  CHECK (substr(slug, 1, length(center_slug) + 1) = center_slug || '/'),
  CHECK (length(slug) > length(center_slug) + 1),
  CHECK (instr(substr(slug, length(center_slug) + 2), '/') = 0),
  CHECK (json_extract(metadata, '$.center') IS center_slug),
  CHECK (json_extract(payload, '$.center') IS center_slug),
  CHECK (json_extract(payload, '$.slug') IS substr(slug, length(center_slug) + 2))
) STRICT;

CREATE INDEX catalog_programs_center ON catalog_programs(center_slug, position, slug);
CREATE INDEX catalog_programs_indexable ON catalog_programs(slug)
  WHERE json_extract(metadata, '$.indexable') = 1;
