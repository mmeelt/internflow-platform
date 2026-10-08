CREATE TABLE IF NOT EXISTS refresh_token_sessions (
    id          BIGSERIAL PRIMARY KEY,
    token_id    UUID NOT NULL UNIQUE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_sessions_user
    ON refresh_token_sessions(user_id);
