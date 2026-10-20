-- Documents v2: Typst engine + PDF render status on resumes / cover letters,
-- structured cover letter content, and document version history
-- (OrbitHire v2, see docs/PLAN.md §3 and §4.2)

-- ==================== RESUMES ====================

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'html' CHECK (engine IN ('html', 'typst')),
ADD COLUMN IF NOT EXISTS pdf_status TEXT NOT NULL DEFAULT 'none' CHECK (pdf_status IN ('none', 'queued', 'rendering', 'ready', 'failed')),
ADD COLUMN IF NOT EXISTS pdf_error TEXT,
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'mcp', 'import')),
ADD COLUMN IF NOT EXISTS source_client TEXT,
ADD COLUMN IF NOT EXISTS job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resumes_job_posting ON resumes(job_posting_id) WHERE job_posting_id IS NOT NULL;

COMMENT ON COLUMN resumes.engine IS 'Renderer: html (legacy templates) or typst';
COMMENT ON COLUMN resumes.pdf_status IS 'none | queued | rendering | ready | failed (set by the worker render_pdf task)';
COMMENT ON COLUMN resumes.source IS 'Where the document was created: portal | mcp | import';
COMMENT ON COLUMN resumes.source_client IS 'MCP client that created it, e.g. claude, chatgpt';

-- ==================== COVER LETTERS ====================

ALTER TABLE cover_letters
ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'html' CHECK (engine IN ('html', 'typst')),
ADD COLUMN IF NOT EXISTS pdf_status TEXT NOT NULL DEFAULT 'none' CHECK (pdf_status IN ('none', 'queued', 'rendering', 'ready', 'failed')),
ADD COLUMN IF NOT EXISTS pdf_error TEXT,
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'mcp', 'import')),
ADD COLUMN IF NOT EXISTS source_client TEXT,
ADD COLUMN IF NOT EXISTS job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS content_json JSONB;   -- {recipient, salutation, paragraphs[], closing}

-- New (Typst) cover letters may only have content_json; old rows keep plain-text content.
ALTER TABLE cover_letters ALTER COLUMN content DROP NOT NULL;
ALTER TABLE cover_letters DROP CONSTRAINT IF EXISTS cover_letters_content_present;
ALTER TABLE cover_letters ADD CONSTRAINT cover_letters_content_present
  CHECK (content IS NOT NULL OR content_json IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_cover_letters_job_posting ON cover_letters(job_posting_id) WHERE job_posting_id IS NOT NULL;

COMMENT ON COLUMN cover_letters.content_json IS 'Structured letter: {recipient, salutation, paragraphs[], closing}. Legacy rows use content (text).';

-- Existing documents that already have a stored PDF are "ready"
UPDATE resumes SET pdf_status = 'ready' WHERE pdf_status = 'none' AND pdf_key IS NOT NULL;
UPDATE cover_letters SET pdf_status = 'ready' WHERE pdf_status = 'none' AND pdf_key IS NOT NULL;

-- ==================== DOCUMENT VERSIONS ====================
-- Every save from the portal or MCP inserts a version. version is assigned
-- automatically (max + 1 per document) when omitted.

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('resume', 'cover_letter')),
  document_id UUID NOT NULL,          -- resumes.id or cover_letters.id
  version INTEGER NOT NULL CHECK (version >= 1),
  content_json JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'mcp', 'import')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_type, document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_user ON document_versions(user_id);

CREATE OR REPLACE FUNCTION assign_document_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.version IS NULL THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
    FROM document_versions
    WHERE document_type = NEW.document_type AND document_id = NEW.document_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_versions_assign_version ON document_versions;
CREATE TRIGGER document_versions_assign_version
  BEFORE INSERT ON document_versions
  FOR EACH ROW EXECUTE FUNCTION assign_document_version();

-- document_id is polymorphic (no FK), so clean up versions when a document is deleted.
-- SECURITY DEFINER so the cleanup is not blocked by RLS; search_path pinned (see migration 015).
CREATE OR REPLACE FUNCTION delete_document_versions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM document_versions
  WHERE document_type = TG_ARGV[0] AND document_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS resumes_delete_versions ON resumes;
CREATE TRIGGER resumes_delete_versions
  AFTER DELETE ON resumes
  FOR EACH ROW EXECUTE FUNCTION delete_document_versions('resume');

DROP TRIGGER IF EXISTS cover_letters_delete_versions ON cover_letters;
CREATE TRIGGER cover_letters_delete_versions
  AFTER DELETE ON cover_letters
  FOR EACH ROW EXECUTE FUNCTION delete_document_versions('cover_letter');

-- ==================== ROW LEVEL SECURITY ====================
-- Versions are immutable: owners can read, insert and delete, never update.

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_versions_select ON document_versions;
CREATE POLICY document_versions_select ON document_versions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS document_versions_insert ON document_versions;
CREATE POLICY document_versions_insert ON document_versions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS document_versions_delete ON document_versions;
CREATE POLICY document_versions_delete ON document_versions FOR DELETE USING (auth.uid() = user_id);
