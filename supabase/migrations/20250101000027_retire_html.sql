-- Retire the HTML (Puppeteer) document engine – OrbitHire v2 Phase 7 (docs/PLAN.md).
--
-- 1. Legacy engine = 'html' resumes / cover letters that have structured content
--    move to engine = 'typst' with the closest Typst template, pdf_status = 'queued',
--    and get a render_pdf task (same payload as lib/documents.ts queueTypstRender).
--    Cover letters without content_json get one derived from their plain text.
-- 2. Imported documents (source = 'import', finished PDFs) are NOT touched and are
--    never re-rendered. HTML rows without content keep their stored PDF as is.
-- 3. Settings / column defaults that point at HTML templates move to Typst.
--
-- Mapping (keep in sync with LEGACY_HTML_RESUME_MAP in lib/templateCatalog.ts):
--   standard -> moderncv     professional -> ats-classic   even    -> modern
--   elegant  -> ats-classic  flat         -> modern        spartacus -> modern
--   paper    -> ats-classic  compact      -> compact       modern  -> modern
--   unknown / empty -> modern
--   cover letters (single Georgia-serif HTML layout) -> cover-classic
--
-- Idempotent: a re-run finds no convertible engine = 'html' rows and inserts no tasks.

CREATE OR REPLACE FUNCTION pg_temp.typst_resume_template(old TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE regexp_replace(coalesce(old, ''), '^(html|typst):', '')
    WHEN 'standard'     THEN 'moderncv'
    WHEN 'professional' THEN 'ats-classic'
    WHEN 'even'         THEN 'modern'
    WHEN 'elegant'      THEN 'ats-classic'
    WHEN 'flat'         THEN 'modern'
    WHEN 'spartacus'    THEN 'modern'
    WHEN 'paper'        THEN 'ats-classic'
    WHEN 'compact'      THEN 'compact'
    WHEN 'modern'       THEN 'modern'
    -- already a Typst resume template
    WHEN 'ats-classic'  THEN 'ats-classic'
    WHEN 'eu-photo'     THEN 'eu-photo'
    WHEN 'moderncv'     THEN 'moderncv'
    ELSE 'modern'
  END
$$;

-- Plain-text letter -> {"paragraphs": [...]} split on blank lines.
CREATE OR REPLACE FUNCTION pg_temp.letter_paragraphs(body TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(btrim(p, E' \t\r\n') ORDER BY ord), '[]'::jsonb)
  FROM regexp_split_to_table(replace(coalesce(body, ''), E'\r', ''), E'\\n[ \\t]*\\n') WITH ORDINALITY AS t(p, ord)
  WHERE btrim(p, E' \t\r\n') <> ''
$$;

-- ==================== RESUMES ====================

WITH converted AS (
  UPDATE resumes r
  SET engine = 'typst',
      template = pg_temp.typst_resume_template(r.template),
      pdf_status = 'queued',
      pdf_error = NULL,
      updated_at = now()
  WHERE r.engine = 'html'
    AND r.source <> 'import'
    AND jsonb_typeof(r.content_json) = 'object'
    AND (r.content_json - 'meta') <> '{}'::jsonb
  RETURNING r.id, r.user_id, r.template
)
INSERT INTO tasks (type, payload, priority, user_id)
SELECT 'render_pdf',
       jsonb_build_object('document_type', 'resume', 'document_id', c.id, 'template_id', c.template),
       1,  -- below interactive saves (priority 5)
       c.user_id
FROM converted c;

-- ==================== COVER LETTERS ====================

WITH converted AS (
  UPDATE cover_letters cl
  SET engine = 'typst',
      template = CASE WHEN cl.template IN ('cover-classic', 'cover-modern', 'cover-moderncv')
                      THEN cl.template ELSE 'cover-classic' END,
      content_json = CASE
        WHEN jsonb_typeof(cl.content_json) = 'object' AND (cl.content_json - 'meta') <> '{}'::jsonb
          THEN cl.content_json
        ELSE coalesce(cl.content_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'basics', '{}'::jsonb,
          'recipient', coalesce((SELECT jsonb_strip_nulls(jsonb_build_object('name', co.recruiter_name, 'company', co.name))
                                 FROM companies co WHERE co.id = cl.company_id), '{}'::jsonb),
          'date', to_char(coalesce(cl.created_at, now()), 'YYYY-MM-DD'),
          'paragraphs', pg_temp.letter_paragraphs(cl.content)
        ))
      END,
      pdf_status = 'queued',
      pdf_error = NULL,
      updated_at = now()
  WHERE cl.engine = 'html'
    AND cl.source <> 'import'
    AND (
      (jsonb_typeof(cl.content_json) = 'object' AND (cl.content_json - 'meta') <> '{}'::jsonb)
      OR pg_temp.letter_paragraphs(cl.content) <> '[]'::jsonb
    )
  RETURNING cl.id, cl.user_id, cl.template
)
INSERT INTO tasks (type, payload, priority, user_id)
SELECT 'render_pdf',
       jsonb_build_object('document_type', 'cover_letter', 'document_id', c.id, 'template_id', c.template),
       1,
       c.user_id
FROM converted c;

-- ==================== DEFAULTS ====================

ALTER TABLE resumes ALTER COLUMN engine SET DEFAULT 'typst';
ALTER TABLE cover_letters ALTER COLUMN engine SET DEFAULT 'typst';
ALTER TABLE resumes ALTER COLUMN template SET DEFAULT 'modern';
ALTER TABLE cover_letters ALTER COLUMN template SET DEFAULT 'cover-modern';

COMMENT ON COLUMN resumes.engine IS
  'typst (rendered by the worker) or html (retired: imported PDFs / legacy rows without content, never re-rendered)';
COMMENT ON COLUMN cover_letters.engine IS
  'typst (rendered by the worker) or html (retired: imported PDFs / legacy rows without content, never re-rendered)';

-- User default template (stored as a bare id, e.g. 'standard') -> Typst resume template.
UPDATE user_settings
SET default_template = pg_temp.typst_resume_template(default_template),
    updated_at = now()
WHERE default_template IS DISTINCT FROM pg_temp.typst_resume_template(default_template);
ALTER TABLE user_settings ALTER COLUMN default_template SET DEFAULT 'modern';

-- Country presets (not used by the app at runtime, kept consistent).
UPDATE country_templates
SET available_templates = ARRAY['modern', 'ats-classic', 'compact', 'eu-photo', 'moderncv'],
    default_template = pg_temp.typst_resume_template(default_template)
WHERE available_templates IS DISTINCT FROM ARRAY['modern', 'ats-classic', 'compact', 'eu-photo', 'moderncv']
   OR default_template IS DISTINCT FROM pg_temp.typst_resume_template(default_template);
ALTER TABLE country_templates ALTER COLUMN available_templates
  SET DEFAULT ARRAY['modern', 'ats-classic', 'compact', 'eu-photo', 'moderncv'];
