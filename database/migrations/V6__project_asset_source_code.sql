ALTER TABLE enterprise_project_assets
    DROP CONSTRAINT IF EXISTS enterprise_project_assets_asset_type_check;

UPDATE enterprise_project_assets
SET asset_type = 'code'
WHERE asset_type = 'demo';

ALTER TABLE enterprise_project_assets
    ADD CONSTRAINT enterprise_project_assets_asset_type_check
    CHECK (asset_type IN ('report', 'code', 'video'));
