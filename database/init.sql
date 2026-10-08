-- InternFlow PostgreSQL schema
-- Matches frontend data model (src/lib/store.ts, profile, setup, messaging)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users (all roles) ───────────────────────────────────────────────────────

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('student', 'supervisor', 'admin')),
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    photo_url       TEXT,
    avatar_color    VARCHAR(20),
    bio             TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Need Review', 'Revoked')),
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_changed_at TIMESTAMPTZ,
    session_version INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- One-time MFA codes are never stored in plaintext.
CREATE TABLE mfa_challenges (
    id          UUID PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(255) NOT NULL,
    purpose     VARCHAR(20) NOT NULL DEFAULT 'LOGIN'
                CHECK (purpose IN ('LOGIN', 'REGISTRATION', 'PASSWORD_RESET')),
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mfa_challenges_user ON mfa_challenges(user_id, created_at);

-- ─── Role-specific profiles ──────────────────────────────────────────────────

CREATE TABLE intern_profiles (
    user_id                 BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    university              VARCHAR(255),
    department              VARCHAR(255),
    year                    VARCHAR(100),
    previous_internships    TEXT,
    enterprise              VARCHAR(255),
    subject_of_internship   VARCHAR(255),
    progress                INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100)
);

CREATE TABLE supervisor_profiles (
    user_id                 BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organization            VARCHAR(255),
    department              VARCHAR(255),
    post                    VARCHAR(255),
    specialization          VARCHAR(255),
    other_encadrant_info    TEXT,
    years_experience        INT DEFAULT 0,
    total_interns           INT DEFAULT 0
);

CREATE TABLE admin_profiles (
    user_id                 BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organization            VARCHAR(255),
    department              VARCHAR(255),
    title                   VARCHAR(255)
);

-- ─── Intern skills (many-to-many style) ──────────────────────────────────────

CREATE TABLE intern_skills (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill       VARCHAR(100) NOT NULL,
    UNIQUE (user_id, skill)
);

-- ─── Internships (active student project) ────────────────────────────────────

