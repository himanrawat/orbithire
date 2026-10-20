-- Tasks queue (OrbitHire v2, see docs/PLAN.md §3)
-- A Postgres-backed job queue consumed by the Python worker (worker/).
-- The worker connects with the service role (bypasses RLS) and claims rows with
-- SELECT ... FOR UPDATE SKIP LOCKED. New rows fire NOTIFY tasks_new so the worker
-- can wake up immediately instead of waiting for its next poll.

-- ==================== TASKS ====================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('fetch_jobs', 'rank_jobs', 'render_pdf', 'thumbnail', 'digest', 'noop')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,            -- worker id that claimed the task
  last_error TEXT,
  result JSONB,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL for system tasks (cron, thumbnails)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claim query: WHERE status = 'queued' AND run_after <= now() ORDER BY priority DESC, run_after
CREATE INDEX IF NOT EXISTS idx_tasks_claim ON tasks(status, priority DESC, run_after);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, created_at DESC) WHERE user_id IS NOT NULL;

COMMENT ON TABLE tasks IS 'Background task queue processed by the worker (service role).';
COMMENT ON COLUMN tasks.type IS 'fetch_jobs | rank_jobs | render_pdf | thumbnail | digest | noop (test)';
COMMENT ON COLUMN tasks.run_after IS 'Earliest time the task may run (used for retry backoff)';

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION notify_task_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM pg_notify('tasks_new', NEW.type);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_notify_new ON tasks;
CREATE TRIGGER tasks_notify_new
  AFTER INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_inserted();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== ROW LEVEL SECURITY ====================
-- Users can read their own tasks (status badges, "Fetch now" progress).
-- No insert/update/delete policies: users enqueue through enqueue_task() below,
-- the worker and admin pages use the service role (admins authenticate via
-- admin_users + service role, see migration 010, not via auth.uid()).

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select_own ON tasks;
CREATE POLICY tasks_select_own ON tasks FOR SELECT USING (auth.uid() = user_id);

-- ==================== ENQUEUE FUNCTION ====================
-- Callable by logged-in users (supabase.rpc('enqueue_task', ...)) and by the service role.
-- * authenticated: user_id is forced to auth.uid(); passing another user's id is an error;
--   priority is clamped to [-10, 10] so users cannot jump the whole queue.
-- * service role / postgres (no JWT user): p_user_id is used as given (may be NULL).

CREATE OR REPLACE FUNCTION enqueue_task(
  p_type TEXT,
  p_payload JSONB DEFAULT '{}',
  p_priority INTEGER DEFAULT 0,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_id UUID;
  v_priority INTEGER := COALESCE(p_priority, 0);
  v_id UUID;
BEGIN
  IF v_uid IS NOT NULL THEN
    IF p_user_id IS NOT NULL AND p_user_id <> v_uid THEN
      RAISE EXCEPTION 'enqueue_task: cannot enqueue a task for another user'
        USING ERRCODE = '42501';
    END IF;
    v_user_id := v_uid;
    v_priority := LEAST(GREATEST(v_priority, -10), 10);
  ELSIF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'enqueue_task: not authenticated' USING ERRCODE = '42501';
  ELSE
    v_user_id := p_user_id;
  END IF;

  INSERT INTO tasks (type, payload, priority, user_id)
  VALUES (p_type, COALESCE(p_payload, '{}'::jsonb), v_priority, v_user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_task(TEXT, JSONB, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION enqueue_task(TEXT, JSONB, INTEGER, UUID) TO authenticated, service_role;
