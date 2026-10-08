ALTER TABLE users ADD COLUMN IF NOT EXISTS signed_internship_agreement_path VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signed_internship_agreement_name VARCHAR(255);
