ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;

ALTER TABLE mfa_challenges DROP CONSTRAINT IF EXISTS mfa_challenges_purpose_check;
ALTER TABLE mfa_challenges ADD CONSTRAINT mfa_challenges_purpose_check
    CHECK (purpose IN ('LOGIN', 'REGISTRATION', 'PASSWORD_RESET'));
