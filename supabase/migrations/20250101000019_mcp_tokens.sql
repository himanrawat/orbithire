-- MCP personal access tokens (OrbitHire v2, see docs/PLAN.md §3 and §4.6)
-- Tokens look like "orb_<random>"; only a hash is stored. /api/mcp verifies a
-- bearer token by hashing it and looking up token_hash with the service role.

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,     -- e.g. sha256 hex of the full token
  token_prefix TEXT,                   -- first characters, shown in the UI to identify a token
  scopes TEXT[] NOT NULL DEFAULT '{read,write}',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens(user_id);

-- ==================== ROW LEVEL SECURITY ====================
-- Users manage their own tokens (create, list, revoke, delete).

ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcp_tokens_all ON mcp_tokens;
CREATE POLICY mcp_tokens_all ON mcp_tokens FOR ALL USING (auth.uid() = user_id);
