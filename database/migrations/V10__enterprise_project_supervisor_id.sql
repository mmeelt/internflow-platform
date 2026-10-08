ALTER TABLE enterprise_projects
    ADD COLUMN IF NOT EXISTS supervisor_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;

-- Backfill only unambiguous legacy names. Ambiguous or unmatched projects are
-- deliberately left without an owner, which fails closed for protected assets.
UPDATE enterprise_projects project
SET supervisor_id = candidate.id
FROM (
    SELECT LOWER(name) AS normalized_name, MIN(id) AS id
    FROM users
    WHERE role = 'supervisor'
    GROUP BY LOWER(name)
    HAVING COUNT(*) = 1
) candidate
WHERE project.supervisor_id IS NULL
  AND project.supervisor_name IS NOT NULL
  AND LOWER(project.supervisor_name) = candidate.normalized_name;

CREATE INDEX IF NOT EXISTS idx_enterprise_projects_supervisor
    ON enterprise_projects(supervisor_id);
