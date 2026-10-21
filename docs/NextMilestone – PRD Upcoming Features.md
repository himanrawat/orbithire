# NextMilestone – PRD: Upcoming Features

Oct 22, 2026 · @Himanshu

## Summary

NextMilestone grows from a job-search tool (OrbitHire v2) into one place for every step of a career: learn, practise, focus, find the right role and share progress. This PRD specifies the eight feature areas that take it there. They are designed on the product canvas, and each builds on the platform shipped in Waves 1–4.

**What exists today:** daily job fetch from \~30 sources, ranking, a Job Inbox, applications, Typst resumes and cover letters, an MCP server with OAuth for Claude and ChatGPT, and imports.

**What this PRD adds:**

| Area | One line | Design board |
| --- | --- | --- |
| Rebrand & onboarding | NextMilestone name and identity; a 4-step, stage-aware setup | Website, Sign up, Onboarding |
| Today | One home screen with the single next step and a daily plan | Today, Mobile |
| Learn | Learning log, learning paths, study library, skill gaps from jobs | Learn |
| Interview prep | Most-asked question bank, practice flow, mock interviews with feedback | Interview prep |
| Focus & schedule | Focus timer, weekly time blocks, calendar sync | Focus & schedule |
| Community | Posts (milestone, learning, question, link), follows, "Helpful" ranking | Community |
| Profile & milestones | Public milestone timeline with per-item privacy | Profile |
| Mobile | Phone-first PWA for Today, logging and focus | Mobile · Today |

**Goal for the next two quarters:** a person at any career stage opens NextMilestone most weekdays because it tells them the one useful thing to do next.

## Users & stages

One product serves four career stages. The stage chosen at onboarding changes defaults and emphasis, never the app's structure.

| Stage | Typical user | Main jobs to be done | What we put first |
| --- | --- | --- | --- |
| Student | Final-year student or recent graduate | Learn fundamentals, build projects, land an internship or first role | Learning paths, study library, most-asked basics, first resume |
| Early career (0–3 yrs) | Junior to mid professional | Find a better-fitting role, get faster at interviews | Ranked Job Inbox, tailored documents, interview prep |
| Experienced (3–10 yrs) | Senior IC, possibly switching | Grow to the next level or change direction, quietly | Skill gaps, system design prep, focus time, private search |
| Senior & leader (10+ yrs) | Lead, manager, principal | Lead in public, mentor, prepare for leadership interviews | Public milestones, posts, leadership prep |

**Regions:** India first, then the UK, Europe, the US, Australia, New Zealand and Singapore, matching the job sources already built.

**Accessibility baseline for all users:** WCAG 2.2 AA, keyboard-first (⌘K), 44 px touch targets, screen-reader labels on every control.

## Principles & non-goals

Every feature below is reviewed against these five principles from the design system.

1. **One clear next step.** Each screen leads with the single most useful action; secondary actions wait one click away.
2. **Progress, not pressure.** Celebrate milestones. No streak-shaming, no guilt copy, no dark patterns in notifications.
3. **Grows with you.** Stage-aware defaults; the same app for a student and a VP.
4. **AI drafts, you decide.** AI output is labelled, editable and versioned. Nothing is sent, applied for or published without the user.
5. **Fast, accessible, keyboard-first.** ⌘K everywhere, AA contrast, works on a phone and with a screen reader.

**Non-goals (this PRD):**

- Auto-applying to jobs or messaging recruiters on the user's behalf.
- A recruiter-side product, job posting or paid placements.
- Video courses produced in-house; the library curates and links, with short original guides only.
- Native iOS/Android apps; mobile ships as a PWA first.
- Public follower counts or like counts as status signals.

## Feature specs

Each area lists its problem, user stories, prioritised requirements (Must / Should / Could), UX notes, data needs and how we'll know it works. Data needs extend the existing Supabase schema (migrations 000–028) and the Python worker.

### 1. Rebrand & stage-aware onboarding

**Problem.** The app still shows "CVLeap AI" and "OrbitHire", and everyone gets the same jobs-first setup, so students and leaders bounce.

**User stories**

- As a new user, I pick my stage and goals in under 2 minutes so the app shows me relevant things first.
- As a returning user, I can change my stage later when my career changes.
- As a user with a resume, I import it and review each field before it is saved.

