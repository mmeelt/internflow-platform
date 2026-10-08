ALTER TABLE internships ADD COLUMN IF NOT EXISTS enterprise_project_id BIGINT;
ALTER TABLE internships ADD CONSTRAINT fk_internships_enterprise_project
    FOREIGN KEY (enterprise_project_id) REFERENCES enterprise_projects(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_internships_enterprise_project
    ON internships(enterprise_project_id) WHERE enterprise_project_id IS NOT NULL;
