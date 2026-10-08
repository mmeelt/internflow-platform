ALTER TABLE enterprise_projects ADD COLUMN IF NOT EXISTS visible_in_library BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE enterprise_projects ADD COLUMN IF NOT EXISTS available_for_student_selection BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS student_project_requests (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    denial_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_student_project_requests_student ON student_project_requests(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_project_requests_supervisor ON student_project_requests(supervisor_id, status);