| Priority | Requirement |
| --- | --- |
| Must | Replace every user-facing name, logo and email sender with NextMilestone; keep internal identifiers (`orbithire_worker`, `orb_` tokens) unchanged |
| Must | 4-step onboarding: stage → goals (multi-select) → target role + location + optional PDF import → weekly rhythm; every step skippable |
| Must | Stage and goals stored on the profile and editable in Settings → Career stage & goals |
| Must | Imported fields shown as a review list; nothing saved without confirmation |
| Should | Stage-specific default sidebar emphasis and Today plan composition |
| Could | LinkedIn PDF import alongside resume PDF |

**UX notes.** Progress bar with "Step n of 4", Back / Continue, "Skip for now" always visible. Finishes on "Your plan is ready" with a single CTA to Today.

**Data.** `profiles.career_stage` (student | early | experienced | leader), `profiles.goals text[]`, `profiles.target_role`, `profiles.target_locations text[]`, `profiles.weekly_focus_hours`, `profiles.onboarded_at`.

**Success.** ≥ 70% of sign-ups finish onboarding; median completion time ≤ 2 min; day-7 retention up vs the current jobs-only setup.

### 2. Today (home)

**Problem.** Users land on a dashboard of counts and have to decide what matters. The product should decide the next step for them.

**User stories**

- As any user, I open the app and see the one most useful thing to do right now, with why.
- As a busy professional, I tick off a short daily plan across learning, prep, focus and jobs.
- As a learner, I log something I learned in one line without leaving Today.

| Priority | Requirement |
| --- | --- |
| Must | "Your next step" card: one action, its reason, Start and "Not today" (dismiss teaches the ranker) |
| Must | Daily plan of 3–5 items generated each morning from upcoming interviews, path progress, focus blocks and shortlisted jobs; checkable |
| Must | Top 3 new job matches with score, linking to the Job Inbox |
| Must | Coming up: next focus block, interview, follow-up |
| Should | Quick learning-log input that writes to Learn |
| Should | Weekly stats (focus time vs goal, items learned) without streaks |
| Could | Plan regeneration on demand; drag to reorder |

**Next-step logic (v1, rules not ML).** Highest-priority wins: interview within 3 days → matching prep question; follow-up due today → draft follow-up; path lesson in progress → continue lesson; new matches ≥ 80 → review them; else focus block. Each rule is unit-tested and explainable in the card's reason line.

**Data.** `daily_plans(user_id, date, items jsonb, generated_at)`, `plan_items` checked state; a `generate_daily_plan` task in the worker queue at 06:30 local time.

**Success.** ≥ 40% of weekly active users act on the next-step card at least 3 days a week; plan completion rate ≥ 50%.

### 3. Learn

**Problem.** Learning happens in many tabs and is lost; users can't show it or connect it to jobs they want.

**User stories**

- As a student, I follow a path for my target role with curated material.
- As anyone, I paste a link or write a line about what I learned; it's saved, tagged and private by default.
- As a job seeker, I see which skills my top matches ask for that I lack, and add them to my path in one click.

| Priority | Requirement |
| --- | --- |
| Must | Learning log: link or text entry, auto-fetched title, tags, private/public toggle, timeline view |
| Must | Learning paths: ordered lessons with progress; 4 launch paths (web foundations, frontend interview, frontend system design, senior to lead) |
| Must | Skill-gap card derived from job-match skill lists vs profile skills |
| Should | Study library: cheat sheets, guides, checklists filtered by stage and topic |
| Should | "Share to profile" turns an entry into a public milestone or post |
| Could | Spaced-repetition reminders for saved notes |

**Content.** Library items are short original guides plus curated external links with attribution; no copyrighted course content is re-hosted.

**Data.** `learning_entries(id, user_id, kind link|note|course|project, url, title, note, tags[], visibility, created_at)`, `paths`, `path_lessons`, `path_progress(user_id, lesson_id, done_at)`, `library_items`. Skill gaps computed from `job_postings` text + `profiles.skills`.

**Success.** ≥ 30% of WAU log at least one item a week; path lesson completion ≥ 60% once started.

### 4. Interview prep

**Problem.** Candidates prepare from scattered lists, don't know which questions are actually asked for their role, and get no feedback before the real interview.

