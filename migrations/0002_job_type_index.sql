CREATE INDEX catalog_jobs_type ON catalog_jobs(json_extract(metadata, '$.type'), position, slug);
