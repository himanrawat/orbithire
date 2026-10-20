-- MCP server, Phase 4 (OrbitHire v2, see docs/PLAN.md §4.6)
--
-- /api/mcp runs in stateless Streamable HTTP mode: every request builds a new
-- server, so the client name from the MCP `initialize` handshake (clientInfo,
-- e.g. "claude-ai", "claude-code", "openai-mcp") is remembered per token here.
-- Later tool calls use it for resumes.source_client / cover_letters.source_client,
-- and Settings → AI connections shows it.
--
-- Rate limits (see lib/mcp/rateLimit.ts) need no table: requests/minute are
-- counted in memory per process, writes/hour are counted from user_activities
-- rows with event_type 'mcp.*' (every MCP write tool logs one).

ALTER TABLE mcp_tokens
ADD COLUMN IF NOT EXISTS last_client TEXT;

COMMENT ON COLUMN mcp_tokens.last_client IS 'clientInfo.name from the last MCP initialize request made with this token';

-- Write-limit lookups: recent MCP write events per user.
CREATE INDEX IF NOT EXISTS idx_user_activities_user_event_time
  ON user_activities (user_id, event_type, created_at DESC);
