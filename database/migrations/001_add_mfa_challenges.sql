-- Apply this once to databases created before email MFA was introduced.
CREATE TABLE IF NOT EXISTS mfa_challenges (
    id          UUID PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user
    ON mfa_challenges(user_id, created_at);
