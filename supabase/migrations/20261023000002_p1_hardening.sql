-- Shared rate limiting, security events, and atomic admin credit additions.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expiry
  ON public.rate_limit_buckets(reset_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  key_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_created
  ON public.security_events(created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.security_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key_hash TEXT,
  p_scope TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 OR length(p_scope) > 100 OR length(p_key_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid rate limit configuration';
  END IF;

  INSERT INTO public.rate_limit_buckets(scope, key_hash, request_count, reset_at)
  VALUES (p_scope, p_key_hash, 1, NOW() + make_interval(secs => p_window_seconds))
  ON CONFLICT (scope, key_hash) DO UPDATE
  SET request_count = CASE
        WHEN rate_limit_buckets.reset_at <= NOW() THEN 1
        ELSE rate_limit_buckets.request_count + 1
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at <= NOW()
          THEN NOW() + make_interval(secs => p_window_seconds)
        ELSE rate_limit_buckets.reset_at
      END,
      updated_at = NOW()
  RETURNING request_count, reset_at INTO v_count, v_reset_at;

  RETURN jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'retry_after', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset_at - NOW())))::INTEGER)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.add_ai_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  IF p_amount < 1 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'invalid credit amount';
  END IF;

  UPDATE public.profiles
     SET ai_credits = COALESCE(ai_credits, 2) + p_amount,
         updated_at = NOW()
   WHERE id = p_user_id
   RETURNING ai_credits INTO v_credits;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.add_ai_credits(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_ai_credits(UUID, INTEGER) TO service_role;
