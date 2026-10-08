ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Accounts that predate this feature are grandfathered so the migration does
-- not lock out existing users.
UPDATE users SET email_verified = TRUE
WHERE email_verified = FALSE;

ALTER TABLE mfa_challenges
    ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'LOGIN';

ALTER TABLE mfa_challenges
    DROP CONSTRAINT IF EXISTS mfa_challenges_purpose_check;

ALTER TABLE mfa_challenges
    ADD CONSTRAINT mfa_challenges_purpose_check
    CHECK (purpose IN ('LOGIN', 'REGISTRATION'));
