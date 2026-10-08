ALTER TABLE project_access_requests
    DROP CONSTRAINT IF EXISTS project_access_requests_asset_type_check;

ALTER TABLE project_access_requests
    ADD CONSTRAINT project_access_requests_asset_type_check
    CHECK (asset_type IN ('report', 'code', 'video'));
