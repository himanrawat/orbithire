# NextMilestone – PRD: Upcoming Features

**Version 2** · Oct 22, 2026 · Himanshu Rawat · Supersedes v1 of the same date ([Claude Docs original](https://claude.ai/artifact/AB4rFRG6ZBjESona7eWYp6); v1 is in this file's git history)

NextMilestone turns OrbitHire, a job-search tool, into a US-first career platform. Every weekday it tells a person the one most useful next step, across learning, interview prep, focus time and jobs. v2 keeps v1's eight feature areas. It corrects what v1 got wrong against the code and the market, adds four areas v1 left out (job supply, pricing, trust and compliance, admin), and ends with a research plan for the questions that are still open.

---

## 1. What changed from v1

v1 was checked against the codebase, the marketing site built on Oct 22, and outside research (Section 15).

| # | v1 said | Finding | v2 change |
| --- | --- | --- | --- |
| 1 | India first, then UK, EU, US, AU, NZ, SG | Decision on Oct 22: NextMilestone positions as an American startup | **US first**, then Canada, UK, Europe, Australia. Pay in dollars, US date and time formats, American spelling. Indian-only sources (Naukri, Instahyre, Cutshort) become optional. |
| 2 | "Daily job fetch from ~30 sources" | The code has 8 ATS adapters, 15 API or feed sources (4 of them opt-in scrapers) and 8 JobSpy boards. The repo's own research rules out LinkedIn, Glassdoor and Indeed scraping for production because of their terms. | New area 9, **US job supply**: employer ATS feeds first. Count sources only when they are terms-compatible. |
| 3 | Rebrand is one Must row | Ten surfaces still said CVLeap AI or OrbitHire, from the root metadata to the package name | Area 1 tracks them as a checklist. All but the email sender name were done on Oct 22. |
| 4 | Calendar sync is a Should | Google Calendar scopes are "sensitive": app verification, no security audit. Gmail read scopes are "restricted": a yearly CASA audit by an approved lab. Settings already shows Gmail and Outlook "connect" cards with no backend behind them. | Calendar stays. **Reading Gmail is out of scope** until there is a budget for the audit. The dead cards are hidden. |
| 5 | Web push as a Must | On iOS, web push works only after the app is added to the Home Screen (iOS 16.4+), and permission must follow a tap | Area 8 adds an install step before asking for push. The opt-out metric is measured per platform. |
| 6 | Non-goals | Leading rivals sell a "live interview copilot" with a "stealth mode" | New non-goal: **no help during a live interview**. Prep only. |
| 7 | Pricing is an open question | Benchmarks found: Huntr Pro $40 a month, Final Round AI Pro $25 a month (both checked on the vendors' pages) | New area 10, **Pricing**, with US auto-renewal rules |
| 8 | Trademark search in USPTO, EUIPO and IP India | A web search found no "NextMilestone" app or mark. That is not a clearance. | Search USPTO, CIPO, UKIPO and EUIPO. IP India drops off the list. |
| 9 | Nothing on privacy law | About 20 US states have comprehensive privacy laws, 12 require honoring Global Privacy Control, and California's auto-renewal law tightened on Jul 1, 2025 | New area 11, **Trust and compliance** |
| 10 | Nothing on admin | The admin session cookie is the admin's raw database id: unsigned, with no server-side expiry | New area 12, **Admin and owner**. Fixing the session is a Must before launch. |
| 11 | No link to the marketing site | The new pages promise specific things: plan at 6:30 AM, matches at 7 AM, 4 launch paths, voice answers, an offline timer, an invite-only community, Google Calendar at launch | Each promise is tied to a Must below, or the copy changes (Section 13). |

---

## 2. Summary

**Today (built, Waves 1–4):**
- A daily job fetch, de-duplication and ranking, feeding a Job Inbox
- Applications tracking
- Typst resumes and cover letters
- Resume imports
- An MCP server with OAuth 2.1, so Claude and ChatGPT can use a person's data
- Self-hosted Supabase (29 migrations, `000`–`028`), a Python worker with a Postgres task queue, and Cloudflare R2 for files
- The new marketing site: home, 4 product pages, community, questions, contact, privacy and terms

**v2 adds:**

| # | Area | One line |
| --- | --- | --- |
| 1 | Rebrand and onboarding | Finish the rebrand; a 4-step setup that adapts to career stage |
| 2 | Today | The one next step and a 3–5 item daily plan |
| 3 | Learn | A learning log, learning paths, a study library and skill gaps taken from jobs |
| 4 | Interview prep | A most-asked question bank, practice flow, mock interviews and feedback |
| 5 | Focus and schedule | A focus timer, weekly blocks and Google Calendar sync |
| 6 | Community | Posts ranked by "Helpful", invite-only at launch |
| 7 | Profile and milestones | A milestone timeline with privacy set per item |
| 8 | Mobile PWA | An installable phone app for Today, logging and focus |
| 9 | **US job supply** (new) | Employer ATS feeds as the backbone, with sources checked against their terms |
| 10 | **Pricing and billing** (new) | Free and Pro plans, US-compliant renewal and cancellation |
| 11 | **Trust and compliance** (new) | US state privacy laws, export and delete, labels on AI output |
| 12 | **Admin and owner** (new) | A secure owner account, roles and a moderation queue |

**Goal for the next two quarters:** a person at any career stage opens NextMilestone on most weekdays, because it tells them the one useful thing to do next.

---

## 3. Market and research findings (US)

**The labor market rewards preparing over applying.** The August 2026 Job Openings and Labor Turnover Survey (JOLTS) counted 7.1 million openings (4.3%), 5.2 million hires (3.3%), 3.1 million quits (1.9%) and 1.6 million layoffs (1.0%). That is a low-hire, low-quit market ([BLS JOLTS, Sep 29, 2026](https://www.bls.gov/news.release/jolts.nr0.htm)). Most people are staying in their jobs, so the product has to be useful to someone who isn't actively applying: through learning, milestones and quietly keeping their options open.

**Adoption of AI in the job search is real but not universal.** In an August 2026 survey of 500 US job seekers, 46.7% of Gen Z used AI in their search, against 35% of Millennials. 64% of all respondents used none ([WBOC / press release](https://www.wboc.com/online_features/press_releases/36-of-job-seekers-use-ai-in-their-search-and-half-never-tell-employers/article_ffb6442b-6123-599b-909d-17df41919986.html)). Other surveys put Gen Z between about 45% and 70%. AI should help in the background, not be the pitch.

**Competitors each cover one slice.**

| Product | Focus | Price (US) | What we take from it |
| --- | --- | --- | --- |
| [Huntr](https://huntr.co/pricing) | Job tracker and resumes | Free up to 100 jobs; Pro **$40/mo** or $90 a quarter (checked) | Free-tier limits are the main reason people upgrade |
| [Teal](https://www.tealhq.com/teal-vs-huntr) | Tracker and resume builder | Free tracker with no job limit; Teal+ reported at $13/week or $29 per 30 days (**unverified**; the pricing page blocked our fetch) | A generous free tracker is now expected |
| Simplify | Autofill and tracking | Core is free; Simplify+ reported at $39.99/mo (**unverified**, from [third-party reviews](https://jobshinobi.com/compare/best-job-tracking-app-2026)) | We won't compete on autofill (non-goal) |
| [Final Round AI](https://www.finalroundai.com/pricing) | Interview "copilot" | Free; Pro **$25/mo** (checked), including "Stealth Mode" | Puts us on the other side: prep, not live help |
| [Handshake](https://joinhandshake.com/about/) | College careers network | Free for students; 9M+ active students (company figure) | The student stage needs a reason to use us alongside Handshake: daily learning and prep |
| LinkedIn | Network and jobs | Free; Premium | Like and follower counts are the status game we avoid |

**The gap:** none of these turns learning, prep, focus and jobs into one daily plan that adapts to career stage. Job trackers stop at jobs, and interview tools stop at the interview.

**Positioning:** *"Know your next step. Then take it."* A calm daily career plan, for everyone from a college senior to a VP.

---

## 4. Users and stages

The stage chosen at onboarding changes defaults and emphasis, never the app's structure.

| Stage | Typical US user | Main jobs to be done | What we put first |
| --- | --- | --- | --- |
| Student | College junior or senior, bootcamp grad, new grad | Learn the fundamentals, build projects, land an internship or first job | Learning paths, study library, most-asked basics, first resume |
| Early career (0–3 yrs) | Junior to mid-level | Find a better-fitting role, interview faster | Ranked Job Inbox, tailored documents, interview prep |
| Experienced (3–10 yrs) | Senior IC, possibly changing direction | Reach the next level or move, without telling anyone | Skill gaps, system design prep, focus time, private search |
| Leader (10+ yrs) | Staff or principal, manager, director | Lead in public, mentor, prepare for leadership loops | Public milestones, posts, leadership prep |

**Regions:** United States at launch; Canada, the UK, Europe and Australia afterwards, as job supply allows (area 9).

**Accessibility baseline:** WCAG 2.2 AA, keyboard-first (⌘K), 44 px touch targets, screen-reader labels on every control.

---

## 5. Principles and non-goals

1. **One clear next step.** Each screen leads with the single most useful action.
2. **Progress, not pressure.** Celebrate milestones. No streaks, no guilt copy, no dark patterns in notifications.
3. **Grows with you.** Defaults follow the stage. The same app works for a student and a VP.
4. **AI drafts, you decide.** AI output is labeled, editable and versioned. Nothing is sent, applied for or published without the person.
5. **Fast, accessible, keyboard-first.**

**Non-goals:**
- Auto-applying, or messaging recruiters for the user
- **Help during a live interview** (no copilot or "stealth" mode). Practice happens before the interview, not during it. *(new)*
- **Scraping LinkedIn, Glassdoor or Indeed for production inventory.** Their terms prohibit it. *(new)*
- **Reading a user's Gmail or Outlook inbox** until the restricted-scope audit is funded *(new)*
- A recruiter product, job posting or paid placements
- Video courses made in-house. The library curates and links, plus short original guides.
- Native iOS and Android apps. The PWA ships first.
- Public follower counts or like counts

---

## 6. Feature specs

Each area gives its problem, prioritized requirements (Must / Should / Could), data needed and success measure. Requirements carried over from v1 unchanged are kept short. Rows **new or changed in v2 are bold**.

### 1. Rebrand and stage-aware onboarding

**Problem.** Parts of the app still say "CVLeap AI" or "OrbitHire", and everyone gets the same jobs-first setup.

**Rebrand checklist (Must).** Done Oct 22, 2026, except the last item:
- [x] Marketing site, sign in, sign up, contact, privacy, terms
- [x] Root metadata: default title, the `%s | NextMilestone` title template, and the description (`app/layout.tsx`)
- [x] A new social preview image, `public/og.png` (1200×630), replacing the old CVLeap screenshot
- [x] Favicons and PNG app icons rendered from `public/brand/*.svg`; a web manifest at `/manifest.webmanifest` (`app/manifest.ts`). The old `public/favicon/` set is removed.
- [x] Forgot-password and reset-password pages moved into the `(auth)` layout; URLs unchanged
- [x] Admin sign-in and sign-up pages, in the new design with their own layout; URLs unchanged
- [x] The in-app sidebar and mobile header logos (dashboard, settings, profile)
- [x] "OrbitHire" renamed to NextMilestone in the app, its API messages, the MCP server name and instructions, the AI connections setup snippets, the README, the user guide and the daily digest email
- [x] Old `NavBar` component removed; package renamed to `nextmilestone`
- [ ] Email sender display name. It comes from `FOLLOW_UP_FROM_EMAIL`; set it to `NextMilestone <hello@himanshurawat.in>` in each environment.

Kept on purpose, because changing them breaks running systems: the worker package `orbithire_worker`, the Supabase project id, migrations that have already run, `orb_` token prefixes, the OAuth consent signing salt and the `test@orbithire.local` test account. Research notes and historical docs (`PLAN.md`, `DATABASE.md`, `QA_REPORT.md`) keep the old name as a record.

| Priority | Requirement |
| --- | --- |
| Must | 4-step onboarding: stage → goals → target role, location and optional resume import → weekly rhythm. Every step can be skipped. |
| Must | Stage and goals stored on the profile, editable in Settings |
| Must | Imported fields shown for review; nothing is saved without confirmation |
| **Must** | **Location picker defaults to US metro areas and "Remote (US)"; pay shown in USD** |
| Should | Stage-specific defaults for the sidebar and the Today plan |
| Could | LinkedIn profile PDF import |

**Data.** `profiles.career_stage` (student \| early \| experienced \| leader), `goals text[]`, `target_role`, `target_locations text[]`, `weekly_focus_hours`, `onboarded_at`.
**Success.** ≥ 70% of sign-ups finish onboarding; median time ≤ 2 min.

### 2. Today (home)

| Priority | Requirement |
| --- | --- |
| Must | "Your next step" card: one action, its reason, Start and "Not today" |
| Must | **Daily plan of 3–5 items, generated at 6:30 AM in the user's time zone** (the site promises this) |
| Must | Top 3 new job matches with their scores |
| Must | Coming up: the next focus block, interview or follow-up |
| Should | Quick learning-log input; a weekly focus total against the goal (no streaks) |
| Could | Regenerate the plan on demand; drag to reorder |

**Next-step logic (v1, rules, no ML).** The first matching rule wins:
1. An interview within 3 days → a matching prep question
2. A follow-up due today → a drafted follow-up
3. A path lesson in progress → continue the lesson
4. New matches scoring 80 or more → review them
5. Otherwise → a focus block

**Data.** `daily_plans(user_id, date, items jsonb, generated_at)`; a worker task `generate_daily_plan` scheduled per time zone.
**Success.** ≥ 40% of weekly active users (WAU) act on the card at least 3 days a week; ≥ 50% of plans completed.

### 3. Learn

| Priority | Requirement |
| --- | --- |
| Must | Learning log: a link or a note, auto-fetched title, tags, private by default |
| Must | **4 launch paths** (Web foundations, Frontend interview, Frontend system design, Senior to lead), **with lessons of about 8–15 min** (the site promises both) |
| Must | Skill-gap card: skills the user's top matches ask for, minus the skills on their profile |
| Should | Study library of original guides and attributed external links; "Share to profile" |
| Could | Spaced-repetition reminders |

**Data.** `learning_entries`, `paths`, `path_lessons`, `path_progress`, `library_items`.
**Success.** ≥ 30% of WAU log something each week; ≥ 60% of started lessons are completed.

### 4. Interview prep

| Priority | Requirement |
| --- | --- |
| Must | Question bank by role, topic, level and stage, with a "Most asked" flag. **Every question shows its source** (user reports or a curated set). |
| Must | Practice flow: think → answer → review, with an optional framework hint (STAR; requirements → API → data → scale) |
| Must | AI feedback: one strength, one gap, one next read. Labeled as AI, with a "this was wrong" report. |
| Must | An interview card linked to an application: date, round, checklist |
| **Must** | **Voice answers with an editable transcript** (promoted from Should: the site promises it). Transcription vendor decided by research R5. |
| Should | A timed 30-minute mock: 3–4 questions and a summary |
| Could | Packs by company type: **early-stage startup, growth-stage, big tech, enterprise** |

**Data.** `questions`, `question_reports`, `practice_attempts`, `interviews`.
**Success.** People with a scheduled interview complete ≥ 3 practice attempts before it.

### 5. Focus and schedule

| Priority | Requirement |
| --- | --- |
| Must | Focus timer of 25, 50 or 90 minutes, tied to a task; **works offline** (the site promises it) |
| Must | Hold the app's own notifications during a session |
| Must | Weekly blocks by type: create, move, delete |
| **Must** | **Google Calendar: read events, and write only the blocks the user creates.** Uses sensitive scopes, so Google verification is needed before launch (research R4). |
| Should | Outlook calendar (Microsoft Graph) |
| Could | Ambient sound |

**Data.** `focus_sessions`, `schedule_blocks`, `calendar_connections` (tokens encrypted).
**Success.** ≥ 25% of WAU complete one focus session a week.

### 6. Community

| Priority | Requirement |
| --- | --- |
| Must | Post types: Milestone, Learning, Question, Link |
| Must | Feeds: For you, Following, and one per topic |
| Must | A Helpful reaction (counted on the post, never on the profile), replies, save |
| Must | Report, block, mute; **a moderation queue in admin (area 12)**; rate limits on new accounts |
| Must | **Invite-only at launch, starting with one US field** (research R8) |
| Should | "People a few steps ahead" suggestions; ranking by helpful-per-view with time decay |
| Could | Opt-in mentorship requests from leaders |

**Success.** ≥ 15% of WAU read the feed each week; reported content < 0.5% of posts.

### 7. Profile and milestones

| Priority | Requirement |
| --- | --- |
| Must | Milestone timeline with visibility set per item; add manually or from events |
| Must | "Preview as public"; "Open to roles" is only ever visible to the user |
| Must | Public profile URL. **Search indexing is opt-in and off by default.** |
| Should | Suggested milestones the user accepts or dismisses |
| Could | Export the profile as a one-page PDF |

**Success.** ≥ 50% of users add 3 or more milestones within a month.

### 8. Mobile (PWA)

| Priority | Requirement |
| --- | --- |
| Must | Installable PWA with bottom tabs: Today, Learn, Log (+), Jobs, Me |
| **Must** | **An install step for iOS ("Add to Home Screen"), shown before asking for push permission.** iOS web push works only from the Home Screen (16.4+), and the request must follow a tap ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). |
| Must | Web push for the morning plan, follow-ups and interviews, each switchable |
| Should | Offline queue for log entries and focus sessions; badge count on the app icon |
| Could | Capacitor native shells once PWA retention is proven |

**Success.** ≥ 35% of WAU use the phone app each week; push opt-out < 20%, **measured separately for iOS and Android**.

### 9. US job supply *(new)*

**Problem.** The current mix leans on scraped boards and India-specific sources. For US users, inventory must be fresh, legal and de-duplicated. Source: `reports/Low cost job data strategy.md`.

| Priority | Requirement |
| --- | --- |
| Must | Employer ATS feeds as the backbone: Greenhouse, Ashby, Lever, SmartRecruiters, Workable, Recruitee, Personio, Teamtailor. **Seed a watchlist of at least 500 US companies.** |
| Must | Fetch each board or query once, store every source observation, and fan jobs out to users. Today the system fetches per user. |
| Must | USAJOBS (free API; public reuse allowed); Himalayas, Jobicy and Remote OK under their display rules |
| Must | Turn off the LinkedIn, Glassdoor and Indeed JobSpy paths in production; record the legal basis for each source |
| Should | Discover jobs from company `JobPosting` structured data and sitemaps |
| Should | Poll priority boards every 15–30 min; others daily |
| Could | A paid gap-fill trial (Jobicy direct links at $0.01 per new job, or Adzuna) only after telemetry shows it adds value |

**Success.** At least 50 fresh, non-duplicate US matches per active user each week in the launch field; under 2% dead links.

### 10. Pricing and billing *(new)*

**Recommendation to test (research R2):**

| Plan | Price | Includes |
| --- | --- | --- |
| Free | $0 | Today, unlimited job tracking, learning log, 1 path, 10 AI feedback reviews a month, community |
| Pro | **$12–20/mo** to test, with an annual discount | Unlimited AI feedback, voice answers, mock interviews, every path, calendar sync, tailored resumes |
| Campus | Later | Group seats for colleges and bootcamps |

The test range sits under Huntr ($40) and Final Round AI ($25), because v1 of NextMilestone is a daily habit, not a short burst during a job search. Users who bring their own AI key keep unlimited AI on Free.

| Priority | Requirement |
| --- | --- |
| Must | Stripe Checkout and Customer Portal |
| Must | **Cancel online, as easily as sign-up**, with explicit consent to the auto-renewal terms. California's law was amended on Jul 1, 2025, and New York's on Nov 5, 2025. The FTC's federal rule was vacated in Jul 2025, so state law and ROSCA govern ([Lowenstein](https://www.lowenstein.com/news-insights/publications/client-alerts/ftc-click-to-cancel-rule-on-hold-but-california-s-automatic-renewal-law-remains-intact-what-companies-need-to-know-privacy)). |
| Must | A renewal reminder email before annual renewals |
| Should | Student pricing with .edu verification |

### 11. Trust, privacy and compliance *(new)*

| Priority | Requirement |
| --- | --- |
| Must | Rewrite the privacy policy and terms for US state laws (CCPA/CPRA and about 20 others) and have counsel review them. The current text is a generic carry-over. ([state law tracker](https://www.enzuzo.com/blog/us-state-privacy-laws)) |
| Must | Honor Global Privacy Control signals; "Do not sell or share" is a no-op that we state plainly, since we sell no data |
| Must | Self-serve export (JSON and PDF) and account deletion. The policy already promises both. |
| Must | Label every AI-generated item; keep versions; log the model and prompt version |
| Must | Contact submissions in an admin inbox, with a retention limit |
| Should | Ask counsel whether Colorado's AI Act applies to scores we show job seekers. Our view is that we are not a deployer making decisions about people; its effective date was moved to Jun 30, 2026 and is under revision ([Clark Hill](https://www.clarkhill.com/news-events/news/colorados-ai-law-delayed-until-june-2026-what-the-latest-setback-means-for-businesses)). |
| Should | A SOC 2-style controls list before any Campus deal |

### 12. Admin and owner *(new)*

| Priority | Requirement |
| --- | --- |
| **Must** | **Replace the `admin_token` cookie, which holds the raw admin id, with a signed, expiring session.** Re-check it on every admin API call. |
| Must | One owner account: `hello@himanshurawat.in` as `super_admin`. The temporary password is changed at first sign-in. |
| Must | Admin roles: owner, admin, moderator |
| Must | Moderation queue for community reports; contact inbox; user lookup |
| Should | 2FA (TOTP) for admins; an audit log of admin actions (`admin_activity_log` already exists) |

---

## 7. Roadmap

Phases ship in order. Each starts only after the previous one passes its gate. v2 adds **Phase 0** for launch readiness.

| Phase | Scope | Gate to move on |
| --- | --- | --- |
| **0 · Launch readiness** *(new)* | Email sender name (the rest of the rebrand is done); admin session fix; US job supply backbone; privacy and terms rewrite; trademark search | Owner can sign in securely; ≥ 50 fresh US matches per test user a week; counsel sign-off |
| A · Foundation | Stage-aware onboarding; Today and the next step | Gate 1: ≥ 70% finish onboarding |
| B · Grow | Learn (log, paths, library, skill gaps); Focus and schedule | Gate 2: ≥ 30% of WAU log learning weekly |
| C · Prepare | Interview prep (bank, voice, mocks); Profile and milestones; **Pricing launch** | Gate 3: interviewees complete ≥ 3 practice attempts |
| D · Connect | Community; Mobile PWA and push; Calendar sync | Guardrails in Section 8 hold for 4 weeks |

Phase A comes before the rest because the rebrand and Today change what every later feature looks like. Community comes last because it needs content from Learn, Prep and milestones to be worth reading. Dates are set at planning.

---

## 8. Metrics

**North star:** weekly active users who complete at least one meaningful action (plan item, lesson, practice attempt, focus session, application step or post) on 3 or more days that week.

| Guardrail | Target |
| --- | --- |
| Day-30 retention | Above the jobs-only baseline, measured before Phase A |
| Push opt-out | < 20% on each platform |
| AI cost per WAU | Within the platform budget [BUDGET]; users with their own key cost $0 |
| Accessibility | 0 critical axe violations on every release |
| Reported content | < 0.5% of posts |
| Free → Pro conversion | Target set after R2 |

---

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Eight-plus areas dilute quality | Phased delivery with gates |
| Job supply too thin without scraping | Employer feeds and a large US watchlist; measure yield before buying data |
| "Most asked" questions seen as invented | Show the source on every question |
| AI feedback is wrong or harsh | Label it, keep it kind and specific, one-click report |
| Community spam | Invite-only, rate limits, human moderation |
| Google verification delays calendar sync | Apply in Phase B; ship read-only first |
| iOS push reach is low | Install prompt; email fallback for the morning plan |
| Name conflict | Trademark search in Phase 0 |
| Subscription compliance | Online cancellation and renewal reminders from day one |
| Admin takeover through the cookie | Phase 0 Must fix |

---

## 10. Research plan

Each item has a method and a decision it unblocks. Owners and dates are set at planning.

| # | Question | Method | Decides |
| --- | --- | --- | --- |
| R1 | Do US users in each stage want a daily plan? | 12 interviews, 3 per stage; a clickable Today prototype | Phase A scope |
| R2 | What will people pay, and for what? | A Van Westendorp survey (n ≥ 150) and a fake-door Pro page | Pro price, Free limits |
| R3 | Is "NextMilestone" clear to use? | USPTO, CIPO, UKIPO and EUIPO search; domain and app-store check | Final name |
| R4 | How long does Google Calendar verification take? | Submit early with minimal scopes | Calendar in B or D |
| R5 | Which transcription for voice answers? | Compare the browser Web Speech API with Deepgram Nova-3 (about $0.0043/min batch, list price) and OpenAI gpt-4o-transcribe (about $0.006/min, older list price) on 50 real answers, measuring accuracy, latency and cost ([Deepgram pricing summary](https://www.happyrobot.ai/hub/deepgram-pricing)) | Vendor |
| R6 | Is US job supply enough without scraping? | Fetch 4 weeks of the 500-company watchlist plus USAJOBS; measure unique fresh jobs per persona | Launch field and metros |
| R7 | Where do the first question sets come from? | Curate 200 seed questions for the launch field; recruit 30 people to report their real interviews | Prep content plan |
| R8 | Which field should the community start with? | Choose from R6 (supply) and R1 (interest); invite 100 people | Community launch |
| R9 | Does iOS push reach enough people? | Install and opt-in funnel on 20 test devices | Email fallback default |
| R10 | Legal review | Counsel on privacy, auto-renewal and the Colorado AI Act | Phase 0 gate |

---

## 11. Open questions

- [ ] Final name and domain (R3)
- [ ] Pro price and what stays free forever (R2)
- [ ] Who writes and reviews the first paths and question sets? (R7)
- [ ] Voice transcription vendor (R5)
- [ ] First community field and invite size (R8)
- [ ] Will recruiters ever see "Open to roles", and with what consent?
- [ ] Production domain (the sitemap and metadata still use `resume.himanshurawat.in`)

---

## 12. Built vs planned

| Area | Built today | Missing |
| --- | --- | --- |
| Jobs | Fetch, rank, Job Inbox, applications | US watchlist, fetch-once fan-out, source legal basis |
| Documents | Typst resumes and cover letters | — |
| AI connections | MCP server and OAuth, rebranded | — |
| Brand | Marketing site (10 public pages), sign in and up, password reset, admin sign in and up, app logos, icons, social image, manifest | Email sender name |
| Onboarding, Today, Learn, Prep, Focus, Community, Milestones, PWA | — | All of v2 |
| Admin | Admin tables, access codes, settings | Secure session, roles, moderation |

---

## 13. Marketing promises to keep

The site published on Oct 22 says these things. Each one must ship as stated, or the copy changes before launch.

| Promise on the site | Covered by |
| --- | --- |
| Plan ready at 6:30 AM; matches at 7 AM | Area 2, area 9 |
| 4 learning paths; lessons of 8–15 min | Area 3 |
| Text or voice answers; feedback as one strength, one gap, one next read | Area 4 |
| Focus timer works offline; Google Calendar at launch | Areas 5 and 8 |
| Community invite-only, starting in the US | Area 6 |
| "About 30 sources" | Area 9: **change the copy** to count only terms-compatible sources |
| Each match score shows what helped and what's missing | Add to area 9 ranking: score explanation (Should) |

---

## 14. Glossary

- **WAU:** weekly active users
- **ATS feed:** the public jobs API of an applicant tracking system (Greenhouse, Lever and similar)
- **CASA:** Google's Cloud Application Security Assessment, required for restricted scopes such as reading Gmail
- **GPC:** Global Privacy Control, a browser opt-out signal

---

## 15. Sources

Pages opened on Oct 22, 2026, unless marked otherwise.

- [BLS, Job Openings and Labor Turnover Summary, August 2026 (published Sep 29, 2026)](https://www.bls.gov/news.release/jolts.nr0.htm)
- [Huntr pricing](https://huntr.co/pricing)
- [Final Round AI pricing](https://www.finalroundai.com/pricing)
- [Teal vs Huntr (Teal)](https://www.tealhq.com/teal-vs-huntr). Search result only; the Teal pricing page returned 403.
- [Best job tracking apps 2026 (Simplify pricing, third party)](https://jobshinobi.com/compare/best-job-tracking-app-2026). Search result only.
- [Handshake, About](https://joinhandshake.com/about/). Search result only.
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Nylas: Google OAuth scopes](https://developer.nylas.com/docs/cookbook/use-cases/build/google-oauth-scopes/). Search result only; confirm in Google's verification FAQ.
- [Survey: 36% of job seekers use AI (Aug 2026)](https://www.wboc.com/online_features/press_releases/36-of-job-seekers-use-ai-in-their-search-and-half-never-tell-employers/article_ffb6442b-6123-599b-909d-17df41919986.html). Search result only.
- [US state privacy law tracker 2026](https://www.enzuzo.com/blog/us-state-privacy-laws). Search result only.
- [Lowenstein: FTC click-to-cancel on hold; California ARL intact](https://www.lowenstein.com/news-insights/publications/client-alerts/ftc-click-to-cancel-rule-on-hold-but-california-s-automatic-renewal-law-remains-intact-what-companies-need-to-know-privacy). Search result only.
- [Clark Hill: Colorado AI law delayed to Jun 2026](https://www.clarkhill.com/news-events/news/colorados-ai-law-delayed-until-june-2026-what-the-latest-setback-means-for-businesses). Search result only; check the 2026 session.
- [Deepgram pricing summary (third party)](https://www.happyrobot.ai/hub/deepgram-pricing). Search result only.
- Repo: `reports/Low cost job data strategy.md`, `docs/PLAN.md`, `supabase/migrations/`, `worker/orbithire_worker/fetchers/`, `app/api/auth/admin/`
