-- PRD v2, area 3: seed the study library with short original guides and attributed links
-- to free, well-maintained resources. Tags use the skill ids in lib/learn/skills.ts so the
-- skill-gap card can point at them. Idempotent by slug.

INSERT INTO public.library_items (slug, kind, title, url, source_name, body_md, tags, stage) VALUES

-- ==================== ORIGINAL GUIDES ====================

('read-a-job-description', 'guide', 'Reading a job description for the skills that matter', NULL, 'NextMilestone', $md$
Job descriptions mix must-haves, nice-to-haves and boilerplate. Ten minutes of sorting tells you what to study and what to put first on your resume.

## Sort every line into three buckets

- **Core:** skills named in the title, the first lines of the responsibilities, or repeated more than once.
- **Supporting:** tools listed once under "requirements".
- **Nice to have:** anything under "bonus", "preferred" or "a plus".

## Look across several postings

Collect five postings for the role you want and count how often each skill appears. Skills in four or five of them are the real bar for that role; one-offs are company-specific.

## Turn it into a plan

- Core skills you have: make sure your resume shows them with a result.
- Core skills you're missing: pick one and study it first.
- Nice-to-haves: skip them until the core is solid.

The skill-gap card on this page does a version of this count for your top job matches.
$md$, ARRAY['communication'], NULL),

('thirty-minute-study-session', 'guide', 'A 30-minute study session that sticks', NULL, 'NextMilestone', $md$
Short, focused sessions beat long, unfocused ones. This shape fits a lunch break.

## The plan

1. **2 min: pick one question.** "How does the event loop order promises and timers?" A question beats a topic.
2. **15 min: learn.** One lesson, one doc page or one video. No tab-hopping.
3. **8 min: use it.** Write a tiny example, solve one problem or explain it out loud.
4. **5 min: log it.** Write two or three sentences in your learning log: what you learned and one thing you're still unsure about.

## Why it works

Retrieving what you just learned (explaining it, using it) is what moves it into long-term memory. Rereading feels productive but sticks less.

## Come back to it

Glance at your log entries from a few days ago and try to answer the question again without looking. Gaps you find there are your next session.
$md$, ARRAY['data-structures'], 'student'),

('write-a-useful-learning-note', 'guide', 'Writing a learning note you will actually reuse', NULL, 'NextMilestone', $md$
Most notes are never read again. A useful note is short, in your words and easy to find.

## A simple format

- **The question:** what were you trying to understand?
- **The answer, in your words:** two or three sentences, as if explaining to a teammate.
- **One example:** a code snippet, command or diagram.
- **Source:** the link, so you can go deeper later.
- **Tags:** the skill or topic, such as `react` or `system-design`.

## Tips

- Write it right after you learn it, while the context is fresh.
- Prefer one idea per note over one long page.
- If you can't explain it in three sentences, note what's still confusing; that's your next session.
$md$, ARRAY['communication'], NULL),

('big-o-plain-terms', 'guide', 'Big O in plain terms', NULL, 'NextMilestone', $md$
Big O describes how the work grows as the input grows. It's about the shape of the curve, not exact timing.

## The common ones

- **O(1):** the same work regardless of size. Reading `arr[5]` or a `Map` lookup.
- **O(log n):** the input is halved each step. Binary search in a sorted array.
- **O(n):** one pass over the input. Finding the max in an array.
- **O(n log n):** efficient sorting, such as merge sort or the built-in `sort` in modern engines.
- **O(n²):** a loop inside a loop over the same input. Comparing every pair.

## Quick rules

- Drop constants: two passes over the array is still O(n).
- Keep the biggest term: O(n² + n) is O(n²).
- Nested loops over different inputs multiply: O(n × m).

## The frontend angle

Turning an O(n²) "find matching item" loop into an O(n) pass with a `Map` or `Set` is one of the most common real-world performance fixes, and a frequent interview follow-up.
$md$, ARRAY['data-structures', 'javascript'], 'student'),

-- ==================== EXTERNAL LINKS ====================

