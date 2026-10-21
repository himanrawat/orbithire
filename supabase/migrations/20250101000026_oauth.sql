-- MCP OAuth 2.1 authorization server, Phase 5 (OrbitHire v2, see docs/PLAN.md §4.6)
--
-- claude.ai custom connectors and ChatGPT developer-mode connectors sign in to
-- /api/mcp with OAuth 2.1 (authorization code + PKCE S256). The authorization
-- server lives inside the Next.js app (lib/oauth/*); these tables back it.
--
--   oauth_clients              registered clients: Dynamic Client Registration
--                              (RFC 7591) or cached Client ID Metadata Documents
--   oauth_authorization_codes  short-lived, single-use codes (hash only)
--   oauth_grants               one row per user approval = a "connected app"
--                              shown in Settings → AI connections
--   oauth_tokens               access (1 h) and refresh (rotating) tokens (hash only)
--
-- Every secret (client secret, code, access/refresh token) is stored as a
-- SHA-256 hex hash. All writes go through the service role; users may only
-- read their own grants (RLS). Clients, codes and tokens have no policies, so
-- they are invisible to the anon/authenticated roles.

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,                  -- "orbc_…" (DCR) or the metadata document URL (CIMD)
  client_name TEXT NOT NULL,
  client_uri TEXT,
  logo_uri TEXT,
  redirect_uris TEXT[] NOT NULL,
  grant_types TEXT[] NOT NULL DEFAULT '{authorization_code,refresh_token}',
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none'
    CHECK (token_endpoint_auth_method IN ('none', 'client_secret_post', 'client_secret_basic')),
  client_secret_hash TEXT,                     -- confidential DCR clients only
  registration_type TEXT NOT NULL DEFAULT 'dynamic'
    CHECK (registration_type IN ('dynamic', 'metadata_document')),
  metadata_expires_at TIMESTAMPTZ,             -- CIMD cache expiry
  software_id TEXT,
  software_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,                   -- snapshot shown in Settings even if the client changes
  redirect_host TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{read}',
  resource TEXT NOT NULL,                      -- RFC 8707 audience, e.g. https://example.com/api/mcp
  last_used_at TIMESTAMPTZ,
  last_client TEXT,                            -- clientInfo.name from the last MCP initialize
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_grants_user ON oauth_grants(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_client ON oauth_grants(client_id);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code_hash TEXT PRIMARY KEY,
  grant_id UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,                -- PKCE S256 only
  scopes TEXT[] NOT NULL,
  resource TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL,
  resource TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ,                      -- refresh token exchanged (reuse ⇒ grant revoked)
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_grant ON oauth_tokens(grant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users see their own connected apps. Revocation goes through the API
-- (service role) so tokens are revoked together with the grant.
DROP POLICY IF EXISTS oauth_grants_select_own ON oauth_grants;
CREATE POLICY oauth_grants_select_own ON oauth_grants FOR SELECT USING (auth.uid() = user_id);

-- ==================== HOUSEKEEPING ====================
-- Expired codes / tokens are useless; drop them (called opportunistically by
-- the token endpoint, safe to call from pg_cron too).
CREATE OR REPLACE FUNCTION oauth_cleanup_expired()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM oauth_authorization_codes WHERE expires_at < NOW() - INTERVAL '1 day';
  DELETE FROM oauth_tokens WHERE expires_at < NOW() - INTERVAL '1 day';
$$;

REVOKE ALL ON FUNCTION oauth_cleanup_expired() FROM PUBLIC, anon, authenticated;
