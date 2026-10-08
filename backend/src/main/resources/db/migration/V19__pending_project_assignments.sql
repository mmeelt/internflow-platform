CREATE TABLE IF NOT EXISTS pending_project_assignments (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    assignment_role VARCHAR(20) NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pending_project_assignment_role UNIQUE (project_id, assignment_role)
);

CREATE INDEX IF NOT EXISTS idx_pending_project_assignments_email_role
    ON pending_project_assignments(email, assignment_role);
