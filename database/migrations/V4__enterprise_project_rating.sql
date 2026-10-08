ALTER TABLE enterprise_projects
    ADD COLUMN IF NOT EXISTS supervisor_rating NUMERIC(3,1)
    CHECK (supervisor_rating BETWEEN 0 AND 10);
