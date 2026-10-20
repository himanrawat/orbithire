-- Test-only copy of the `tasks` queue contract the worker relies on.
-- The real table lives in supabase/migrations (owned by the schema migration);
-- keep this in sync with it.

CREATE TABLE IF NOT EXISTS tasks (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type          text NOT NULL
                  CHECK (type IN ('fetch_jobs','rank_jobs','render_pdf','thumbnail','digest','noop')),
    payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
    status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','running','done','failed')),
    priority      int NOT NULL DEFAULT 0,
    attempts      int NOT NULL DEFAULT 0,
    max_attempts  int NOT NULL DEFAULT 3,
    run_after     timestamptz NOT NULL DEFAULT now(),
    locked_at     timestamptz,
    locked_by     text,
    last_error    text,
    result        jsonb,
    user_id       uuid,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_claim_idx ON tasks (status, priority DESC, run_after);

CREATE OR REPLACE FUNCTION tasks_notify_new() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('tasks_new', NEW.type);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_notify_new ON tasks;
CREATE TRIGGER tasks_notify_new
    AFTER INSERT ON tasks
    FOR EACH ROW EXECUTE FUNCTION tasks_notify_new();

-- Mirrors the SECURITY DEFINER rpc the Next.js app calls (lib/tasks.ts).
CREATE OR REPLACE FUNCTION enqueue_task(
    p_type text,
    p_payload jsonb DEFAULT '{}'::jsonb,
    p_priority int DEFAULT 0,
    p_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE sql AS $$
    INSERT INTO tasks (type, payload, priority, user_id)
    VALUES (p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_priority, 0), p_user_id)
    RETURNING id;
$$;