**User stories**

- As an early-career engineer, I see the most-asked questions for my target role and practise them.
- As a candidate with an interview on Friday, I get a prep plan tied to that application.
- As anyone, I answer by typing or voice and get structured, honest feedback.
- As a leader, I practise leadership and stakeholder questions, not just coding.

| Priority | Requirement |
| --- | --- |
| Must | Question bank by role, topic, level and stage; "Most asked" flag; practised state per user |
| Must | Practice flow: Think → Answer → Review, with optional framework hint (STAR, Requirements → API → Data → Scale) |
| Must | AI feedback on typed answers: strengths, gaps, one next study link; clearly labelled as AI |
| Must | Interview card linked to an application: date, round type, prep checklist |
| Should | Timed 30-minute mock interview: 3–4 questions in sequence, summary at the end |
| Should | Voice answers with transcription, then the same feedback |
| Could | Company-type packs (startup, product company, services, FAANG-style) |

**"Most asked" source of truth.** Frequency comes from our own data: questions users tag as asked after real interviews, plus curated seed sets per role. No scraped proprietary interview content.

**Data.** `questions(id, text, role, topic, level, stage[], framework, hint, sources)`, `question_reports(user_id, question_id, company_type, asked_at)`, `practice_attempts(user_id, question_id, answer, mode text|voice, feedback jsonb, created_at)`, `interviews(id, user_id, company_id, at, round, checklist jsonb)`. Feedback runs as a worker task using the user's own AI key when set, else the platform key within quota.

**Success.** Users with an interview scheduled complete ≥ 3 practice attempts before it; self-reported confidence rises between first and last attempt.

### 5. Focus & schedule

**Problem.** Learning and job search lose to notifications and busy weeks; users need protected time, not more reminders.

**User stories**

- As a professional, I plan my week in focus blocks around my calendar.
- As anyone, I start a 25 / 50 / 90-minute session tied to a task, and the app holds notifications until I'm done.
- As a student, I see how much focused time I spent this week against my own goal, without streak pressure.

| Priority | Requirement |
| --- | --- |
| Must | Focus timer with task picker and 25 / 50 / 90 lengths; pause and resume; works offline in the PWA |
| Must | "Hold notifications" during a session (in-app and push) |
| Must | Weekly schedule of blocks by type (Focus, Learn, Prep and interviews); create, move, delete |
| Should | Two-way Google Calendar sync for blocks and interviews; Outlook next |
| Should | Weekly focus total vs goal on Today |
| Could | Ambient sound; strict mode that blocks other NextMilestone screens |

**Data.** `focus_sessions(user_id, task_ref, planned_min, actual_min, started_at, ended_at)`, `schedule_blocks(user_id, kind, title, starts_at, ends_at, calendar_event_id)`, `calendar_connections(user_id, provider, tokens encrypted)`.

**Success.** ≥ 25% of WAU complete one focus session a week; median weekly focused time grows month over month.

### 6. Community

**Problem.** Career progress is lonely; existing networks reward self-promotion over useful sharing.

**User stories**

- As a student, I follow people a few steps ahead of me and learn from what they share.
- As anyone, I post a milestone, a learning, a question or a link in seconds, including straight from my Learn log.
- As a reader, I mark posts "Helpful" instead of liking them, and the feed favours what helps.

| Priority | Requirement |
| --- | --- |
| Must | Post types: Milestone, Learning, Question, Link; text + one link; edit and delete |
| Must | Feeds: For you, Following, and one topic feed per field |
| Must | Helpful reaction (count shown on the post, not on profiles), replies, save |
| Must | Report, block, mute; moderation queue in admin; rate limits on new accounts |
| Should | "People a few steps ahead" suggestions based on stage, role and skills |
| Should | Ranking by helpful-per-view with time decay; no engagement-bait boosts |
| Could | Mentorship requests (opt-in for leaders) |

**Trust & safety.** Community guidelines shown in the composer; no recruiting spam; AI-assisted pre-screening of reports, with a person deciding removals. Launch invite-only per field to seed quality.

**Data.** `posts(id, user_id, type, body, url, learning_entry_id, visibility, created_at)`, `post_replies`, `post_reactions(user_id, post_id, kind helpful)`, `follows(follower_id, followee_id)`, `reports(id, reporter_id, target_type, target_id, reason, status)`.

