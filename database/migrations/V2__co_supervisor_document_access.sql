CREATE TABLE IF NOT EXISTS co_supervisor_assignments (
    id BIGSERIAL PRIMARY KEY,
    internship_id BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    supervisor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (internship_id, supervisor_id)
);
CREATE INDEX IF NOT EXISTS idx_co_supervisor_assignments_supervisor ON co_supervisor_assignments(supervisor_id, status);