CREATE TABLE internships (
    id              BIGSERIAL PRIMARY KEY,
    intern_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title           VARCHAR(500) NOT NULL,
    domain          VARCHAR(255),
    description     TEXT,
    role            VARCHAR(100),
    start_date      DATE,
    end_date        DATE,
    progress        INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status          VARCHAR(20) NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Need Review', 'Revoked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_internships_intern ON internships(intern_id);
CREATE INDEX idx_internships_supervisor ON internships(supervisor_id);

CREATE TABLE internship_objectives (
    id              BIGSERIAL PRIMARY KEY,
    internship_id   BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    order_index     INT NOT NULL DEFAULT 0
);

CREATE TABLE internship_tech_stack (
    id              BIGSERIAL PRIMARY KEY,
    internship_id   BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    tech            VARCHAR(100) NOT NULL,
    UNIQUE (internship_id, tech)
);

-- ─── Tasks & submissions ─────────────────────────────────────────────────────

CREATE TABLE tasks (
    id              BIGSERIAL PRIMARY KEY,
    internship_id   BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    due_date        DATE,
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    status          VARCHAR(20) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in-progress', 'done', 'reviewed', 'disapproved')),
    progress        INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    feedback        TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_internship ON tasks(internship_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Private student-only calendar items. These are intentionally separate from
-- internship tasks, so supervisors never receive them through task endpoints.
CREATE TABLE personal_calendar_tasks (
    id              BIGSERIAL PRIMARY KEY,
    student_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    start_date      DATE NOT NULL,
    due_date        DATE,
    category        VARCHAR(50),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    status          VARCHAR(20) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'done')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_personal_calendar_tasks_student ON personal_calendar_tasks(student_id, start_date);

CREATE TABLE submissions (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name            VARCHAR(500) NOT NULL,
    size            VARCHAR(50),
    type            VARCHAR(20) NOT NULL DEFAULT 'file'
                    CHECK (type IN ('pdf', 'code', 'video', 'image', 'archive', 'file')),
    file_path       TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_task ON submissions(task_id);

-- ─── Task feedback thread (supervisor + co-supervisor replies) ────────────────

CREATE TABLE IF NOT EXISTS task_feedbacks (
    id          BIGSERIAL PRIMARY KEY,
    task_id     BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_feedbacks_task ON task_feedbacks(task_id);

-- ─── Milestones ──────────────────────────────────────────────────────────────

CREATE TABLE milestones (
    id              BIGSERIAL PRIMARY KEY,
    internship_id   BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('completed', 'in-progress', 'pending')),
    date            DATE
);

-- ─── Enterprise project library (archive) ────────────────────────────────────

CREATE TABLE enterprise_projects (
    id                  BIGSERIAL PRIMARY KEY,
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    domain              VARCHAR(255),
    year                VARCHAR(10),
    intern_name         VARCHAR(255),
    supervisor_name     VARCHAR(255),
    supervisor_id       BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    impact              VARCHAR(10) DEFAULT 'Medium'
                        CHECK (impact IN ('High', 'Medium', 'Low')),
    completion_rate     INT DEFAULT 0 CHECK (completion_rate BETWEEN 0 AND 100),
    methodology         TEXT,
    results             TEXT,
    has_code            BOOLEAN NOT NULL DEFAULT FALSE,
    has_report          BOOLEAN NOT NULL DEFAULT FALSE,
    has_video           BOOLEAN NOT NULL DEFAULT FALSE,
    supervisor_rating   NUMERIC(3,1) CHECK (supervisor_rating BETWEEN 0 AND 10)
);
CREATE INDEX idx_enterprise_projects_supervisor ON enterprise_projects(supervisor_id);

CREATE TABLE enterprise_project_tech (
    id                      BIGSERIAL PRIMARY KEY,
    enterprise_project_id   BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    tech                    VARCHAR(100) NOT NULL,
    UNIQUE (enterprise_project_id, tech)
);

CREATE TABLE enterprise_project_key_findings (
    id                      BIGSERIAL PRIMARY KEY,
    enterprise_project_id   BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    finding                 TEXT NOT NULL,
    order_index             INT NOT NULL DEFAULT 0
);

CREATE TABLE project_ratings (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating      NUMERIC(3,1) NOT NULL CHECK (rating BETWEEN 0 AND 10),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);
CREATE INDEX idx_project_ratings_project ON project_ratings(project_id);

CREATE TABLE enterprise_project_assets (
    id                      BIGSERIAL PRIMARY KEY,
    enterprise_project_id   BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    asset_type              VARCHAR(20) NOT NULL CHECK (asset_type IN ('report', 'code', 'video')),
    original_name           VARCHAR(255) NOT NULL,
    stored_name             VARCHAR(255) NOT NULL UNIQUE,
    content_type            VARCHAR(255),
    file_size               BIGINT NOT NULL,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_assets_project ON enterprise_project_assets(enterprise_project_id);

CREATE TABLE project_access_requests (
    id                    BIGSERIAL PRIMARY KEY,
    enterprise_project_id BIGINT NOT NULL REFERENCES enterprise_projects(id) ON DELETE CASCADE,
    requester_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_type            VARCHAR(20) NOT NULL CHECK (asset_type IN ('report', 'code', 'video')),
    message               VARCHAR(1000),
    status                VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (enterprise_project_id, requester_id, asset_type)
);

CREATE INDEX idx_project_access_request_owner
    ON project_access_requests(enterprise_project_id, requester_id);

CREATE TABLE refresh_token_sessions (
    id          BIGSERIAL PRIMARY KEY,
    token_id    UUID NOT NULL UNIQUE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ
);
CREATE INDEX idx_refresh_token_sessions_user ON refresh_token_sessions(user_id);

-- ─── Messaging ───────────────────────────────────────────────────────────────

CREATE TABLE conversations (
    id                  BIGSERIAL PRIMARY KEY,
    participant_one_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_two_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (participant_one_id, participant_two_id)
);

CREATE TABLE messages (
    id                  BIGSERIAL PRIMARY KEY,
    conversation_id     BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content             TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- ─── Notifications ───────────────────────────────────────────────────────────

CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('feedback', 'submission', 'deadline', 'message', 'review', 'system', 'milestone')),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ─── Co-supervisor assignments ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS co_supervisor_assignments (
    id            BIGSERIAL PRIMARY KEY,
    internship_id BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    supervisor_id BIGINT NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (internship_id, supervisor_id)
);
CREATE INDEX IF NOT EXISTS idx_co_supervisor_assignments_supervisor
    ON co_supervisor_assignments(supervisor_id, status);