**Success.** ≥ 15% of WAU read the feed weekly; ≥ 5% post monthly; reported-content rate < 0.5% of posts.

### 7. Profile & milestones

**Problem.** A resume shows titles, not growth. Users want a living record of what they learned and achieved, with control over who sees what.

**User stories**

- As anyone, I add milestones (shipped, learned, passed, promoted) and choose public or private for each.
- As a job seeker, I can be "quietly open to roles" without my current employer seeing it.
- As a visitor, I see a clean public profile with milestones, skills and links.

| Priority | Requirement |
| --- | --- |
| Must | Milestone timeline: title, date, note, visibility; add manually or from Learn, Prep and Applications events |
| Must | "Preview as public" toggle that hides private items and job-search status |
| Must | Public profile URL with skills, current learning and links; opt-in indexing by search engines |
| Should | Auto-suggested milestones (e.g. path completed, 10 mocks done) the user accepts or dismisses |
| Should | "Quietly open to roles" visible only to recruiters the user approves (later phase) |
| Could | Export profile as a one-page Typst PDF |

**Data.** `milestones(id, user_id, title, note, happened_on, kind, source_ref, visibility)`, `profiles.public_slug`, `profiles.open_to_roles`, `profiles.searchable`.

**Success.** ≥ 50% of users add 3+ milestones within a month; public profile views per active user rise each month.

### 8. Mobile (PWA)

**Problem.** The quick, daily moments (checking the plan, logging a learning, starting a focus session) happen on phones.

| Priority | Requirement |
| --- | --- |
| Must | Installable PWA; bottom tabs: Today, Learn, Log (+), Jobs, Me |
| Must | Today, quick log, focus timer and job review fully usable at 390 px width |
| Must | Web push for the morning plan, follow-ups and interview reminders, all individually switchable |
| Should | Offline: focus timer and log entries queue and sync later |
| Could | Native shells (Capacitor) once PWA retention is proven |

**Success.** ≥ 35% of WAU use mobile weekly; push opt-out rate < 20%.

## Roadmap

Four phases ship in order. Each one starts only after the previous one meets its gate metric, so quality isn't traded for scope.

&#91;embedded content: release roadmap · 4 phases, 3 gates\]

Phase A goes first because the rebrand and stage-aware Today change what every later feature looks like. Community comes last because it needs content from Learn, Prep and milestones to be worth reading.

## Success metrics, risks, open questions

**North-star metric:** weekly active users who complete at least one meaningful action (a plan item, lesson, practice attempt, focus session, application step or post) on 3+ days that week.

| Guardrail | Target |
| --- | --- |
| Day-30 retention | Above the current jobs-only baseline (to be measured before Phase A) |
| Notification opt-out | < 20% |
| AI cost per weekly active user | Within the platform budget \[BUDGET\]; users with their own key cost nothing |
| Accessibility | 0 critical axe violations on every release |
| Reported content | < 0.5% of posts |

**Risks**

| Risk | Mitigation |
| --- | --- |
| Scope: eight areas at once dilutes quality | Ship in phases; each phase gated on its metrics |
| "Most asked" questions seen as made up | Show the source (user reports, curated seed); never claim external data we don't have |
| AI feedback is wrong or harsh | Label as AI, keep feedback specific and kind, one-click "this was wrong" report |
| Community spam or harassment | Invite-only seeding, rate limits, report/block, human moderation |
| Calendar sync permissions scare users | Read-only first; write access only for blocks the user creates |
| Name "NextMilestone" trademark conflict | Trademark search (USPTO, EUIPO, IP India) before public launch |
| Scraped job sources break | Already isolated per source with kill switches; keep API sources as the base |

**Open questions**

- [ ] Final brand name and domain (NextMilestone vs alternatives) — needed before Phase A ships.
- [ ] Pricing for Pro and Campus plans; what stays free forever.
- [ ] Who writes and reviews the first learning paths and question sets?
- [ ] Voice answers: on-device transcription or a hosted API?
- [ ] Community launch: which first field (frontend? data?) and invite size?
- [ ] Do recruiters ever get access ("quietly open to roles"), and under what consent model?
