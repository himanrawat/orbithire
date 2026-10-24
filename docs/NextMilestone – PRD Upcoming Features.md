# NextMilestone – PRD: Upcoming Features

**Version 3** · Oct 24, 2026 · Himanshu Rawat · Supersedes v2 (Oct 22, 2026), which is in this file's git history. The build checklist for v3 is [`NextMilestone – v3 Phases.md`](NextMilestone%20–%20v3%20Phases.md).

NextMilestone turns OrbitHire into a US-first career platform with two sides. People get one useful next step every weekday, learn from free and paid courses, earn a rank they can't buy, and share their progress. Verified companies post jobs, run challenges and hire people based on evidence those people chose to share. Educators publish courses and earn from sales and ads.

v3 keeps v2's twelve areas, revises six of them (Learn, Community, Profile, Pricing, Trust, Admin), and adds five: Climb, Social network, Employers, Challenges, and Educators and ads. It was written with an outside critic (Codex) over seven review rounds; every code reference and outside fact was checked before it went in.

---

## 1. What changed from v2

| # | v2 said | v3 change |
| --- | --- | --- |
| 1 | Non-goal: a recruiter product, job posting or paid placements | **Employers are in scope**: verified organizations, job posts, sponsored job slots, recruiter seats, candidate search, challenges. Companies pay for tools and access, never for anyone's rank. |
| 2 | Principle 2: no streaks, no guilt copy | **Climb** (area 13): XP, levels, quests, opt-in leagues, streaks with repair, a bounded Momentum multiplier, opt-in stakes, capped penalties, appeals, Calm mode. |
| 3 | No ranking of people | One earned **NextMilestone Challenge Rating**, chess-inspired: it rises and falls, while titles and peak rating are permanent and weekly leagues reset. |
| 4 | Non-goal: public follower or like counts | **Public up/down vote scores** on posts and comments; connections and follows. Voters stay private; no profile karma. |
| 5 | Community: invite-only, one Helpful reaction | **Social network** (area 14): LinkedIn-style posts, Reddit-style threads, topic Spaces, optional pseudonymous Space handle. |
| 6 | Learn: log, 4 paths, library | **Course platform** (area 3): free and paid courses, certificates, free outside links, group learning. **Educators** (area 17) earn from course sales and ads. |
| 7 | "Open to roles" visible only to its owner | Verified recruiters may see people who opt in, item by item. Hiding someone from their current employer is best effort, not guaranteed. |
| 8 | Match scores never shared with employers | Still true for job-match scores. Challenge results and certificates are shared only with explicit, itemized consent. |
| 9 | Revenue from member subscriptions | Employers first, then Pro, course sales, and contextual ads on free courses. User data is never sold or licensed. |
| 10 | No minimum age beyond "under 16" in the privacy policy | **16+**. Under 16 can't sign up. 16–17 get a restricted teen mode; some sections unlock at 18. |
| 11 | Colorado AI Act effective Jun 30, 2026 | Corrected: SB 24-205 was repealed and replaced by **SB 26-189, effective Jan 1, 2027**; rules still being written ([Colorado AG](https://coag.gov/ai/)). |

---

## 2. Summary

**Today (built on branch `nextmilestone/prd-v2-features`):** every v2 Must has code on the branch, from the job supply backbone and admin sessions to Learn, Prep, Focus, Community, Profile, Billing and the PWA. "Code exists" is not the same as tested, deployed or gate-passed; section 12 tracks the difference.

**Areas:**

| # | Area | One line |
| --- | --- | --- |
| 1 | Rebrand and onboarding | Finish the rebrand; 4-step setup by career stage; **age check** |
| 2 | Today | The one next step and a 3–5 item daily plan |
| 3 | **Learn** (revised) | Log, first-party paths, free and paid courses, outside links, group learning, certificates |
| 4 | Interview prep | Question bank, practice, mocks, feedback |
| 5 | Focus and schedule | Focus timer, weekly blocks, Google Calendar |
| 6 | Community | Moved to area 14 |
| 7 | Profile and milestones (revised) | Timeline, per-item audiences including Recruiters, certificates |
| 8 | Mobile PWA | Installable phone app |
| 9 | US job supply | Employer ATS feeds, terms-compatible sources |
| 10 | Pricing, billing and revenue (revised) | Free, Pro, employer products, course sales, ads |
| 11 | Trust, privacy, hiring law (revised) | Privacy, hiring law, FCRA, minors, copyright, ads |
| 12 | Admin and owner (revised) | Roles, moderation and review queues |
| 13 | **Climb** (new) | XP, levels, leagues, Momentum, stakes, Challenge Rating, titles |
| 14 | **Social network** (new) | Posts, threads, votes, connections, Spaces |
| 15 | **Employers** (new) | Organizations, jobs, sponsored slots, recruiters, search, export |
| 16 | **Challenges** (new) | Company and user challenges, rank gates, host-set rewards |
| 17 | **Educators and ads** (new) | Anyone uploads; YouTube-style monetization; Udemy-style sales split |

**Goals for the next two quarters:**
- **People** open NextMilestone on most weekdays because it gives them the next useful step and their progress counts.
- **Companies** hire people from evidence those people chose to share.
- **Educators** earn from teaching people who are working toward a job.

**Rank, defined.** "Rank" means only the ordering of people: Lifetime XP, level, Week XP and league position, Challenge Rating and its status, title and peak rating, and candidate search order. **No payment, plan, sponsor, host, recruiter, company or course purchase can improve any of these.** Job and course ads are inventory, not people's rank.

---

## 3. Market and research findings (US)

**The labor market rewards preparing over applying.** The August 2026 JOLTS counted 7.1 million openings (4.3%), 5.2 million hires (3.3%), 3.1 million quits (1.9%) and 1.6 million layoffs (1.0%): a low-hire, low-quit market ([BLS JOLTS, Sep 29, 2026](https://www.bls.gov/news.release/jolts.nr0.htm)). The product must be useful to people who aren't actively applying.

**AI adoption in the job search is real but not universal.** In an August 2026 survey of 500 US job seekers, 46.7% of Gen Z and 35% of Millennials used AI; 64% of all respondents used none ([WBOC](https://www.wboc.com/online_features/press_releases/36-of-job-seekers-use-ai-in-their-search-and-half-never-tell-employers/article_ffb6442b-6123-599b-909d-17df41919986.html)). AI helps in the background; it isn't the pitch.

**Competitors and models we learn from:**

| Product | What it does | What we take |
| --- | --- | --- |
| [Huntr](https://huntr.co/pricing) | Tracker; Pro $40/mo (checked v2) | Free-tier limits drive upgrades |
| Teal, Simplify | Tracker, autofill (prices unverified) | A generous free tracker is expected |
| [Final Round AI](https://www.finalroundai.com/pricing) | Interview "copilot"; Pro $25/mo | We do prep, never live help |
| [Handshake](https://support.joinhandshake.com/hc/en-us/articles/219133157-Viewing-Student-Profiles) | Students and employers | Employers see profiles only when approved and the student opted in |
| LinkedIn | Network, jobs, Recruiter, Premium, Learning | Revenue: Talent Solutions, Marketing Solutions, Premium, Sales; grew 12% YoY in the quarter ended Jun 30, 2026, led by Marketing Solutions ([Microsoft](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4)). Promoted jobs are labeled ([LinkedIn](https://www.linkedin.com/help/linkedin/answer/a512429/promoted-jobs-in-your-job-search-results)). |
| [Wellfound](https://wellfound.com/recruit/pricing) | Startup jobs | Free posts; paid job ads from $200; sourcing seats $135–199/mo (Oct 24, 2026) |
| Reddit | Threads, votes, Spaces | Q2 2026 revenue $805M, $762M ads, $43M other incl. data licensing ([SEC](https://www.sec.gov/Archives/edgar/data/1713445/000171344526000098/earningspressreleaseq226.htm)). Vote counts are fuzzed; manipulation is banned ([Reddit](https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette)). We copy votes and threads, not data licensing. |
| HackerRank, HackerEarth, Devpost | Hiring challenges, hackathons | Employer decides the hire; plagiarism is a review signal; official rules and prize terms are mandatory |
| Codeforces, LeetCode | Contest ratings | Rating separate from social contribution |
| [Chess.com](https://support.chess.com/en/articles/8566476-how-do-ratings-work-on-chess-com), [Lichess](https://lichess.org/faq) | Ratings, titles, leagues | Rating uncertainty grows with inactivity; titles need sustained results; Chess.com leagues promote but don't demote |
| [YouTube](https://support.google.com/youtube/answer/94522) | Creator monetization | Anyone uploads; ads unlock at 1,000 subscribers + 4,000 watch hours/12 months (8,000 for new applicants from Feb 1, 2027, [YouTube](https://support.google.com/youtube/answer/12843009)); long-form share 55%, Shorts 45%; paid by watch-driven revenue, never per like |
| [Udemy](https://support.udemy.com/hc/en-us/articles/229605008-Instructor-revenue-share) | Course marketplace | Instructor gets 97% of net on own referrals, 37% otherwise; 30-day refunds |
| [Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/) | Streaks, leagues, wagers | Opt-in wager: +14% D7 retention; separating streak from daily goal: +3.3% D14 ([Duolingo](https://blog.duolingo.com/improving-the-streak)) |
| [Pact (FTC)](https://www.ftc.gov/news-events/news/press-releases/2017/09/mobile-app-settles-ftc-allegations-it-failed-deliver-promised-cash-rewards-meeting-exercise-diet) | Cash penalties | Charged people who met goals; $940k refunds. Automatic penalties on unreliable data are a trap. |

**The gap:** no product combines a daily career plan, courses, a rank that can't be bought, a progress network, and an employer side. LinkedIn has the network and employers, but status there is social, not earned. HackerRank has challenges but no daily growth. This is a hypothesis; R15 tests it.

**Positioning:** *"Know your next step. Then take it."*

---

## 4. Users, stages and roles

The career stage chosen at onboarding changes defaults and emphasis, never the app's structure.

| Stage | Typical US user | What we put first |
| --- | --- | --- |
| Student | College junior or senior, bootcamp grad, new grad | Learning paths, courses, most-asked basics, first resume |
| Early career (0–3 yrs) | Junior to mid-level | Job Inbox, tailored documents, interview prep |
| Experienced (3–10 yrs) | Senior IC, maybe changing direction | Skill gaps, system design prep, focus time, private search |
| Leader (10+ yrs) | Staff, principal, manager, director | Public milestones, posts, mentoring, hosting challenges |

**Age bands.** Under 16 can't sign up. **16–17** use teen mode; several sections unlock at **18** (table in the [phases file](NextMilestone%20–%20v3%20Phases.md#age-based-unlocks)). At 18 nothing becomes visible on its own; the person chooses.

**Employer side:**

| Role | Who | Can do |
| --- | --- | --- |
| Organization admin | Verified owner, founder, CEO, talent lead | Org page, billing, domains, invite recruiters, jobs, challenges |
| Recruiter | Verified seat holder | Search opted-in people, post jobs, send limited messages |
| Hiring manager | Invited member | Review applicants and shared challenge results |
| Educator | Any adult user (18+, US at launch for earnings) | Publish courses; earn after monetization review |
| Individual host | User at a set level or title | Host unrated community challenges |
| Moderator | NextMilestone staff | Review queues (area 12) |

**Regions:** United States at launch; Canada, the UK, Europe and Australia afterwards, as job supply allows.

**Accessibility baseline:** WCAG 2.2 AA, keyboard-first (⌘K), 44 px touch targets, screen-reader labels on every control, reduced-motion support.

---

## 5. Principles and non-goals

1. **One clear next step.** Each screen leads with the single most useful action.
2. **Progress you can see, stakes you choose.** Climb rewards verified effort and charges for skipped effort. Penalties touch Week XP only, are capped, can be appealed, and Calm mode removes them. Notifications state facts, never guilt.
3. **Rank is earned, never bought.** No payment changes anyone's XP, level, rating, title, league position, challenge result or candidate order.
4. **Comparable evidence before rating.** Only NextMilestone-certified challenges move the Challenge Rating. Hosts can request rated status; they can't buy it.
5. **Visible by choice.** Nothing reaches recruiters unless the person opts in, item by item.
6. **Honest privacy.** Hiding someone from their current employer is best effort; we say so.
7. **One overall rating, narrow meaning.** The Challenge Rating sums up certified challenge performance. It is not an employability score.
8. **AI drafts, you decide.** AI output is labeled, editable and versioned, and never the only basis for a rating, a cheating finding or a hiring decision.
9. **Votes rank content, never people.** Votes never affect XP, rating, search or reputation.
10. **Appeals for anything that matters.** Penalties, cheating findings, rating changes, disqualifications, demonetization and recruiter limits come with evidence, a rule version and a review path.
11. **Data minimization.** Recruiters, hosts and advertisers get only what's needed and authorized.
12. **Fast, accessible, keyboard-first.**

**Non-goals:**
- Auto-applying, or messaging recruiters for the user
- Help during a live interview, or during a rated challenge unless its certified rules allow it
- Scraping LinkedIn, Glassdoor or Indeed for production inventory
- Reading a user's Gmail or Outlook inbox until the restricted-scope audit is funded
- Selling rank, candidate-search placement, rated-event status, votes, XP, titles or penalty relief (freezes, streak repairs, appeals)
- Paid awards that affect sorting, votes, XP, rating or recruiter visibility
- Selling or licensing user data, activity, submissions or course-viewing data
- Public voter identity or profile karma
- Using downvotes or social activity as a hiring signal
- Unpaid production work disguised as a challenge
- Employer access to private job-match scores
- Rewarding people for watching, liking or subscribing on YouTube (YouTube's developer policies forbid it)
- Video courses made in-house (educators make courses; we curate)
- Native iOS and Android apps before the PWA

---

## 6. Feature specs

Each area lists prioritized requirements (Must / Should / Could). Unchanged v2 requirements are kept short.

### 1. Rebrand and stage-aware onboarding

**Rebrand checklist (Must).** Done Oct 22, 2026, except the last item:
- [x] Marketing site, sign in, sign up, contact, privacy, terms
- [x] Root metadata, title template and description (`app/layout.tsx`)
- [x] Social preview image `public/og.png`
- [x] Favicons, PNG app icons and web manifest (`app/manifest.ts`)
- [x] Forgot- and reset-password pages in the `(auth)` layout
- [x] Admin sign-in and sign-up pages
- [x] In-app sidebar and mobile header logos
- [x] "OrbitHire" renamed in the app, API messages, MCP server, AI connection snippets, README, user guide and digest email
- [x] Old `NavBar` removed; package renamed to `nextmilestone`
- [ ] Email sender display name: set `FOLLOW_UP_FROM_EMAIL` to `NextMilestone <hello@himanshurawat.in>` in each environment (confirm on Hetzner and in the Oracle setup)

Kept on purpose: the worker package `orbithire_worker`, the Supabase project id, migrations already run, `orb_` token prefixes, the OAuth consent signing salt and the `test@orbithire.local` account.

| Priority | Requirement |
| --- | --- |
| Must | 4-step onboarding: stage → goals → target role, location and optional resume import → weekly rhythm (including rest days). Every step can be skipped. |
| Must | **Neutral date-of-birth step before account creation; under 16 is blocked.** Age stored apart from the profile; product code reads only the age band. |
| Must | Stage and goals stored on the profile, editable in Settings |
| Must | Imported fields shown for review; nothing saved without confirmation |
| Must | Location picker defaults to US metros and "Remote (US)"; pay in USD |
| Should | Stage-specific defaults for the sidebar and Today plan (helper `orderByStage` exists and is tested but isn't wired into the sidebar yet) |
| Could | LinkedIn profile PDF import (user-supplied file, never scraping) |

**Success.** ≥ 70% of sign-ups finish onboarding; median ≤ 2 min.

### 2. Today (home)

| Priority | Requirement |
| --- | --- |
| Must | "Your next step" card: one action, its reason, Start and "Not today" |
| Must | Daily plan of 3–5 items at 6:30 AM in the user's time zone |
| Must | Top 3 new job matches with scores |
| Must | Coming up: next focus block, interview or follow-up |
| Must | **Climb strip:** Week XP bar, today's quests and the "XP at risk" meter (adults); positive progress only for teens |
| Should | Quick learning-log input; weekly focus total |
| Could | Regenerate the plan (built); drag to reorder (missing) |

**Next-step rules** (first match wins): interview within 3 days → prep question; follow-up due today → drafted follow-up; lesson in progress → continue it; new matches ≥ 80 → review them; otherwise → a focus block.

**Success.** ≥ 40% of WAU act on the card 3+ days a week; ≥ 50% of plans completed.

### 3. Learn *(revised)*

Learn is a course and study platform: first-party paths, educator-made free and paid courses, attributed links to free outside material, individual and group learning, and certificates. The existing log, 4 paths, lessons, progress and library (`supabase/migrations/20261024000600_learn.sql`) stay as the first-party base; courses, media, groups, purchases and certificates need new models.

| Priority | Requirement |
| --- | --- |
| Must | Keep the private-by-default learning log, 4 first-party paths (Web foundations, Frontend interview, Frontend system design, Senior to lead; lessons ~8–15 min), skill-gap card and library links |
| Must | Native free and paid courses. Formats at launch: **video, text, quizzes and projects**; live sessions later. Each course declares creator, version, level, outcomes, prerequisites, price, certificate type, assessment and accessibility info. |
| Must | Free outside material by attributed link (YouTube, open-source docs, any free education). We never copy, rehost or claim it. YouTube uses its compliant player or an outbound link. |
| Must | **Group learning** of any size (two people, small group, large cohort) on free courses and free links. On a paid course, **every member must own the course**; access is checked on every lesson and ends on refund or chargeback. |
| Must | "Studying together" means a shared schedule, optional synced individual playback, per-lesson discussion, group progress (counts by default; names only with consent) and notes the author chooses to share. Never shared logins, shared streams or redistributed files. |
| Must | **XP needs proof of learning**: a passed quiz, accepted exercise or written reflection. Watching alone earns no XP, because educators are paid by watch time. |
| Must | **YouTube viewing, likes, subscriptions or comments earn no XP**, quests, streak credit or educator pay ([YouTube Developer Policies III.F.3.c](https://developers.google.com/youtube/terms/developer-policies)). Groups can still study YouTube links together. |
| Must | **One XP-eligible path at a time for everyone**, free or paid; switching takes effect Monday. Buying courses or Pro never adds Week XP opportunity. Other valid completions earn Lifetime XP only. |
| Must | Price, purchase, certificates, ads, likes, follows and views earn no XP or rating |
| Must | Paid course = **lifetime access to the purchased version** while NextMilestone supports it; terms cover takedowns, educator removal and shutdown (refund or substitute) |
| Must | **Certificates** from the educator **or** NextMilestone, never both. Labeled **Completion**, **Assessed** or **Identity verified** (government ID via a vetted provider; we keep the result, not the ID). Each has a credential ID, verification link, issue date, course version and revocation status. |
| Must | Certificates are private by default; recruiters see one only if the learner shares it. Course price and purchase history are never shown to recruiters. Certificates never move the Challenge Rating. |
| Must | Completion, quiz, certificate, XP, watch-time, purchase, refund and payout events are server-authoritative, idempotent and reversible. Today users can write their own `path_progress` directly; that changes. |
| Must | Teens: free courses, groups (moderated, no adult DMs) and free-course certificates; no paid courses at launch |
| Should | Captions, transcripts, playback speed and keyboard control for native video |
| Should | Downloadable resources where the educator owns the rights |
| Could | Live cohorts; spaced-repetition review quests |

**Success.** ≥ 30% of WAU complete a learning action weekly; ≥ 60% of started lessons completed; groups complete more than solo learners without more reports; paid status gives no measurable Week XP advantage.

### 4. Interview prep

| Priority | Requirement |
| --- | --- |
| Must | Question bank by role, topic, level and stage, with a "Most asked" flag and a source on every question |
| Must | Practice flow: think → answer → review, with optional framework hints |
| Must | AI feedback: one strength, one gap, one next read; labeled as AI with a "this was wrong" report |
| Must | Interview card linked to an application: date, round, checklist; powers the private Interview Boss (area 13) |
| Must | Voice answers with an editable transcript |
| Must | **Mock interviews never affect the Challenge Rating** (mocks are Pro-only) |
| Should | Timed 30-minute mock |
| Could | Packs by company type |

**Success.** People with an interview complete ≥ 3 practice attempts before it.

### 5. Focus and schedule

| Priority | Requirement |
| --- | --- |
| Must | Focus timer of 25, 50 or 90 minutes, tied to a task; works offline |
| Must | Hold the app's own notifications during a session |
| Must | Weekly blocks: create, move, delete |
| Must | Google Calendar: read events; write only blocks the user creates (verification needed) |
| Must | Focus XP: up to 2 plausibility-checked sessions a day count toward Week XP; one "I was interrupted" stop a week without forfeit |
| Should | Outlook calendar (Settings card says "Soon") |
| Could | Ambient sound |

**Success.** ≥ 25% of WAU complete a focus session weekly.

### 6. Community

Moved to area 14 (Social network). The current invite-only community, Helpful reaction, flat replies and follows are the starting point.

### 7. Profile and milestones *(revised)*

| Priority | Requirement |
| --- | --- |
| Must | Milestone timeline; add manually or from events |
| Must | Every milestone, post, learning entry, certificate, trophy and rating field has an audience: **Only me, Connections, Public or Recruiters** (today only private/public exist) |
| Must | **Open to roles** off by default; when on, visible only to verified recruiters, and only items the person marked for recruiters |
| Must | **Current-employer protection** using verified organization and affiliate IDs, recruiter affiliation and a user block list. Copy says it's best effort. |
| Must | Profile shows Challenge Rating with its uncertainty, peak, title, level, certificates and trophies; each can be hidden from Public |
| Must | Preview as Public, Connections, Recruiter, or a specific challenge host |
| Must | Access history: which organizations viewed, messaged or exported the person's data |
| Must | Public profile URL; search indexing opt-in and off by default |
| Must | Teens: never visible to recruiters; nothing from teen years becomes public at 18 without a choice |
| Should | Suggested milestones; "Hire me" summary from chosen evidence (AI-labeled) |
| Could | One-page profile PDF (a print view exists) |

**Success.** ≥ 50% of users add 3+ milestones within a month.

### 8. Mobile (PWA)

| Priority | Requirement |
| --- | --- |
| Must | Installable PWA with bottom tabs: Today, Learn, Log (+), Jobs, Me (Climb lives under Me) |
| Must | iOS install step ("Add to Home Screen") before asking for push ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)) |
| Must | Web push for the morning plan, follow-ups and interviews, each switchable. **No push about penalties.** |
| Should | Offline queue for logs and focus sessions; badge count |
| Could | Capacitor native shells once PWA retention is proven |

**Success.** ≥ 35% of WAU use the phone app weekly; push opt-out < 20% on each platform.

### 9. US job supply

| Priority | Requirement |
| --- | --- |
| Must | Employer ATS feeds as the backbone (Greenhouse, Ashby, Lever, SmartRecruiters, Workable, Recruitee, Personio, Teamtailor); watchlist of 500+ US companies |
| Must | Fetch each board once, store every observation, fan out to users |
| Must | USAJOBS; Himalayas, Jobicy and Remote OK under their display rules |
| Must | LinkedIn, Glassdoor and Indeed JobSpy paths off in production; legal basis recorded per source |
| Must | **Native job posts** from verified organizations (area 15) merge into the Job Inbox with the same match score |
| Should | Discover jobs from employers' career pages via `JobPosting` structured data and sitemaps (missing) |
| Should | Score explanation: what helped and what's missing (built) |
| Could | Paid gap-fill trial only after telemetry shows value |

**Success.** ≥ 50 fresh, non-duplicate US matches per active user weekly; < 2% dead links.

### 10. Pricing, billing and revenue *(revised)*

**Revenue, in order:**
1. **Employers** (main): job posts, sponsored job slots, challenge hosting, recruiter seats, candidate search and messaging, export to their own hiring software.
2. **Pro members**: tools only (all paths' content, unlimited AI feedback, voice, mocks, calendar sync, tailored resumes). Never more XP, rating, rated attempts or penalty relief.
3. **Course sales** (area 17).
4. **Contextual ads on free courses** (area 17).
5. **Never:** selling or licensing user data.

**Member plans:**

| Plan | Price | Includes |
| --- | --- | --- |
| Free | $0 | Today, unlimited tracking, learning log, 1 path's content, 10 AI reviews/month, community, Climb |
| Pro | $12–20/mo to test (R2) | Unlimited AI feedback, voice, mocks, every path, calendar sync, tailored resumes |
| Campus | Later | Group seats |

Users who bring their own AI key keep unlimited AI on Free.

**Employer products** (prices set by R12):

| Product | Includes |
| --- | --- |
| Job post | One moderated listing for a set term; pay range, period, currency, benefits and work locations required on every post |
| **Sponsored job slot** | Labeled "Promoted", **at most one per ten results**, must meet the same relevance floor, **never reorders organic matches** |
| Challenge hosting | Setup, entrants, judging tools, result access |
| Recruiter seat | Search over opted-in people, limited messaging, org audit log |
| Export to hiring software | **Paid feature only.** Only what the candidate authorized; logged and visible to the candidate; withdrawal webhook; deleted within 30 days unless law requires keeping it; platform access to exported results ends after 12 months by default. Consent rules are the same on every tier. |

| Priority | Requirement |
| --- | --- |
| Must | Stripe Checkout and Customer Portal for members; invoices for employers |
| Must | Cancel online as easily as sign-up, with explicit consent to renewal terms (California and New York rules; FTC rule vacated Jul 2025; [Lowenstein](https://www.lowenstein.com/news-insights/publications/client-alerts/ftc-click-to-cancel-rule-on-hold-but-california-s-automatic-renewal-law-remains-intact-what-companies-need-to-know-privacy)) |
| Must | Renewal reminder before annual renewals |
| Must | No employer product changes anyone's rank, challenge result or rated-event weight; candidate order comes from filters, relevance, freshness and published tie rules, never spend |
| Must | Counsel decides whether paid recruiter access counts as a "sale" or "sharing" under state law before we keep the "we don't sell personal information" statement ([California AG](https://oag.ca.gov/privacy/ccpa)) |
| Should | Student pricing with .edu verification (pricing page says "coming soon") |

### 11. Trust, privacy, hiring law and compliance *(revised)*

| Priority | Requirement |
| --- | --- |
| Must | **Counsel memo before any employer pilot, candidate search, rated hiring challenge, paid course, creator payout or ad.** |
| Must | **Rewrite Terms and Privacy before the matching feature.** Current Terms say "We're not an employer, recruiter or staffing agency" (`app/terms/page.tsx:42`); Privacy says match scores aren't shared with employers (`app/privacy/page.tsx:98`), that we use no advertising cookies or ad trackers (`app/privacy/page.tsx:52-60`), share only with processors (`:104-123`), treat GPC as already in effect (`:129-136`) and don't do legally significant profiling (`:141-158`). |
| Must | Honor GPC; "Do not sell or share" stays true or is rewritten accurately |
| Must | Self-serve export (JSON, HTML **and PDF**; PDF is missing) and account deletion |
| Must | Label every AI-generated item; keep versions; log model and prompt version |
| Must | Contact submissions in an admin inbox with a retention limit |
| Must | **FCRA:** "Material risk; consumer-reporting-agency status unverified pending counsel." Never market candidate search as "screening", "vetting" or "background checks" (the FTC fined Spokeo $800k for marketing profiles to recruiters as a screening tool; its disclaimer didn't help, [FTC](https://www.ftc.gov/news-events/news/press-releases/2012/06/spokeo-pay-800000-settle-ftc-charges-company-allegedly-marketed-information-employers-recruiters)). Counsel picks a non-CRA product boundary or full CRA operations. |
| Must | **NYC Local Law 144:** decide per employer workflow whether rating or filters "substantially assist" hiring; covered use needs a bias audit, published summary and notice ([NYC DCWP](https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page)) |
| Must | **Colorado SB 26-189** (effective Jan 1, 2027) assessment, replacing v2's outdated SB 24-205 date |
| Must | **EEOC:** certified hiring challenges need job-relatedness evidence, accommodations, impact monitoring, employer notices and a less-discriminatory-alternative review ([EEOC](https://www.eeoc.gov/laws/guidance/employment-tests-and-selection-procedures)) |
| Must | **Pay transparency:** every native job post includes pay, period, currency, benefits and work locations, plus state-specific checks |
| Must | **Challenges:** official rules, legal host, hiring or public type, eligibility, judging, ties, AI policy, IP, prizes, tax and disputes. Entry is always free. Entrants keep their IP unless meaningful pay is guaranteed. |
| Must | **Cash prizes go host → winner** under the official rules; only the hosting fee goes through Stripe. Stripe lists skill competitions as prohibited and escrow as restricted ([Stripe](https://stripe.com/legal/restricted-businesses)). |
| Must | **Minors (16–17):** teen mode per the age table; minor data-protection assessment covering Colorado, Connecticut and Maryland under-18 rules on targeted ads, sale and profiling; no ads to teens; no unsolicited adult-to-teen messages; teens never in recruiter search or Apply with profile; job listings for teens carry an age-eligibility notice (federal hazardous-job limits and stricter state rules, [DOL](https://www.dol.gov/agencies/whd/fact-sheets/43-child-labor-non-agriculture)) |
| Must | **Copyright:** registered DMCA designated agent, takedown and counter-notice, and a repeat-infringer policy before open uploads ([Copyright Office](https://www.copyright.gov/512/)) |
| Must | **Endorsements:** sponsored educator content discloses the material connection in the video itself ([FTC](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers)) |
| Must | Certificate marketing never says "accredited", "licensed" or "job ready" without substantiation |
| Must | Access logs for recruiters, hosts, judges, exports, messages, rating changes and moderation; candidates can see explanations, correct data and appeal |
| Must | Anti-cheat telemetry stays internal; hosts see only the finding and appeal outcome |
| Must | Purpose-specific retention; withdrawal stops future use but doesn't promise erasure of records an employer must legally keep (often 1+ year, [EEOC](https://www.eeoc.gov/employers/summary-selected-recordkeeping-obligations-29-cfr-part-1602)) |
| Should | SOC 2-style controls list before any Campus deal |

### 12. Admin and owner *(revised)*

| Priority | Requirement |
| --- | --- |
| Must | Signed, expiring admin sessions re-checked on every admin call (built) |
| Must | Owner account `hello@himanshurawat.in` as `super_admin`; temporary password changed at first sign-in |
| Must | Roles: owner, admin, moderator, plus employer-ops, creator-ops, payments, privacy |
| Must | **TOTP or stronger 2FA for every admin** (missing); step-up auth for payouts, refunds, rating corrections, employer verification and exports |
| Must | Queues: organization verification and affiliates; recruiter abuse; job moderation and scams; challenge certification; prize disputes; anti-cheat findings and appeals; rating replay and reversal; vote manipulation and brigading; employer-exposure incidents; Climb penalty reviews (`climb_reviews`); creator onboarding, payouts and demonetization; course publication and rights; DMCA; certificate revocation; invalid traffic; ad and advertiser review; teen-safety reports |
| Must | Every admin action signed, attributable, reason-coded and audited. The current report model (post, reply, user only) is extended, not reused as-is. |

### 13. Climb *(new)*

**Problem.** People need a reason to come back daily, and companies need a signal they can trust. Both must be earned.

**Layers (chess-inspired):**

| Layer | Moves | Resets |
| --- | --- | --- |
| **Lifetime XP** | Only up; drives level and trophies | Never |
| **Week XP** | Up from qualifying actions; penalties can lower it (floor 0); ranks leagues | Every Monday |
| **Challenge Rating** | Up or down from NextMilestone-certified challenges only | Never; uncertainty grows when inactive |
| **Peak rating and titles** | Record of achievement | Never lost |
| **Weekly leagues** | Opt-in cohorts ranked by Week XP | Weekly; 8-week seasons |

| Priority | Requirement |
| --- | --- |
| Must | Two balances from an append-only, server-authoritative event ledger. No client writes to XP-bearing tables (focus sessions, learning entries, path progress, practice attempts and follow-ups are directly writable today). |
| Must | A published list of qualifying actions, each with source, base XP, daily cap and rule version. Free and Pro get identical opportunity. |
| Must | Votes, follows, views, ads, purchases, certificates and plan status never grant XP or rating |
| Must | Daily quests (rule-based, by stage), capped at 140 XP/day; quest-set bonus up to 50 Week XP. Interview Boss and weekly-challenge rewards go to Lifetime XP and trophies only. |
| Must | **Streak:** kept by one qualifying action of 10+ XP on a planned weekday; repair via a 48-hour comeback quest; 2 freezes a month; rest days; Pause up to 14 days a quarter; opt-in holiday freezes. Never sold. |
| Must | **Momentum (kept, bounded):** multiplies base Week XP only. Starts Monday at ×1.00; +0.05 per planned active weekday up to **×1.15**; a missed planned day lowers it 0.10 (floor ×1.00). Bonus capped at **25 Week XP/day and 75/week**. Never multiplies Lifetime XP, quests, Boss, stakes or rating. One line for users: *"Show up on your planned weekdays to build up to a 15% Week XP boost; it resets every Monday."* |
| Must | **Leagues:** explicit opt-in on day 3; regroup Monday; cohorts of 30 (min 10) by stage; close **Sunday 9 PM ET / 6 PM PT**, shown in local time; top 25% move up, bottom 15% move down; ties share rank and all tied at the line move up; zero-XP members drop first and leave after 2 empty weeks; settings change only at regroup. Six camps: Base Camp, Camp I–III, High Camp, Summit (top ceil(1%) of the season). |
| Must | **Stakes:** opt-in weekly contract; max from last week's earned Week XP; win doubles back; 24-hour undo; never preselected or escalated |
| Must | **Penalties** (adults): focus forfeit, skip cost, Rust on follow-ups 2+ days overdue (warning day first; first Rust reversed if archived as obsolete), streak break, lost stake, demotion. Non-stake penalties capped at **25% of that week's earned Week XP**. One live "XP at risk" meter; one Sunday settlement; no push about penalties. |
| Must | Every penalty has evidence, a rule version, a 7-day appeal and a reversal event |
| Must | **Calm mode:** no leagues, stakes or penalties; XP and levels continue. Changes take effect Monday. |
| Must | **Challenge Rating:** Glicko-2 (unless R14 says otherwise); provisional and inactive status from rating deviation; only certified challenges count; mocks never count; shown with event history, uncertainty and domain tags; never called "employability"; never the only way into a job |
| Must | **Titles:** peak-rating threshold plus a minimum number of certified events; kept after rating falls |
| Must | **Teens:** positive XP, levels, quests and trophies only. No Momentum, stakes, penalties, leagues or rating. |
| Should | Private Interview Boss (starts 3 days before an interview; voided if the interview is cancelled) |
| Should | Season Summit badge |

**UI.** Sidebar groups: Today (pinned) · Grow (Learn, Interview prep, Focus) · Job search (Job inbox, Companies) · Documents (Resume builder, My resumes, Templates) · Climb (one entry; Leaderboard, Quests and Trophies are tabs) · People (Community, Milestones). Group order is fixed; career stage decides which groups start expanded. Player card at the bottom (A/B against a single-status card).

**Success.** North star rises in the XP-plus-leagues arms of R11 without breaching the harm stops (section 8).

### 14. Social network *(new; replaces area 6)*

| Priority | Requirement |
| --- | --- |
| Must | Profile-identity posts: Learning, Progress, Milestone, Link, Job, Challenge |
| Must | Space threads (Question, Discussion) with an **optional pseudonymous Space handle**, never publicly linked to the profile or shown to recruiters |
| Must | Nested comments (max depth 6); sort by Top, New and Controversial with documented formulas |
| Must | **Up and down votes** on posts and comments; one per person; **public net score**; voters never shown; display may be fuzzed, stored counts exact |
| Must | No profile karma or total score |
| Must | **Connect** (mutual) and **Follow** (one-way), with visibility controls on lists |
| Must | Feeds: Home, Following, Spaces |
| Must | Report, block, mute; new-account limits; vote-ring detection; moderation tools and appeals |
| Must | Votes and social activity never affect search, XP, rating, titles or challenge eligibility; users can exclude all social activity from recruiter view |
| Must | Invite-only launch in the first US field, then open after abuse and moderation gates |
| Must | Teens: Space handle only, profile posts off by default, no unsolicited adult messages, no contact details or school schedules |
| Should | "People a few steps ahead" (built); opt-in mentorship requests |
| Open | Public connection and follower counts on profiles |

This needs a new schema: current replies are flat, reactions are Helpful-only, and follows are one-way (`supabase/migrations/20261024001100_community.sql`).

**Success.** ≥ 15% of WAU read the feed weekly; reported content < 0.5% of posts.

### 15. Employers *(new)*

| Priority | Requirement |
| --- | --- |
| Must | New `organizations` model. The existing `companies` table stays the user's application tracker. |
| Must | Verification: domain control, business verification, role evidence, affiliate mapping, periodic re-checks. Domain email alone isn't enough. |
| Must | Org pages: legal and display name, domains, affiliates, logo, about, jobs, challenges |
| Must | Native job posts with owner org, location, remote status, work locations, pay, benefits, expiry, moderation and audit state. They use the same organic match score; native status never boosts rank. |
| Must | Sponsored job slots per area 10 |
| Must | **Apply with profile** (Phase G): the person picks exactly what to send; never automatic. This is the first way to hire from progress, before recruiter search. Adults only. |
| Must | **Candidate search** (Phase J): only adults with Open to roles on, only recruiter-visible items. Filters: Challenge Rating, title, level, stage, location, declared skills; rating is never the only ordering signal; order can't be bought. |
| Must | Recruiter messages rate-limited; recipient can accept, ignore, report or block; no messages to people not open to roles |
| Must | Every view, message, shortlist and export logged and visible to the candidate at org level |
| Must | Export to hiring software per area 10 (paid only) |
| Should | Hiring pipeline: shortlist, notes, stages, hired; "Hired on NextMilestone" milestone with consent |

**Success.** Employer north star: confirmed hires attributed to NextMilestone, confirmed by the candidate.

### 16. Challenges *(new)*

| Priority | Requirement |
| --- | --- |
| Must | Hosts: verified organizations (paid) or adult users at a set level or title (unpaid, unrated at launch) |
| Must | Host declares **Hiring challenge** or **Public competition** before publishing; type, host, rules, rating status, reward and data use lock when the first entrant joins |
| Must | Formats: timed problem set (auto-graded), take-home project (rubric), hackathon (teams, judges) |
| Must | **Unrated by default.** Hosts may request rated status; **only NextMilestone certifies it** (problem review, difficulty calibration, rubric, accommodations, anti-cheat standard, fixed rating weight, appeals). Payment never buys certification or weight. |
| Must | Host may set a **rating or title gate**, but every hiring opportunity also offers an open qualifier or equivalent-evidence route. A paid course is never the only prerequisite. |
| Must | **Rewards set by the host**: what (interview, offer fast-track, cash, swag) and how (top N, threshold, judges), within platform rules. "No reward" only for community or learning challenges. |
| Must | Entry screen lists the legal host, type, rating effect, rules, reward, IP terms, judging, retention, export and exactly what's shared. Required share: result, challenge rank, submission, and profile fields the entrant ticks (default name, headline, rating). Contact details are separate opt-in. |
| Must | Plagiarism and similarity flags are review signals, not verdicts; entrants see the allegation and can appeal before rating loss or disqualification |
| Must | Results visible to entrants with scoring explanation and rating change; team rating rules set before certification |
| Must | Teens: unrated, no-cash learning challenges only (after safety review) |
| Should | Showcase for entrant-approved submissions |

### 17. Educators and ads *(new)*

**Becoming an educator (YouTube model).** Any adult can draft and publish a course after rights and safety checks; risky material gets human review. Earning unlocks after a monetization review, like the YouTube Partner Program.

| Priority | Requirement |
| --- | --- |
| Must | Publishing needs verified contact info, rights representations, safety and accessibility checks, and creator terms |
| Must | **Monetization eligibility** (versioned): **1,000 valid followers + 4,000 qualified watch hours in 12 months + 3 publications or updates in 90 days**, plus identity, tax, sanctions, originality and policy review. Meeting the bar starts review; it doesn't guarantee approval. Revisit against YouTube's 8,000-hour bar for new applicants from Feb 1, 2027. |
| Must | **US-only at launch** for educator earnings and payouts; 18+ only |
| Must | **Course sales (Udemy split):** **97% of Net Course Revenue** when the educator's own coupon or link brought the buyer; **37%** when NextMilestone did. "Net" defined with finance and counsel; attribution rules published; rates versioned and changed only with notice. Gated on a contribution-margin check (R23). |
| Must | **30-day refunds** with disclosed abuse limits; educators paid after the refund window and a fraud reserve; refunds and chargebacks offset future earnings with appeal |
| Must | **Ad revenue (YouTube split):** **55% of Net Creator Ad Revenue**, allocated by valid qualified watch time. **Never paid per like, vote or follower.** |
| Must | **Ads only on free native courses**; never on paid courses, profiles, applications, interviews, challenges, candidate search, certificates or outside embeds. **Directly sold and contextual** (by course topic); no third-party trackers, retargeting or audience uploads. Labeled. **No ads to teens.** |
| Must | Ad targeting never uses job-search behavior, applications, recruiter visibility, rating, XP, private learning, interview prep, inferred unemployment or sensitive traits |
| Must | Educators may turn ads off on their free courses |
| Must | Paid promotion of a course is labeled, kept out of organic ranking, and its views, followers and watch time never count toward monetization or royalties |
| Must | **Valid watch time** needs an authenticated, server-issued playback session, signed heartbeats, visibility and duration checks, no duplicate playback and no self-watching. Suspect traffic is excluded, earnings held or adjusted, ads limited, then monetization suspended, with appeal ([YouTube invalid traffic](https://support.google.com/youtube/answer/10285842)). 90-day shadow period before ad payouts. |
| Must | Educator dashboard: sales by channel, refunds, valid watch time, provisional earnings, adjustments, payouts; no learner-private data |
| Must | Payouts through a processor that has approved the model in writing (Stripe treats creator-content platforms as restricted; prize money is a separate, prohibited flow) |
| Must | Every money event records amount, deductions, rule version, attribution, reserve and payout status |
| Should | Video on Cloudflare Stream or Mux (R25). Cloudflare lists $5 per 1,000 stored minutes/month and $1 per 1,000 delivered minutes ([Cloudflare](https://developers.cloudflare.com/stream/pricing/)): 1M minutes watched ≈ $1,000. |

---

## 7. Roadmap

Phases ship by gate, in dependency order. Full deliverables and gate checkboxes are in [`NextMilestone – v3 Phases.md`](NextMilestone%20–%20v3%20Phases.md).

```text
0 ──┬── 0B
    ├── E
    ├── L1 ── L2 ── L3
    └── F ──┬── G ───────┐
            └── H ── I ── J
                           └── K
```

| Phase | Scope | Gate (summary) |
| --- | --- | --- |
| **0** Foundation | Admin 2FA, security, age gate and teen mode, legal memos, Terms and Privacy rewrite, data and identity architecture, trust and safety operations | Counsel sign-off; MFA enforced; under-16 blocked; teen flags tested |
| **0B** v2 carry-over | PDF export, wire `orderByStage`, Outlook, student pricing, career-page job discovery, Today drag-to-reorder, LinkedIn import | Each item shipped or removed from claims |
| **E** Climb | XP ledger, server-authoritative writes, levels, quests, Boss, leagues, Momentum, stakes, penalties, appeals, sidebar regroup | XP reconciles with sources; no client-authoritative XP; R11 approved |
| **L1** Free Learn | Free native courses, outside links, one XP path, proof-of-learning XP, free group learning | No passive-view or YouTube XP; accessibility baseline |
| **F** Network | Posts, threads, votes, connections, Spaces, handles | Abuse, identity separation and moderation gates |
| **G** Employer jobs | Organizations, native jobs, sponsored slots, employer billing, Apply with profile | Counsel approves pilot; 20 verified orgs; scam process staffed |
| **L2** Educators and paid courses | Uploads, paid courses, entitlements, refunds, certificates, payouts | Processor approval; DMCA agent live; refund and payout reconciliation; margin check |
| **H** Unrated challenges | Hiring and public challenges, rules, judging, prizes | Counsel approval; prizes funded by hosts; no rating effect |
| **L3** Ads | Contextual ads on free courses, 55% ad share, fraud detection | Privacy rewrite live; GPC tested; 90-day fraud shadow |
| **I** Rating | Certified challenges, Glicko-2, titles, shadow mode | Calibration, impact review, accommodations; not shown to employers yet |
| **J** Candidate search | Recruiter seats, search, messages, paid export | Counsel sign-off; FCRA boundary; employer-block tests |
| **K** Launch | Integrated launch and scale | All gates and harm stops hold |

E, L1 and F can run in parallel after Phase 0; G and H can run in parallel; L2 can run alongside G and H.

---

## 8. Metrics

**People north star:** weekly active users completing a meaningful action (plan item, validated lesson, practice attempt, focus session, application step, post) on **3+ days** that week. Votes, follows, views, ads and purchases don't count.

**Employer north star:** confirmed hires attributed to NextMilestone, confirmed by the candidate.

| Guardrail | Target |
| --- | --- |
| Day-30 retention | Above the jobs-only baseline |
| Push opt-out | < 20% on each platform |
| AI cost per WAU | Within budget; own-key users cost $0 |
| Accessibility | 0 critical axe violations per release |
| Reported content | < 0.5% of posts |
| Calm mode uptake | < 25% (higher means the game feels punishing) |
| Appeals upheld | Tracked; a rising rate means rules are wrong |
| Free vs paid Week XP gap | No measurable gap after controlling for valid actions |
| Momentum share of league scores | Tracked; cap reduced if it concentrates outcomes |
| Recruiter block rate, job-scam rate, employer-exposure incidents | Tracked weekly |
| Invalid watch-time rate, payout adjustments, DMCA notices | Tracked weekly |
| Free → Pro conversion | Set after R2 |

**Also tracked:** employer funnel (verified orgs → jobs → qualified applicants → interviews → hires), challenge funnel, rating quality (calibration, stability, appeals, false positives, group impact), learning (validated lessons, group vs solo completion, certificate verification), creator marketplace (active educators, sales by channel, refunds, payout timeliness, earnings spread).

**Climb experiment (R11):** 8 weeks; arms XP only / XP + leagues / XP + leagues + stakes; Calm mode in every arm; cohorts enrolled in the first 2 weeks. Stop an arm on predeclared absolute and relative harm thresholds (deletion, push opt-out, upheld appeals, pressure complaints) with minimum exposure.

---

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Too many areas dilute quality | Independent phase gates; don't bundle |
| Two-sided cold start | Jobs and Apply with profile before recruiter search; one field and region first; recruit employers by hand |
| Companies buy influence over rank | Only NextMilestone certifies rated challenges and sets their weight |
| Paid courses become paid rank | One XP path for all; XP needs proof of learning; purchases earn nothing |
| Rating measures challenge familiarity, not ability | Certified comparable events, uncertainty, shadow mode, never "employability" |
| Quiet job seekers exposed | Item-level recruiter control, Space handles, employer blocks, access history, honest copy |
| FCRA, NYC LL144, Colorado, EEOC exposure | Phase 0 counsel memo; no "screening" marketing; validation and appeals |
| Minors in hiring, payments or ads | 16+ with teen mode; restricted sections unlock at 18 |
| Penalties drive people away | Caps, appeals, Calm mode, R11 harm stops |
| Educator and learner farm watch time | No XP for watching; separate ledgers; fraud detection, reserves, appeals |
| YouTube cuts API access | No rewards for YouTube engagement; compliant player or outbound links |
| Payment processor rejects prizes or creator payouts | Hosts pay prizes directly; written processor approval before creator payouts |
| 97% educator-referred split loses money | Net defined; margin gate before launch |
| Copyright volume | DMCA agent, queues, repeat-infringer policy |
| Ads damage trust | Free courses only, contextual, no trackers, no teens, never on job-search surfaces |
| Vote brigading | Private voters, no karma, ring detection, sanctions |
| Unpaid spec work | No-reward challenges limited to community/learning; IP limits |
| Google verification delays calendar sync | Apply early; read-only first |
| iOS push reach is low | Install prompt; email fallback |
| Name conflict | Trademark search (R3) |

---

## 10. Research plan

| # | Question | Decides |
| --- | --- | --- |
| R1 | Do US users in each stage want a daily plan? (12 interviews, clickable Today) | Phase A scope (done in v2 build; validate) |
| R2 | What will people pay? (Van Westendorp n ≥ 150, fake-door Pro) | Pro price, Free limits |
| R3 | Is "NextMilestone" clear? (USPTO, CIPO, UKIPO, EUIPO, domains) | Final name |
| R4 | Google Calendar verification time | Calendar timing |
| R5 | Voice transcription vendor (Web Speech vs Deepgram vs OpenAI on 50 answers) | Vendor |
| R6 | Is US job supply enough without scraping? | Launch field and metros |
| R7 | Where do the first question sets come from? | Prep content |
| R8 | First community field | Community launch |
| R9 | Does iOS push reach enough people? | Email fallback |
| R10 | Legal review (privacy, renewals) | Phase 0 gate |
| R11 | Do leagues and stakes keep people or drive them away? (8-week A/B) | Leagues and stakes launch |
| R12 | Employer pricing (jobs, sponsored slots, seats, hosting, export) | Employer prices |
| R13 | Hiring and privacy law: NYC LL144, Colorado SB 26-189, EEOC, ADA, FCRA, paid recruiter access as "sale", pay transparency, record retention | Phase 0 / G / J gates |
| R14 | Rating validity: Glicko-2, deviation thresholds, placement conversion, titles, shadow test | Rating launch |
| R15 | Do users and employers understand "daily progress + earned rating + hiring"? | Positioning |
| R16 | Quiet-job-seeker threat model, employer-block failures, Space-handle understanding | Privacy design |
| R17 | Challenge operations: rules template, IP, prize disputes, tax | Phase H |
| R18 | Contextual ads: architecture, GPC, advertiser moderation, acceptance | Phase L3 |
| R19 | Course demand: first-party vs educator vs outside links; free vs paid | Learn scope |
| R20 | Educator supply and earnings expectations | Educator launch |
| R21 | Learning together: group size, privacy, sync vs async | Group design |
| R22 | How recruiters read certificate labels | Certificate design |
| R23 | 97% / 37% contribution margin | Course-sales launch |
| R24 | Invalid traffic: 90-day shadow model | Ad payouts |
| R25 | Video vendor: Cloudflare Stream vs Mux | Vendor |
| R26 | Creator payments: processor approval, tax, KYC, reserves | Payout design |
| R27 | Copyright operations | Upload launch |
| R28 | Teen mode: state minor laws, contracts, teen-only leagues later | Teen rules |
| R29 | Momentum safety: concentration, schedule bias, comeback behavior | Momentum caps |

---

## 11. Decisions and open questions

**Decided (Oct 24, 2026):**
- [x] No one can buy rank (people's XP, level, rating, title, league position, search order)
- [x] Companies pay to post jobs, run challenges and search candidates
- [x] Sponsored job slots allowed (labeled, ≤ 1 per 10, relevance floor, never reorder organic)
- [x] Public up/down vote scores
- [x] One overall rating, chess-inspired
- [x] Challenge rewards set by the host, within platform rules
- [x] Optional pseudonymous Space handle
- [x] Export to hiring software is a paid employer feature; consent rules identical on every tier
- [x] One XP-eligible learning path for everyone
- [x] People north star: meaningful actions on 3+ days a week; hires measured separately
- [x] Momentum kept, bounded at ×1.15
- [x] Holiday freezes opt-in
- [x] Apply with profile in Phase G as the first hiring-from-progress path
- [x] Learn: free and paid courses; group learning of any size on free content, on paid only if everyone owns it
- [x] Educators follow YouTube's model; course sales use Udemy's 97% / 37% split; ad share 55% by watch time; no pay per like
- [x] Certificates from the educator or NextMilestone (one per course), visible to recruiters when shared
- [x] Minimum age 16; teen mode for 16–17; no guardian purchases, no teen ads, teens may browse jobs and follow outside links; age asked at the first restricted feature
- [x] Course formats at launch: video, text, quizzes, projects
- [x] No ads on paid courses; ads contextual and directly sold
- [x] Paid course = lifetime access to the purchased version
- [x] Educator earnings US-only at launch
- [x] "Identity verified" certificate = government ID via a vetted provider
- [x] Will recruiters see "Open to roles"? Yes: verified recruiters, opt-in per item, best-effort employer block, adults only

**Open:**
- [ ] Final name and domain (R3)
- [ ] Pro price and what stays free forever (R2)
- [ ] Employer prices (R12)
- [ ] Who writes the first paths and question sets? (R7)
- [ ] Voice transcription vendor (R5)
- [ ] First community field and invite size (R8)
- [ ] Production domain (`app/layout.tsx`, `app/sitemap.ts` and `app/robots.ts` still use `resume.himanshurawat.in`)
- [ ] Public connection and follower counts on profiles?
- [ ] Title names and rating thresholds (R14)
- [ ] Season length confirmed at 8 weeks?
- [ ] Video vendor (R25)

---

## 12. Built vs planned

States: **code exists** (not the same as tested, deployed or launch-ready), **tests exist**, **can't verify from repo**, **missing**.

| Item | Code | Tests | Evidence |
| --- | --- | --- | --- |
| Job fetch, ranking, Job Inbox, applications | Code exists | Tests exist | Job supply migration `…000200`, `tests/jobSupply.test.ts` |
| Restricted JobSpy sources gated | Code exists | Tests exist | `worker/orbithire_worker/fetchers/source_registry.py` |
| Onboarding, stage fields | Code exists | Tests exist | `…000400_stage_onboarding.sql`, `tests/onboarding.test.ts` |
| Stage-based sidebar order | Helper exists, **not wired** | Tests exist | `lib/onboarding/stageDefaults.ts:54`; sidebar is a static list (`components/Sidebar.tsx:73-87`) |
| Today plan, next step, regenerate | Code exists | Tests exist | `…000500`, `tests/todayNextStep.test.ts` |
| Today drag-to-reorder | Missing | Missing | |
| Learn log, 4 paths, progress, library | Code exists | Tests exist | `…000600_learn.sql`, `tests/learn.test.ts` |
| Courses, media, purchases, groups, certificates | Missing | Missing | No creator, price, entitlement or certificate fields |
| Server-authoritative learning progress | Missing | Missing | Users write `path_progress` directly |
| Interview prep, voice, mocks | Code exists | Tests exist | `…000800`, `tests/prep.test.ts` |
| Focus, offline sync, Google Calendar | Code exists | Tests exist | `…000700`, `tests/focus.test.ts` |
| Outlook calendar | Missing | Missing | Settings card "Soon" |
| Community (invite-only, Helpful, flat replies, follows) | Code exists | Tests exist | `…001100_community.sql`, `tests/community.test.ts` |
| Threads, votes, connections, Spaces | Missing | Missing | |
| Profile, milestones, public profile, print view | Code exists | Tests exist | `…000900`, `tests/milestones.test.ts` |
| Recruiter audience, Open to roles for recruiters | Missing | Missing | `open_to_roles` is owner-only |
| PWA, push, offline queue | Code exists | Tests exist | `…001200_pwa_push.sql`, `tests/pwa.test.ts` |
| Career-page `JobPosting` discovery | Missing | Missing | |
| Billing, plan limits, renewals | Code exists | Tests exist | `…001000_billing.sql`, `tests/billing.test.ts` |
| Student pricing | Missing | Missing | Pricing page says "coming soon" |
| Account export JSON and HTML | Code exists | Tests exist | `app/api/account/export/route.ts` |
| Account export PDF | Missing | Missing | Route accepts only JSON or HTML |
| GPC, AI labels, contact retention | Code exists | Tests exist | `…000300_trust_privacy.sql`, `tests/trustPrivacy.test.ts` |
| Admin sessions, roles, moderation | Code exists | Tests exist | `…20261023000001_p0_security_hotfixes.sql`, `…000100_admin_roles.sql` |
| Admin 2FA | Missing | Missing | No TOTP in admin auth |
| Climb (XP, leagues, Momentum, stakes, rating) | Missing | Missing | |
| Organizations, native jobs, search, export | Missing | Missing | `companies` is the user's tracker |
| Challenges, certification, prizes | Missing | Missing | |
| Educators, ads, payouts | Missing | Missing | |
| Age gate and teen mode | Missing | Missing | No birth date or age band on the profile |
| Email sender name, deployments, counsel, verification, SOC 2 | Can't verify from repo | | External |

---

## 13. Marketing and policy promises to change

The live site and policies promise things v3 changes. Each changes before its feature is exposed:

- "No like counts, no follower counts": `app/community/page.tsx:10-35`, `components/marketing/community-section.tsx:104`, `components/marketing/faq-data.ts:136-145`
- "No streaks to break": `app/product/focus/page.tsx:34-44`, `components/marketing/cinematic-focus.tsx:176`, `components/marketing/faq-data.ts:38-48, 94-104`
- "We're not an employer, recruiter or staffing agency": `app/terms/page.tsx:42`
- Content license (for posts, courses, submissions, employer access): `app/terms/page.tsx:82-90`
- Match scores not shared with employers (keep for match scores; add Challenge Rating and certificates): `app/privacy/page.tsx:82-100`
- Sharing only with processors: `app/privacy/page.tsx:104-123`
- GPC "already in effect": `app/privacy/page.tsx:129-136`
- No legally significant profiling: `app/privacy/page.tsx:141-158`
- No advertising cookies or ad trackers: `app/privacy/page.tsx:52-60`
- "Not knowingly from children under 16" → 16+ with teen mode: `app/privacy/page.tsx:116-123`
- Free includes one learning path; Pro opens every path (distinguish paths, purchased courses and the one XP path): `app/pricing/page.tsx:28-45`
- "About 30 sources": count only terms-compatible sources
- Never use "screened", "vetted", "background checked", "employability score", "accredited" or "job ready" without counsel approval

Promises from v2 still to keep: plan at 6:30 AM and matches at 7 AM; 4 paths with 8–15 min lessons; text or voice answers with one strength, one gap, one next read; offline focus timer; Google Calendar at launch; invite-only community starting in the US; score explanations.

---

## 14. Glossary

- **WAU:** weekly active users
- **ATS feed:** an applicant tracking system's public jobs API
- **CASA:** Google's security assessment for restricted scopes
- **GPC:** Global Privacy Control, a browser opt-out signal
- **Lifetime XP / Week XP:** permanent progress / weekly league score
- **Momentum:** the bounded Week XP boost for showing up on planned weekdays
- **Challenge Rating:** the one overall, chess-inspired rating from certified challenges
- **Rating deviation:** how uncertain a rating is; grows with inactivity
- **Camp:** a league tier (Base Camp to Summit)
- **Space / Space handle:** a topic community / an optional pseudonym used there
- **Sponsored slot:** a labeled paid job placement
- **Net Course Revenue / Net Creator Ad Revenue:** the amounts educator shares are calculated on
- **FCRA:** Fair Credit Reporting Act; **CRA:** consumer reporting agency
- **DMCA agent:** the contact registered with the Copyright Office for takedowns
- **Teen mode:** the restricted experience for 16–17-year-olds

---

## 15. Sources

Pages opened Oct 22–24, 2026 unless noted. "Search result only" means the page itself wasn't opened.

- [BLS JOLTS, Aug 2026](https://www.bls.gov/news.release/jolts.nr0.htm)
- [Huntr pricing](https://huntr.co/pricing), [Final Round AI pricing](https://www.finalroundai.com/pricing), [Wellfound pricing](https://wellfound.com/recruit/pricing)
- [Handshake: viewing student profiles](https://support.joinhandshake.com/hc/en-us/articles/219133157-Viewing-Student-Profiles)
- [Microsoft FY2026 Q4](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4); [LinkedIn promoted jobs](https://www.linkedin.com/help/linkedin/answer/a512429/promoted-jobs-in-your-job-search-results); [LinkedIn Open to Work privacy](https://www.linkedin.com/help/linkedin/answer/a507508/let-recruiters-know-you-re-open-to-work)
- [Reddit Q2 2026 results (SEC)](https://www.sec.gov/Archives/edgar/data/1713445/000171344526000098/earningspressreleaseq226.htm); [Reddiquette](https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette)
- [Chess.com ratings](https://support.chess.com/en/articles/8566476-how-do-ratings-work-on-chess-com), [Players League](https://support.chess.com/en/articles/8557800-what-is-the-players-league), [Lichess FAQ](https://lichess.org/faq), [Codeforces help](https://codeforces.com/help)
- [YouTube monetization](https://support.google.com/youtube/answer/94522), [2027 YPP changes](https://support.google.com/youtube/answer/12843009), [invalid traffic](https://support.google.com/youtube/answer/10285842), [Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [Udemy instructor revenue share](https://support.udemy.com/hc/en-us/articles/229605008-Instructor-revenue-share); [Coursera certificates](https://www.coursera.support/s/article/learner-000001187?language=en_US); [edX verified certificates](https://support.edx.org/hc/en-us/articles/206502008-What-is-a-verified-certificate)
- [Duolingo: streaks and wagers](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/), [improving the streak](https://blog.duolingo.com/improving-the-streak); [GitHub streak natural experiment](https://arxiv.org/abs/2006.02371); [broken streaks (JCR)](https://academic.oup.com/jcr/article/49/6/1095/6623414); [Lund commitment-contract RCT](https://swopec.hhs.se/lunewp/abs/lunewp2023_004.htm)
- [FTC v. Pact](https://www.ftc.gov/news-events/news/press-releases/2017/09/mobile-app-settles-ftc-allegations-it-failed-deliver-promised-cash-rewards-meeting-exercise-diet); [FTC v. Spokeo](https://www.ftc.gov/news-events/news/press-releases/2012/06/spokeo-pay-800000-settle-ftc-charges-company-allegedly-marketed-information-employers-recruiters)
- [NYC AEDT (LL144)](https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page); [Colorado AG on AI law](https://coag.gov/ai/); [EEOC selection procedures](https://www.eeoc.gov/laws/guidance/employment-tests-and-selection-procedures); [EEOC recordkeeping](https://www.eeoc.gov/employers/summary-selected-recordkeeping-obligations-29-cfr-part-1602)
- [California AG: CCPA](https://oag.ca.gov/privacy/ccpa); [Colorado SB24-041](https://www.leg.colorado.gov/bills/sb24-041); [Connecticut Data Privacy Act](https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act); [Maryland targeted-ad restriction](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&enactments=false&section=14-4707); [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions); [DOL child labor (non-ag)](https://www.dol.gov/agencies/whd/fact-sheets/43-child-labor-non-agriculture)
- [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses); [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/); [Mux pricing](https://www.mux.com/pricing)
- [Copyright Office: Section 512](https://www.copyright.gov/512/); [FTC: Disclosures 101](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers)
- [WebKit: web push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); [Lowenstein on auto-renewal](https://www.lowenstein.com/news-insights/publications/client-alerts/ftc-click-to-cancel-rule-on-hold-but-california-s-automatic-renewal-law-remains-intact-what-companies-need-to-know-privacy)
- Repo: `reports/Low cost job data strategy.md`, `supabase/migrations/`, `worker/orbithire_worker/`, `lib/billing/limits.ts`, `app/terms/page.tsx`, `app/privacy/page.tsx`
- Review record: seven Codex critique rounds, Oct 24, 2026 (session `01a16a45-bc32-7c83-b65c-cd4936a2ae4a`)