('mdn-learn-web-development', 'link', 'Learn web development', 'https://developer.mozilla.org/en-US/docs/Learn_web_development', 'MDN Web Docs', NULL, ARRAY['html', 'css', 'javascript'], 'student'),
('webdev-learn-html', 'link', 'Learn HTML', 'https://web.dev/learn/html', 'web.dev', NULL, ARRAY['html', 'accessibility'], 'student'),
('webdev-learn-css', 'link', 'Learn CSS', 'https://web.dev/learn/css', 'web.dev', NULL, ARRAY['css'], 'student'),
('javascript-info', 'link', 'The Modern JavaScript Tutorial', 'https://javascript.info/', 'javascript.info', NULL, ARRAY['javascript'], 'student'),
('typescript-handbook', 'link', 'The TypeScript Handbook', 'https://www.typescriptlang.org/docs/handbook/intro.html', 'TypeScript', NULL, ARRAY['typescript'], 'early'),
('react-dev-learn', 'link', 'Learn React', 'https://react.dev/learn', 'react.dev', NULL, ARRAY['react', 'state-management'], 'early'),
('webdev-learn-accessibility', 'link', 'Learn Accessibility', 'https://web.dev/learn/accessibility', 'web.dev', NULL, ARRAY['accessibility'], NULL),
('wai-aria-apg', 'link', 'ARIA Authoring Practices Guide', 'https://www.w3.org/WAI/ARIA/apg/', 'W3C Web Accessibility Initiative', NULL, ARRAY['accessibility'], 'early'),
('webdev-learn-performance', 'link', 'Learn Performance', 'https://web.dev/learn/performance', 'web.dev', NULL, ARRAY['performance'], 'early'),
('webdev-web-vitals', 'link', 'Web Vitals', 'https://web.dev/articles/vitals', 'web.dev', NULL, ARRAY['performance'], 'experienced'),
('mdn-http-overview', 'link', 'An overview of HTTP', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview', 'MDN Web Docs', NULL, ARRAY['http', 'rest'], 'student'),
('owasp-top-ten', 'link', 'OWASP Top Ten', 'https://owasp.org/www-project-top-ten/', 'OWASP Foundation', NULL, ARRAY['security'], 'experienced'),
('testing-library-principles', 'link', 'Guiding principles of Testing Library', 'https://testing-library.com/docs/guiding-principles', 'Testing Library', NULL, ARRAY['testing'], 'early'),
('pro-git-book', 'link', 'Pro Git (free book)', 'https://git-scm.com/book/en/v2', 'Scott Chacon and Ben Straub', NULL, ARRAY['git'], 'student'),
('patterns-dev', 'link', 'Patterns.dev: design, rendering and performance patterns', 'https://www.patterns.dev/', 'Lydia Hallie and Addy Osmani', NULL, ARRAY['system-design', 'react', 'performance'], 'experienced'),
('tech-interview-handbook', 'link', 'Tech Interview Handbook', 'https://www.techinterviewhandbook.org/', 'Yangshun Tay', NULL, ARRAY['data-structures', 'communication'], 'early'),
('google-code-review', 'link', 'Google engineering practices: code review', 'https://google.github.io/eng-practices/review/', 'Google', NULL, ARRAY['technical-leadership', 'mentoring'], 'experienced'),
('design-docs-at-google', 'link', 'Design docs at Google', 'https://www.industrialempathy.com/posts/design-docs-at-google/', 'Malte Ubl', NULL, ARRAY['communication', 'system-design', 'technical-leadership'], 'experienced'),
('staffeng-guides', 'link', 'StaffEng guides', 'https://staffeng.com/guides/', 'Will Larson', NULL, ARRAY['technical-leadership', 'mentoring'], 'leader'),
('sre-postmortem-culture', 'link', 'Postmortem culture: learning from failure', 'https://sre.google/sre-book/postmortem-culture/', 'Google SRE book', NULL, ARRAY['observability', 'technical-leadership'], 'leader')

ON CONFLICT (slug) DO UPDATE SET
  kind = EXCLUDED.kind, title = EXCLUDED.title, url = EXCLUDED.url, source_name = EXCLUDED.source_name,
  body_md = EXCLUDED.body_md, tags = EXCLUDED.tags, stage = EXCLUDED.stage;
