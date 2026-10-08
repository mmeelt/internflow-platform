CREATE TABLE IF NOT EXISTS enterprise_project_assets (
    id                      BIGSERIAL PRIMARY KEY,
    enterprise_project_id   BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    asset_type              VARCHAR(20) NOT NULL CHECK (asset_type IN ('report', 'code', 'video')),
    original_name           VARCHAR(255) NOT NULL,
    stored_name             VARCHAR(255) NOT NULL UNIQUE,
    content_type            VARCHAR(255),
    file_size               BIGINT NOT NULL,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_assets_project ON enterprise_project_assets(enterprise_project_id);
