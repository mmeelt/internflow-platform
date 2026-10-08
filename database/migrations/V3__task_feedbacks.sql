-- Named per-task feedback entries (supervisor + co-supervisor)
CREATE TABLE IF NOT EXISTS task_feedbacks (
    id          BIGSERIAL PRIMARY KEY,
    task_id     BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_feedbacks_task ON task_feedbacks(task_id);
