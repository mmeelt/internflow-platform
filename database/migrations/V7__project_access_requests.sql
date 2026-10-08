CREATE TABLE IF NOT EXISTS project_access_requests (
    id                    BIGSERIAL PRIMARY KEY,
    enterprise_project_id BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    requester_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_type            VARCHAR(20) NOT NULL CHECK (asset_type IN ('code', 'video')),
    message               VARCHAR(1000),
    status                VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (enterprise_project_id, requester_id, asset_type)
);

CREATE INDEX IF NOT EXISTS idx_project_access_request_owner
    ON project_access_requests(enterprise_project_id, requester_id);
