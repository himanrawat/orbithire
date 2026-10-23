-- PRD v2, area 6: Community (invite-only), plus the content_reports table behind the
-- admin moderation queue (area 12).
--
-- Visibility model:
--   * Only active members read community content, and only within their own field.
--   * Hidden posts and replies are visible to their author only.
--   * Content from people you blocked, who blocked you, or whom you muted is filtered out.
--   * Helpful reactions, saves, follows, blocks and mutes are private to the person who
--     made them. There are no public follower or like counts; helpful_count lives on the post.
-- Counters (helpful_count, reply_count, view_count) are kept by set-based statement
-- triggers and SECURITY DEFINER functions; members can't write them directly.

-- ==================== SETTINGS (singleton) ====================

CREATE TABLE IF NOT EXISTS public.community_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  launch_field TEXT NOT NULL DEFAULT 'software engineering'
    CHECK (char_length(launch_field) BETWEEN 2 AND 80),
  region TEXT NOT NULL DEFAULT 'US' CHECK (region ~ '^[A-Z]{2}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.community_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ==================== INVITES AND MEMBERS ====================

CREATE TABLE IF NOT EXISTS public.community_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,24}$'),
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 1000),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  field TEXT NOT NULL CHECK (char_length(field) BETWEEN 2 AND 80),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_invites_uses_cap CHECK (uses <= max_uses)
);

