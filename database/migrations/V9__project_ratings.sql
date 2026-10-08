CREATE TABLE IF NOT EXISTS project_ratings (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating      NUMERIC(3,1) NOT NULL CHECK (rating BETWEEN 0 AND 10),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_ratings_project ON project_ratings(project_id);