CREATE TABLE IF NOT EXISTS public.community_members (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  field TEXT NOT NULL CHECK (char_length(field) BETWEEN 2 AND 80),
  -- What other members see. Copied from the profile at join time so profiles stay private.
  display_name TEXT NOT NULL DEFAULT 'Member' CHECK (char_length(display_name) BETWEEN 1 AND 80),
  headline TEXT CHECK (headline IS NULL OR char_length(headline) <= 160),
  invite_id UUID REFERENCES public.community_invites(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT CHECK (suspended_reason IS NULL OR char_length(suspended_reason) <= 500),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_members_field ON public.community_members(field, status);

CREATE TABLE IF NOT EXISTS public.community_invite_requests (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== CONTENT ====================

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('milestone', 'learning', 'question', 'link')),
  topic TEXT NOT NULL CHECK (topic IN (
    'career-growth', 'interviews', 'job-search', 'frontend', 'backend',
    'system-design', 'leadership', 'learning'
  )),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  url TEXT CHECK (url IS NULL OR (char_length(url) <= 2048 AND url ~* '^https?://')),
  helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  reply_count INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_posts_link_shape CHECK (type <> 'link' OR url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_community_posts_field_created
  ON public.community_posts(field, created_at DESC) WHERE NOT hidden;
CREATE INDEX IF NOT EXISTS idx_community_posts_topic_created
  ON public.community_posts(field, topic, created_at DESC) WHERE NOT hidden;
CREATE INDEX IF NOT EXISTS idx_community_posts_author_created
  ON public.community_posts(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_replies_post_created
  ON public.community_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_replies_author
  ON public.community_replies(author_id, created_at DESC);

-- "Helpful" is the only reaction.
CREATE TABLE IF NOT EXISTS public.post_reactions (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'helpful' CHECK (kind = 'helpful'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON public.post_reactions(user_id);

CREATE TABLE IF NOT EXISTS public.post_saves (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_saves_user_created ON public.post_saves(user_id, created_at DESC);

-- One row per (post, viewer), so a refresh doesn't inflate helpful-per-view ranking.
CREATE TABLE IF NOT EXISTS public.post_views (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- ==================== RELATIONSHIPS ====================

CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id, blocker_id);

CREATE TABLE IF NOT EXISTS public.user_mutes (
  muter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (muter_id, muted_id),
  CHECK (muter_id <> muted_id)
);

-- ==================== REPORTS (moderation queue) ====================

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'misinformation', 'off-topic', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  resolution TEXT CHECK (resolution IS NULL OR resolution IN ('hidden', 'suspended', 'dismissed')),
  handled_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One open report per person per target.
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_one_open
  ON public.content_reports(reporter_id, target_type, target_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON public.content_reports(target_type, target_id);

-- ==================== HELPERS ====================

-- The caller's field when they are an active member, otherwise NULL. Signed-in callers
-- may only ask about themselves (auth.uid() is NULL for the service role and triggers
-- running as it), so membership and field of other users can't be probed over RPC.
CREATE OR REPLACE FUNCTION public.community_member_field(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT field FROM public.community_members
   WHERE user_id = p_user_id AND status = 'active'
     AND (auth.uid() IS NULL OR p_user_id = auth.uid());
$$;

-- TRUE when `p_author` should be hidden from `p_viewer`: a block in either direction,
-- or the viewer muted the author. Signed-in callers may only pass themselves as the
-- viewer, so blocks and mutes between other people stay private.
CREATE OR REPLACE FUNCTION public.community_is_filtered(p_viewer UUID, p_author UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND p_viewer IS DISTINCT FROM auth.uid() THEN NULL
    ELSE p_viewer <> p_author AND (
      EXISTS (SELECT 1 FROM public.user_blocks
               WHERE (blocker_id = p_viewer AND blocked_id = p_author)
                  OR (blocker_id = p_author AND blocked_id = p_viewer))
      OR EXISTS (SELECT 1 FROM public.user_mutes WHERE muter_id = p_viewer AND muted_id = p_author)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.community_member_field(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.community_is_filtered(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_member_field(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.community_is_filtered(UUID, UUID) TO authenticated, service_role;

-- New posts take the author's field, never a client-supplied one.
CREATE OR REPLACE FUNCTION public.community_posts_set_field()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.field := COALESCE(public.community_member_field(NEW.author_id), NEW.field);
  IF NEW.field IS NULL THEN
    RAISE EXCEPTION 'not an active community member' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_posts_set_field ON public.community_posts;
CREATE TRIGGER community_posts_set_field
  BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_posts_set_field();

CREATE OR REPLACE FUNCTION public.community_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_posts_touch ON public.community_posts;
CREATE TRIGGER community_posts_touch
  BEFORE UPDATE OF title, body, url, topic ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();
DROP TRIGGER IF EXISTS community_replies_touch ON public.community_replies;
CREATE TRIGGER community_replies_touch
  BEFORE UPDATE OF body ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();

-- ==================== COUNTERS (set-based statement triggers) ====================

CREATE OR REPLACE FUNCTION public.community_helpful_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.community_posts p
     SET helpful_count = p.helpful_count + d.n
    FROM (SELECT post_id, COUNT(*)::INTEGER AS n FROM new_rows GROUP BY post_id) d
   WHERE p.id = d.post_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_helpful_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.community_posts p
     SET helpful_count = GREATEST(0, p.helpful_count - d.n)
    FROM (SELECT post_id, COUNT(*)::INTEGER AS n FROM old_rows GROUP BY post_id) d
   WHERE p.id = d.post_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_reactions_count_insert ON public.post_reactions;
CREATE TRIGGER post_reactions_count_insert
  AFTER INSERT ON public.post_reactions
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.community_helpful_added();
DROP TRIGGER IF EXISTS post_reactions_count_delete ON public.post_reactions;
CREATE TRIGGER post_reactions_count_delete
  AFTER DELETE ON public.post_reactions
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.community_helpful_removed();

-- reply_count counts visible replies only.
CREATE OR REPLACE FUNCTION public.community_replies_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.community_posts p
     SET reply_count = p.reply_count + d.n
    FROM (SELECT post_id, COUNT(*)::INTEGER AS n FROM new_rows WHERE NOT hidden GROUP BY post_id) d
   WHERE p.id = d.post_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_replies_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.community_posts p
     SET reply_count = GREATEST(0, p.reply_count - d.n)
    FROM (SELECT post_id, COUNT(*)::INTEGER AS n FROM old_rows WHERE NOT hidden GROUP BY post_id) d
   WHERE p.id = d.post_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_replies_visibility_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.community_posts p
     SET reply_count = GREATEST(0, p.reply_count + d.delta)
    FROM (
      SELECT n.post_id, SUM(CASE WHEN n.hidden THEN -1 ELSE 1 END)::INTEGER AS delta
        FROM new_rows n
        JOIN old_rows o ON o.id = n.id
       WHERE o.hidden IS DISTINCT FROM n.hidden
       GROUP BY n.post_id
    ) d
   WHERE p.id = d.post_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_replies_count_insert ON public.community_replies;
CREATE TRIGGER community_replies_count_insert
  AFTER INSERT ON public.community_replies
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.community_replies_added();
DROP TRIGGER IF EXISTS community_replies_count_delete ON public.community_replies;
CREATE TRIGGER community_replies_count_delete
  AFTER DELETE ON public.community_replies
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.community_replies_removed();
DROP TRIGGER IF EXISTS community_replies_count_update ON public.community_replies;
CREATE TRIGGER community_replies_count_update
  AFTER UPDATE ON public.community_replies
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.community_replies_visibility_changed();

REVOKE ALL ON FUNCTION public.community_helpful_added() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_helpful_removed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_replies_added() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_replies_removed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_replies_visibility_changed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_posts_set_field() FROM PUBLIC, anon, authenticated;

-- ==================== RPCs ====================

-- Redeems an invite code for the caller, atomically. Returns
-- { ok, field } or { ok: false, error: 'invalid' | 'expired' | 'used_up' | 'suspended' }.
CREATE OR REPLACE FUNCTION public.redeem_community_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_invite public.community_invites%ROWTYPE;
  v_member public.community_members%ROWTYPE;
  v_name TEXT;
  v_headline TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member FROM public.community_members WHERE user_id = v_user;
  IF FOUND THEN
    IF v_member.status = 'suspended' THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'suspended');
    END IF;
    RETURN jsonb_build_object('ok', TRUE, 'field', v_member.field);
  END IF;

  SELECT * INTO v_invite FROM public.community_invites
   WHERE code = upper(btrim(p_code)) AND revoked_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid');
  END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= NOW() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'expired');
  END IF;
  IF v_invite.uses >= v_invite.max_uses THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'used_up');
  END IF;

  SELECT NULLIF(btrim(full_name), ''), NULLIF(btrim(headline), '')
    INTO v_name, v_headline
    FROM public.profiles WHERE id = v_user;

  INSERT INTO public.community_members (user_id, field, display_name, headline, invite_id)
  VALUES (v_user, v_invite.field, left(COALESCE(v_name, 'Member'), 80), left(v_headline, 160), v_invite.id);

  UPDATE public.community_invites SET uses = uses + 1 WHERE id = v_invite.id;
  UPDATE public.community_invite_requests SET status = 'invited' WHERE user_id = v_user;

  RETURN jsonb_build_object('ok', TRUE, 'field', v_invite.field);
END;
$$;

-- Counts one view per (post, viewer), excluding the author's own views. Set-based.
CREATE OR REPLACE FUNCTION public.community_record_views(p_post_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_field TEXT := public.community_member_field(auth.uid());
  v_count INTEGER;
BEGIN
  IF v_user IS NULL OR v_field IS NULL OR p_post_ids IS NULL THEN
    RETURN 0;
  END IF;

  WITH candidates AS (
    SELECT p.id
      FROM public.community_posts p
     WHERE p.id = ANY (p_post_ids[1:50])
       AND p.field = v_field
       AND p.author_id <> v_user
       AND NOT p.hidden
  ), inserted AS (
    INSERT INTO public.post_views (post_id, user_id)
    SELECT id, v_user FROM candidates
    ON CONFLICT (post_id, user_id) DO NOTHING
    RETURNING post_id
  ), bumped AS (
    UPDATE public.community_posts p
       SET view_count = p.view_count + 1
      FROM inserted i
     WHERE p.id = i.post_id
    RETURNING p.id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM bumped;

  RETURN v_count;
END;
$$;

-- "People a few steps ahead": active members in the caller's field whose career stage is
-- later than the caller's, closest stage first. Never returns blocked, muted or followed people.
CREATE OR REPLACE FUNCTION public.community_people_ahead(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (user_id UUID, display_name TEXT, headline TEXT, career_stage TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH me AS (
    SELECT m.user_id, m.field,
           CASE pr.career_stage
             WHEN 'student' THEN 1 WHEN 'early' THEN 2
             WHEN 'experienced' THEN 3 WHEN 'leader' THEN 4 ELSE 1 END AS rank
      FROM public.community_members m
      JOIN public.profiles pr ON pr.id = m.user_id
     WHERE m.user_id = auth.uid() AND m.status = 'active'
  ), ranked AS (
    SELECT m.user_id, m.display_name, m.headline, pr.career_stage, m.joined_at,
           CASE pr.career_stage
             WHEN 'student' THEN 1 WHEN 'early' THEN 2
             WHEN 'experienced' THEN 3 WHEN 'leader' THEN 4 END AS rank
      FROM public.community_members m
      JOIN public.profiles pr ON pr.id = m.user_id
      JOIN me ON me.field = m.field AND me.user_id <> m.user_id
     WHERE m.status = 'active'
  )
  SELECT r.user_id, r.display_name, r.headline, r.career_stage
    FROM ranked r, me
   WHERE r.rank > me.rank
     AND NOT public.community_is_filtered(me.user_id, r.user_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.user_follows f WHERE f.follower_id = me.user_id AND f.followee_id = r.user_id
     )
   ORDER BY r.rank - me.rank, r.joined_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.redeem_community_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.community_record_views(UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.community_people_ahead(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_community_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_record_views(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_people_ahead(INTEGER) TO authenticated;

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invite_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Settings: readable by signed-in users (the join screen names the launch field).
DROP POLICY IF EXISTS community_settings_read ON public.community_settings;
CREATE POLICY community_settings_read ON public.community_settings
  FOR SELECT TO authenticated USING (TRUE);

-- Invites: service role only (no policies). Redemption goes through the RPC.

-- Members: you always see your own row; active members see other active members in their field.
DROP POLICY IF EXISTS community_members_select ON public.community_members;
CREATE POLICY community_members_select ON public.community_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR (status = 'active' AND field = public.community_member_field(auth.uid()))
  );

-- Invite requests: your own only.
DROP POLICY IF EXISTS community_invite_requests_select ON public.community_invite_requests;
CREATE POLICY community_invite_requests_select ON public.community_invite_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS community_invite_requests_insert ON public.community_invite_requests;
CREATE POLICY community_invite_requests_insert ON public.community_invite_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Posts
DROP POLICY IF EXISTS community_posts_select ON public.community_posts;
CREATE POLICY community_posts_select ON public.community_posts
  FOR SELECT TO authenticated USING (
    field = public.community_member_field(auth.uid())
    AND (NOT hidden OR author_id = auth.uid())
    AND NOT public.community_is_filtered(auth.uid(), author_id)
  );
DROP POLICY IF EXISTS community_posts_insert ON public.community_posts;
CREATE POLICY community_posts_insert ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND public.community_member_field(auth.uid()) IS NOT NULL
  );
DROP POLICY IF EXISTS community_posts_update ON public.community_posts;
CREATE POLICY community_posts_update ON public.community_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.community_member_field(auth.uid()) IS NOT NULL)
  WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS community_posts_delete ON public.community_posts;
CREATE POLICY community_posts_delete ON public.community_posts
  FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Replies: readable when the parent post is readable (its own policy applies in the subquery).
DROP POLICY IF EXISTS community_replies_select ON public.community_replies;
CREATE POLICY community_replies_select ON public.community_replies
  FOR SELECT TO authenticated USING (
    (NOT hidden OR author_id = auth.uid())
    AND NOT public.community_is_filtered(auth.uid(), author_id)
    AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id)
  );
DROP POLICY IF EXISTS community_replies_insert ON public.community_replies;
CREATE POLICY community_replies_insert ON public.community_replies
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND NOT p.hidden)
  );
DROP POLICY IF EXISTS community_replies_update ON public.community_replies;
CREATE POLICY community_replies_update ON public.community_replies
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.community_member_field(auth.uid()) IS NOT NULL)
  WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS community_replies_delete ON public.community_replies;
CREATE POLICY community_replies_delete ON public.community_replies
  FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Reactions, saves and views: private to the person; only on posts they can read.
DROP POLICY IF EXISTS post_reactions_select ON public.post_reactions;
CREATE POLICY post_reactions_select ON public.post_reactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS post_reactions_insert ON public.post_reactions;
CREATE POLICY post_reactions_insert ON public.post_reactions
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND NOT p.hidden)
  );
DROP POLICY IF EXISTS post_reactions_delete ON public.post_reactions;
CREATE POLICY post_reactions_delete ON public.post_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS post_saves_select ON public.post_saves;
CREATE POLICY post_saves_select ON public.post_saves
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS post_saves_insert ON public.post_saves;
CREATE POLICY post_saves_insert ON public.post_saves
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id)
  );
DROP POLICY IF EXISTS post_saves_delete ON public.post_saves;
CREATE POLICY post_saves_delete ON public.post_saves
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS post_views_select ON public.post_views;
CREATE POLICY post_views_select ON public.post_views
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Follows, blocks, mutes: you see and manage only your own rows.
DROP POLICY IF EXISTS user_follows_select ON public.user_follows;
CREATE POLICY user_follows_select ON public.user_follows
  FOR SELECT TO authenticated USING (follower_id = auth.uid());
DROP POLICY IF EXISTS user_follows_insert ON public.user_follows;
CREATE POLICY user_follows_insert ON public.user_follows
  FOR INSERT TO authenticated WITH CHECK (
    follower_id = auth.uid() AND public.community_member_field(auth.uid()) IS NOT NULL
  );
DROP POLICY IF EXISTS user_follows_delete ON public.user_follows;
CREATE POLICY user_follows_delete ON public.user_follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_select ON public.user_blocks;
CREATE POLICY user_blocks_select ON public.user_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS user_blocks_insert ON public.user_blocks;
CREATE POLICY user_blocks_insert ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS user_blocks_delete ON public.user_blocks;
CREATE POLICY user_blocks_delete ON public.user_blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_mutes_select ON public.user_mutes;
CREATE POLICY user_mutes_select ON public.user_mutes
  FOR SELECT TO authenticated USING (muter_id = auth.uid());
DROP POLICY IF EXISTS user_mutes_insert ON public.user_mutes;
CREATE POLICY user_mutes_insert ON public.user_mutes
  FOR INSERT TO authenticated WITH CHECK (muter_id = auth.uid());
DROP POLICY IF EXISTS user_mutes_delete ON public.user_mutes;
CREATE POLICY user_mutes_delete ON public.user_mutes
  FOR DELETE TO authenticated USING (muter_id = auth.uid());

-- Reports: members file them and see their own; moderators work the queue with the service role.
DROP POLICY IF EXISTS content_reports_select ON public.content_reports;
CREATE POLICY content_reports_select ON public.content_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS content_reports_insert ON public.content_reports;
CREATE POLICY content_reports_insert ON public.content_reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'open'
    AND public.community_member_field(auth.uid()) IS NOT NULL
  );

-- ==================== GRANTS ====================
-- Column-level grants keep counters, hidden flags and fields out of members' hands.

REVOKE ALL ON public.community_settings, public.community_invites, public.community_members,
  public.community_invite_requests, public.community_posts, public.community_replies,
  public.post_reactions, public.post_saves, public.post_views, public.user_follows,
  public.user_blocks, public.user_mutes, public.content_reports FROM anon;
REVOKE ALL ON public.community_settings, public.community_invites, public.community_members,
  public.community_invite_requests, public.community_posts, public.community_replies,
  public.post_reactions, public.post_saves, public.post_views, public.user_follows,
  public.user_blocks, public.user_mutes, public.content_reports FROM authenticated;

GRANT SELECT ON public.community_settings, public.community_members, public.community_invite_requests,
  public.community_posts, public.community_replies, public.post_reactions, public.post_saves,
  public.post_views, public.user_follows, public.user_blocks, public.user_mutes,
  public.content_reports TO authenticated;

GRANT INSERT (user_id, note) ON public.community_invite_requests TO authenticated;
GRANT INSERT (author_id, type, topic, title, body, url) ON public.community_posts TO authenticated;
GRANT UPDATE (title, body, url, topic) ON public.community_posts TO authenticated;
GRANT DELETE ON public.community_posts TO authenticated;
GRANT INSERT (post_id, author_id, body) ON public.community_replies TO authenticated;
GRANT UPDATE (body) ON public.community_replies TO authenticated;
GRANT DELETE ON public.community_replies TO authenticated;
GRANT INSERT (post_id, user_id), DELETE ON public.post_reactions, public.post_saves TO authenticated;
GRANT INSERT (follower_id, followee_id), DELETE ON public.user_follows TO authenticated;
GRANT INSERT (blocker_id, blocked_id), DELETE ON public.user_blocks TO authenticated;
GRANT INSERT (muter_id, muted_id), DELETE ON public.user_mutes TO authenticated;
GRANT INSERT (reporter_id, target_type, target_id, reason, details) ON public.content_reports TO authenticated;

GRANT ALL ON public.community_settings, public.community_invites, public.community_members,
  public.community_invite_requests, public.community_posts, public.community_replies,
  public.post_reactions, public.post_saves, public.post_views, public.user_follows,
  public.user_blocks, public.user_mutes, public.content_reports TO service_role;
