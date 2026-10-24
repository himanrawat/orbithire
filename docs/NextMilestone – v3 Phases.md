# NextMilestone v3 Delivery Checklist

**Document status:** Planning checklist  
**Scope:** PRD v3 Parts 1 and 2, v2 carry-over, age-based unlocks (16+), and the frontend component plan  
**Launch market:** United States  
**Completion rule:** A phase is complete only when every deliverable required for that phase is complete and every Gate checkbox is checked.

## How to use this file

- Tick a deliverable only after its implementation or non-code artifact has been reviewed.
- Tick a Gate only when its measurable condition has been demonstrated with retained evidence.
- Tick `Phase X complete` last.
- A phase may begin before every parallel phase finishes, but it may not cross a dependency or Gate listed below.
- “Counsel approved” means written advice scoped to the implemented data flows and product copy.
- “Verified” means demonstrated in tests, staging evidence, policy artifacts, or operating records—not merely that code exists.
- Existing branch code is not pre-checked; it must still pass the relevant Gate.
- No phase may silently weaken teen restrictions, rank integrity, privacy, accessibility, or appeal rights.

## Legend

| Mark | Meaning |
|---|---|
| `- [ ]` | Planned or not yet verified |
| `- [x]` | Completed and verified |
| **Blocking** | Must finish before dependent phases launch |
| **Parallel** | May proceed concurrently after shared dependencies pass |
| **Counsel** | Requires written legal review |
| **Ops** | Requires an operating process, named owner, and escalation path |

## Phase sequence

The existing IDs `0, E, F, G, H, I, J, L1, L2, L3` are retained so the checklist maps back to PRD v3. `0B` contains the v2 carry-over. `K` is added as the integrated launch gate.

```text
0 ──┬── 0B
    ├── E
    ├── L1 ── L2 ── L3
    └── F ──┬── G ───────┐
            └── H ── I ── J
                           └── K
```

E, L1, and F may run in parallel after Phase 0. Phase G may start after F’s abuse and identity gates pass without waiting for every F rollout cohort. H may run in parallel with G. L2 may run in parallel with G and H after L1 and its legal dependencies pass.

## Age-based unlocks

Sections of the app unlock by age band. Under 16 can't create an account. Age comes from a neutral date-of-birth step, stored apart from the profile; product code sees only the band. Features marked "ID" also need identity verification at the moment they unlock.

| Feature | 16–17 (teen mode) | 18+ | Unlocks in phase |
|---|---|---|---|
| Today, daily plan, focus timer, learning log | ✅ | ✅ | existing |
| Free courses, outside links, group learning (free content) | ✅ moderated groups, no adult DMs | ✅ | L1 |
| XP, levels, quests, trophies | ✅ positive XP only | ✅ | E |
| Momentum multiplier, stakes, Rust, penalties | ❌ | ✅ | E |
| Weekly leagues | ❌ at launch (teen-only leagues later) | ✅ opt-in | E |
| Social posts and threads | ✅ Space handle only, profile posts off by default | ✅ | F |
| Votes on posts and comments | ✅ | ✅ | F |
| Connect / follow | ✅ teens and peers; no recruiter follows | ✅ | F |
| Direct messages | ✅ no unsolicited messages from adults | ✅ | F |
| Browse jobs, follow external apply links | ✅ with age-eligibility notice | ✅ | G |
| Apply with profile | ❌ | ✅ | G |
| Paid courses | ❌ (no guardian purchase at launch) | ✅ | L2 |
| Certificates | ✅ free courses; private by default | ✅ recruiter-visible if shared | L2 |
| "Identity verified" certificate | ❌ | ✅ ID | L2 |
| Educator: upload and publish | ❌ private drafts only | ✅ | L2 |
| Educator: earnings and payouts | ❌ | ✅ ID, US only | L2 / L3 |
| Ads | ❌ none shown | ✅ contextual, free courses only | L3 |
| Unrated learning challenges (no cash) | ✅ after safety review | ✅ | H |
| Cash-prize, hiring and rated challenges | ❌ | ✅ | H / I |
| Challenge Rating and titles | ❌ | ✅ | I |
| Visible to recruiters, candidate search, recruiter messages, export | ❌ | ✅ opt-in | J |
| Host a challenge (organization or individual) | ❌ | ✅ | H |

**Turning 18:** nothing unlocks or becomes visible on its own. The person sees the new options, accepts the adult Terms, and chooses each one (recruiter visibility, public profile, leagues, ads, purchases, challenges, messages). Activity from teen years is never published or shown to recruiters automatically.

- [ ] Age band stored separately from the profile; services read only `under_16`, `teen_16_17` or `adult_18_plus`.
- [ ] Every row above enforced on the server, not only hidden in the UI.
- [ ] Locked features show a short "Unlocks at 18" note instead of disappearing, with no countdown or pressure copy.
- [ ] Automated tests cover every row for both bands and the 18th-birthday transition.

## Frontend components

New screens use shadcn components, starting with these from 21st.dev, then more from 21st.dev as each phase needs them.

| Component | Install | What it is | Use it for | Phase |
|---|---|---|---|---|
| Contribution Skyline | `npx shadcn@latest add "https://21st.dev/r/kedhareswer/contribution-skyline"` | Contribution graph that turns into a 3D skyline; tooltips, keyboard, total, busiest day and streak stats | Learning and activity heatmap on the profile and Climb hub | E, L1 |
| Web3 Bento | `npx shadcn@latest add "https://21st.dev/r/romanvasnev/web3-bento"` | Bento dashboard with live gauge, chart, allocation bar, accruing-rewards tile and activity stream | Layout for the Climb hub: Week XP, Momentum gauge, XP at risk, stakes, league activity. Swap the crypto content and lime accent for NextMilestone tokens | E |
| Analytics Bento | `npx shadcn@latest add "https://21st.dev/r/romanvasnev/analytics-bento"` | Revenue line, desktop vs mobile, category treemap, radar; SVG only | Educator dashboard (earnings, watch time, devices, course mix) and employer job-post performance | L2, L3, G |
| Dashboard 1 | `npx shadcn@latest add "https://21st.dev/r/ravikatiyar162/dashboard-1"` | Animated header, two stat cards and a call-to-action banner (framer-motion) | Organization home for employers and the Today summary strip | G |

Notes:

- The repo has no `components.json` yet, so `npx shadcn@latest init` comes first.
- 21st.dev's registry asks for authentication on these URLs (checked Oct 24, 2026), so installs need a signed-in 21st.dev account or API key.
- `framer-motion` is already a dependency; the others list no extra libraries, but check each install's dependency list.

- [ ] Run `npx shadcn@latest init`, mapped to NextMilestone's tokens in `app/globals.css` and fonts in `app/fonts.ts`.
- [ ] Set up 21st.dev authentication for registry installs.
- [ ] Install the four components above and record each one's source and license.
- [ ] Restyle every installed component to NextMilestone tokens in light and dark; no copied accent colors.
- [ ] Feed components real props only; no hard-coded sample data ships.
- [ ] Meet WCAG 2.2 AA: keyboard, screen reader labels, 44 px targets, `prefers-reduced-motion` (the 3D skyline needs a flat fallback).
- [ ] Check bundle size and lazy-load heavy components (3D skyline, bentos) below the fold.
- [ ] Before each phase's UI work, pick further 21st.dev components and add them to this table.

## Progress summary

| Phase | Scope | Status | Gate met |
|---|---|---:|---:|
| 0 | Foundation, security, legal, age assurance | Not started | No |
| 0B | v2 carry-over | Not started | No |
| E | Climb economy, leagues, and loss controls | Not started | No |
| L1 | Free Learn foundation and group learning | Not started | No |
| F | Social network, Spaces, voting, and safety | Not started | No |
| G | Organizations, jobs, sponsorship, and Apply with profile | Not started | No |
| L2 | Educators, paid courses, certificates, and payouts | Not started | No |
| H | Unrated challenges and competitions | Not started | No |
| L3 | Contextual advertising and creator ad revenue | Not started | No |
| I | Certified Challenge Rating and titles | Not started | No |
| J | Candidate search, recruiter seats, and ATS export | Not started | No |
| K | Integrated launch and scale gate | Not started | No |

---

## Phase 0 · Foundation, security, legal, and age assurance

- [ ] Phase 0 complete

**Goal:** Establish the data, security, policy, legal, age, and operating foundations required by every v3 surface.

**Depends on:** None.

### Product governance

- [ ] Approve the consolidated PRD v3 as the sole implementation baseline.
- [ ] Record every owner decision and its exact product consequence.
- [ ] Record the definition of “rank” across XP, rating, titles, leagues, candidate search, votes, and sponsored inventory.
- [ ] Record that payment may never increase a person’s XP, rating, title, league position, vote score, or organic candidate position.
- [ ] Assign accountable owners for product, engineering, security, privacy, trust and safety, legal, finance, and support.
- [ ] Define a documented exception process requiring product, privacy, and integrity review.
- [ ] Define feature flags and kill switches for social, employer, challenge, rating, creator, payout, and advertising systems.

### Architecture and data

- [ ] Approve distinct models for organizations, native job postings, imported job inventory, challenges, rating, social content, courses, purchases, certificates, ads, and payouts.
- [ ] Preserve the existing application-tracker `companies` model rather than repurposing it for employer accounts.
- [ ] Define immutable identifiers and retention rules for every new regulated record.
- [ ] Define event versioning for XP, rating, votes, moderation, exports, consent, appeals, certificates, and payouts.
- [ ] Define idempotency requirements for every XP, rating, settlement, entitlement, refund, and payout write.
- [ ] Define a data-classification inventory covering identity, age, education, employment, behavioral, assessment, anti-cheat, payment, and advertising data.
- [ ] Define service boundaries that prevent clients from directly writing authoritative XP, rating, ownership, certificate, payment, or moderation state.
- [ ] Document deletion propagation across application data, exports, challenge hosts, ATS integrations, course systems, and advertising logs.
- [ ] Document backup deletion and legal-hold behavior.
- [ ] Complete architecture review for row-level security, privileged functions, API routes, workers, queues, and webhook trust.

### Security

- [ ] Require TOTP or stronger MFA for every admin account.
- [ ] Require step-up authentication for policy changes, payouts, refund overrides, rating corrections, employer verification, and data exports.
- [ ] Add least-privilege admin roles for moderation, appeals, employer operations, creator operations, payments, privacy, and security.
- [ ] Add append-only admin and privileged-action audit logs.
- [ ] Add session inventory and forced revocation for administrative accounts.
- [ ] Define secrets rotation and production-access review procedures.
- [ ] Threat-model XP fraud, rating manipulation, voting abuse, creator fraud, invalid traffic, ATS export abuse, prize disputes, and age evasion.
- [ ] Complete secure webhook designs for payments, payouts, identity verification, withdrawals, deletions, and ATS propagation.
- [ ] Define evidence-preservation procedures for appeals, fraud investigations, legal holds, and account deletion.
- [ ] Run an independent security review before any employer, payment, payout, or advertising production launch.

### Age assurance and teen mode

- [ ] Add a neutral date-of-birth step before a new user creates an account.
- [ ] Block users under 16 before persistent account creation.
- [ ] Add a restricted age-assurance record separate from the public profile.
- [ ] Store only the minimum age data needed to enforce age bands and the eighteenth-birthday transition.
- [ ] Expose age-band eligibility flags rather than DOB to ordinary application services.
- [ ] Add `under_16`, `teen_16_17`, and `adult_18_plus` policy states.
- [ ] Add an age-declaration flow for existing accounts before social, employer, commerce, challenge, or advertising access.
- [ ] Permit existing undeclared users to use only designated private planning features until age declaration.
- [ ] Add an age-correction and appeal workflow.
- [ ] Freeze high-risk surfaces when credible age-conflict evidence exists.
- [ ] Define when stronger age or identity verification is proportionate.
- [ ] Prohibit publication of a user’s exact age or birthdate.
- [ ] Add an eighteenth-birthday transition requiring fresh adult choices.
- [ ] Preserve teen visibility and messaging defaults after the user turns 18.
- [ ] Prevent historical teen activity from becoming public or recruiter-visible automatically.
- [x] Decided (Oct 24, 2026): no parent or guardian consent system at launch; teens can't buy paid courses.
- [x] Decided (Oct 24, 2026): no ads to teens at launch.
- [x] Decided (Oct 24, 2026): teens may browse jobs and follow external application links, with a notice that NextMilestone hasn't checked age eligibility; Apply with profile stays adult-only.
- [x] Decided (Oct 24, 2026): existing users declare their birth date the first time they open a restricted feature; private planning tools keep working until then.
- [ ] Gate each restricted feature on the age-based unlock table at the top of this file.

### Teen policy baseline

- [ ] Exclude teen profiles from recruiter search and candidate discovery.
- [ ] Exclude teen posts, progress, certificates, XP, and challenge records from employer products.
- [ ] Block recruiter follows, recruiter connections, ATS exports, and recruiter messages for teens.
- [ ] Block Apply with profile for teens at launch.
- [ ] Block paid course purchases by teens unless a guardian purchase system is approved.
- [ ] Block educator publishing, monetization, ad revenue, referrals, and payouts for teens.
- [ ] Block cash-prize, hiring, and rated challenges for teens.
- [ ] Disable XP stakes, Rust, negative XP, public demotion, and Momentum multipliers for teens.
- [ ] Block teens from public and mixed-age leagues at launch.
- [ ] Block unsolicited adult-to-teen direct messages.
- [ ] Prevent teen profiles and posts from exposing contact details, precise location, or school schedules.
- [ ] Require a completed minor-design assessment before any teen social recommendation or advertising launch.
- [ ] Document teen moderation, grooming, self-harm, harassment, and emergency-escalation procedures.

### Legal and compliance

- [ ] Obtain counsel’s written analysis of the platform’s employer, recruiter, marketplace, and selection-tool roles.
- [ ] Obtain counsel’s written analysis of material FCRA risk and whether any product makes NextMilestone a consumer reporting agency.
- [ ] Obtain counsel’s written analysis of NYC Local Law 144 applicability.
- [ ] Update the Colorado AI Act date and obligations to reflect current law.
- [ ] Obtain a multistate pay-transparency and native-job-posting requirements matrix.
- [ ] Obtain a state child-labor matrix for any planned teen job workflow.
- [ ] Obtain a state minor-contract analysis for purchases, creator terms, prizes, and paid services.
- [ ] Obtain a youth privacy and design analysis covering Colorado, Connecticut, Maryland, California, and other launch-relevant states.
- [ ] Obtain counsel’s analysis of adult-to-minor communications and group-learning safety.
- [ ] Obtain contest and prize-law review for every challenge type.
- [ ] Obtain tax analysis for creator income, refunds, prizes, and information reporting.
- [ ] Obtain intellectual-property review for courses, projects, certificates, outside links, and challenge submissions.
- [ ] Define accessibility and accommodation obligations for courses, challenges, assessments, jobs, and employer workflows.
- [ ] Confirm whether any planned use constitutes biometric or identity-document processing.
- [ ] Document records required for validation, adverse-impact monitoring, candidate explanations, and appeals.

### Terms, privacy, and public promises

- [ ] Rewrite the Terms before NextMilestone acts as an employer marketplace, recruiter tool, challenge host, educator marketplace, or advertising platform.
- [ ] Rewrite the Privacy Policy for employer access, candidate sharing, ATS export, social visibility, course commerce, certificates, identity verification, age processing, and advertising.
- [ ] Preserve the promise that NextMilestone does not sell or license user data.
- [ ] Define “sharing” and GPC behavior for the implemented advertising architecture.
- [ ] State that directly sold contextual ads do not affect votes, XP, rating, titles, leagues, or organic ranking.
- [ ] Add teen-specific privacy and safety disclosures.
- [ ] Add retention schedules by data class.
- [ ] Add appeal, correction, deletion, and withdrawal explanations.
- [ ] Remove or qualify the existing statement that NextMilestone is not an employer, recruiter, or staffing agency before employer launch (`app/terms/page.tsx:37-44`).
- [ ] Replace the existing claim that match scores are not shared with employers if the employer product changes that fact (`app/privacy/page.tsx:82-100`).
- [ ] Update the current no-advertising-tracker disclosure for the exact contextual-ad implementation (`app/privacy/page.tsx:52-60`).
- [ ] Review every landing page, onboarding screen, email, notification, and app-store description against the final product behavior.

### Trust and safety operations

- [ ] Define moderation policies for profiles, posts, threads, replies, courses, projects, challenges, ads, organizations, jobs, and messages.
- [ ] Define severity levels, response targets, appeal windows, and escalation paths.
- [ ] Establish processes for impersonation, employer fraud, grooming, harassment, hate, threats, scams, and intellectual-property complaints.
- [ ] Establish candidate, creator, educator, employer, advertiser, and minor-safety support queues.
- [ ] Define evidence access controls and moderator privacy training.
- [ ] Define law-enforcement and emergency-disclosure procedures.
- [ ] Establish transparent enforcement notices and appeal outcomes.
- [ ] Define repeat-abuse and ban-evasion controls.
- [ ] Create incident runbooks for erroneous rank changes, data exposure, bad ads, payout errors, employer abuse, and minor-safety reports.

### Gate

- [ ] Counsel has signed off on the launch-bound employer, teen, commerce, contest, advertising, and rating designs.
- [ ] Every admin is enrolled in enforced MFA and privileged actions are audited.
- [ ] The age gate blocks under-16 account creation in automated and manual testing.
- [ ] Teen policy flags prevent every prohibited employer, commerce, challenge, league, messaging, and advertising path.
- [ ] The eighteenth-birthday transition has been tested without automatic publication or recruiter exposure.
- [ ] Threat models have named owners and no unresolved critical finding.
- [ ] Terms, Privacy Policy, teen disclosures, retention schedule, and GPC behavior are approved for staging.
- [ ] Data architecture, deletion propagation, and service-authority boundaries are approved.
- [ ] Trust and safety staffing and escalation coverage are approved for the intended rollout size.

---

## Phase 0B · v2 carry-over

- [ ] Phase 0B complete

**Goal:** Close the remaining v2 gaps so v3 does not build on incomplete or misleading foundations.

**Depends on:** Phase 0 architecture and security decisions; may otherwise run in parallel with E, L1, and F.

### Export and portability

- [ ] Add the promised PDF account export format.
- [ ] Include all required account-data categories in JSON, HTML, and PDF exports.
- [ ] Clearly distinguish machine-readable export from human-readable export.
- [ ] Add export authorization, rate limiting, audit logging, and expiry.
- [ ] Add tests for export completeness, escaping, authorization, and deletion-state behavior.
- [ ] Update product copy that currently exceeds the implemented JSON and HTML formats (`app/api/account/export/route.ts:38-43`).

### Onboarding and navigation

- [ ] Wire `orderByStage` into the actual sidebar ordering.
- [ ] Keep group order fixed while allowing stage-based initial expansion.
- [ ] Preserve the single Climb entry with internal tabs.
- [ ] Add tests showing the stage helper changes rendered navigation order or expansion as specified.
- [ ] Verify keyboard, screen-reader, mobile, and collapsed-sidebar behavior.
- [ ] Reconcile the stage helper (`lib/onboarding/stageDefaults.ts:50-63`) with the currently static navigation (`components/Sidebar.tsx:73-87`).

### Integrations

- [ ] Implement Outlook calendar integration.
- [ ] Add OAuth consent, token storage, refresh, revocation, deletion, and least-scope controls.
- [ ] Add calendar conflict, timezone, recurrence, and disconnected-account tests.
- [ ] Add integration status and recovery UI.
- [ ] Add privacy disclosures for connected calendar data.

### Pricing

- [ ] Decide the eligibility standard for student pricing.
- [ ] Implement verification, expiry, renewal, appeals, refunds, and fraud controls.
- [ ] Replace “coming soon” student-pricing copy when the program is operational (`app/pricing/page.tsx:65-68`).
- [ ] Verify that student pricing never changes XP, rating, titles, league position, or search rank.

### Admin

- [ ] Implement enforced admin TOTP or stronger MFA.
- [ ] Add recovery codes and a controlled recovery procedure.
- [ ] Add session inventory, forced logout, and security-event notifications.
- [ ] Add audit records for authentication-factor and role changes.
- [ ] Test lockout, recovery, revocation, and compromised-session flows.

### Jobs

- [ ] Discover jobs from employers' own career pages via schema.org `JobPosting` structured data and sitemaps (PRD v2 area 9 Should).
- [ ] Add that discovery to the job-supply worker, respecting robots.txt and each site's terms.
- [ ] Record source and legal basis for every discovered listing, as for other sources.
- [ ] De-duplicate discovered jobs against ATS-feed and imported listings.
- [ ] Add stale-post, closure, and dead-link handling.
- [ ] Add discovery coverage and de-duplication tests.

### Interaction polish

- [ ] Implement accessible drag-to-reorder for Today's daily plan items (PRD v2 area 2 Could).
- [ ] Provide keyboard and non-drag alternatives.
- [ ] Persist order with concurrency and rollback handling.
- [ ] Test touch, keyboard, screen reader, reduced motion, and failed-save behavior.

### LinkedIn import

- [ ] Define LinkedIn import as user-supplied document parsing rather than unauthorized scraping.
- [ ] Implement supported PDF or data-file import.
- [ ] Show a field-by-field preview before saving.
- [ ] Record provenance and allow correction.
- [ ] Prevent imported claims from becoming “verified.”
- [ ] Add deletion handling for uploaded source documents.
- [ ] Review the flow against LinkedIn terms and applicable law.

### Gate

- [ ] PDF export is complete, authorized, accessible, and regression-tested.
- [ ] The rendered sidebar follows approved stage behavior.
- [ ] Outlook connect, refresh, revoke, and delete flows pass integration tests.
- [ ] Student pricing is either operational or removed from launch claims.
- [ ] Admin MFA is enforced in production-like staging.
- [ ] Career-page `JobPosting` discovery adds de-duplicated, terms-compatible listings end to end.
- [ ] Reordering is accessible without a pointer device.
- [ ] LinkedIn import has legal approval and never labels imported data verified.

---

## Phase E · Climb economy, leagues, and bounded loss

- [ ] Phase E complete

**Goal:** Launch a fair, auditable motivation system with excitement and bounded adult loss mechanics.

**Depends on:** Phase 0. May run in parallel with L1 and F.

### Economy and data

- [ ] Implement separate Lifetime XP and Week XP ledgers.
- [ ] Make Lifetime XP monotonically nondecreasing.
- [ ] Reset Week XP at the defined weekly boundary.
- [ ] Store immutable, versioned XP events with source, rule, timestamp, idempotency key, and reversal linkage.
- [ ] Implement the explicit qualifying-action list.
- [ ] Ensure paid and free equivalents award the same amount for equivalent effort.
- [ ] Route authoritative XP writes through validated server operations.
- [ ] Add ownership, transition, timestamp, plausibility, and duplication checks.
- [ ] Add XP corrections as reversals rather than destructive edits.
- [ ] Add a rule-version migration policy.

### Momentum

- [ ] Apply Momentum only to adult Week XP.
- [ ] Set the multiplier to ×1.15.
- [ ] Cap Momentum bonus at 25 Week XP per day.
- [ ] Cap Momentum bonus at 75 Week XP per week.
- [ ] Reset Momentum at the weekly league boundary.
- [ ] Exclude Lifetime XP, quest bonuses, challenge rewards, Boss rewards, stakes, reversals, and penalties from multiplication.
- [ ] Make a qualifying day require an approved 10+ base-XP event in the user’s local day.
- [ ] Skip selected rest days and valid opt-in holiday freezes.
- [ ] End the multiplier prospectively after an unprotected missed day without clawing back earned XP.
- [ ] Give comeback users a clean ×1.0 start rather than inherited debt.
- [ ] Count Momentum bonus inside league score.
- [ ] Count Momentum bonus as earned Week XP when calculating the 25% non-stake penalty cap.
- [ ] Disable Momentum for teen accounts.
- [ ] Use the one-line explanation: “Build momentum for a 15% Week XP boost, capped at 25 a day and reset every Monday.”

### Actions and caps

- [ ] Award focus completion per verified session for at most two Week-XP sessions per day.
- [ ] Route additional valid focus sessions to Lifetime XP only.
- [ ] Give offline sessions equal credit after plausibility and synchronization checks.
- [ ] Give every user one XP-eligible learning path.
- [ ] Prevent paid paths or paid courses from earning more rank-relevant XP than the free eligible path.
- [ ] Award lessons beyond the eligible path to Lifetime XP only where approved.
- [ ] Cap quest XP at 140 per day.
- [ ] Limit rank-relevant quest-set bonus to 50 Week XP.
- [ ] Route Boss and weekly challenge rewards to Lifetime XP and trophies only.
- [ ] Prevent voice, paid feedback, Pro mocks, paid courses, certificates, and creator content from buying rank.

### Quests, Boss, and streak

- [ ] Generate deterministic stage-based quest templates.
- [ ] Display quest criteria and XP before the user begins.
- [ ] Track Boss progress as a counter rather than XP.
- [ ] Void or reschedule a Boss when the linked interview is canceled or rescheduled.
- [ ] Keep the streak with one qualifying action rather than requiring full daily-plan completion.
- [ ] Separate streak state from Momentum state.
- [ ] Add rest days, Pause, opt-in holiday freezes, and timezone rules.
- [ ] Allow at most one honored timezone change per week and flag additional changes.
- [ ] Prevent paid streak freezes, restores, penalty relief, or multiplier restoration.
- [ ] Apply teen-safe positive-only progression rules.

### Penalties and stakes

- [ ] Cap non-stake adult penalties at 25% of Week XP earned that week.
- [ ] Floor Week XP at zero.
- [ ] Add one warning day before Rust.
- [ ] Reverse the first Rust event when the item is archived as obsolete.
- [ ] Add one interruption-safe early focus stop per week.
- [ ] Make stake entry explicitly opt-in with no preselected amount.
- [ ] Calculate maximum stake from the previous completed week’s earned-XP snapshot.
- [ ] Add a 24-hour stake undo.
- [ ] Display one live “XP at risk” meter on Today and the player card.
- [ ] Settle stakes once at the weekly close.
- [ ] Prohibit escalating stake suggestions and repeated fear notifications.
- [ ] Disable stakes and all negative XP for teens.
- [ ] Add a seven-day penalty and settlement appeal window.
- [ ] Store rule version, evidence, appeal, review status, and reversal linkage.

### Focus integrity

- [ ] Issue focus-session starts from the server.
- [ ] Add periodic heartbeats without requiring invasive surveillance.
- [ ] Validate elapsed time, duplicate sessions, impossible overlaps, and offline replay.
- [ ] Move direct browser follow-up state changes behind a validated API.
- [ ] Preserve offline queue behavior with idempotent replay.
- [ ] Add explicit retry, conflict, and rejected-event UI.

### Leagues

- [ ] Require explicit league opt-in offered no earlier than day three.
- [ ] Apply league and Calm-mode changes only at Monday regrouping.
- [ ] Require activity in the immediately preceding league week or a reconfirmation tap.
- [ ] Form leagues on Monday with a target of 30 and minimum of 10.
- [ ] Apply percentage promotion and demotion rules for undersized leagues.
- [ ] Give tied users a shared rank and promote every user tied at the cutoff.
- [ ] Demote zero-XP users first.
- [ ] Remove users after two empty weeks while allowing later re-entry.
- [ ] Remove deleted accounts immediately and recalculate rank.
- [ ] Close leagues Sunday at 9:00 p.m. Eastern and show the instant in local time.
- [ ] Preserve permanent titles and peaks while resetting weekly league score.
- [ ] Name the seasonal distinction “Season Summit.”
- [ ] Calculate Summit eligibility using the defined ceiling-based top-one-percent rule.
- [ ] Exclude teens from public and mixed-age leagues.
- [ ] State that leagues are NextMilestone’s design and not equivalent to Chess.com demotion rules.

### UI and accessibility

- [ ] Keep Climb as one sidebar destination.
- [ ] Put Leaderboard, Quests, Trophies, appeals, and history inside Climb tabs.
- [ ] A/B test the persistent player card against a compact status treatment.
- [ ] Show Week XP, Lifetime XP, Momentum cap, risk, settlement, and next action distinctly.
- [ ] Never use color alone for promotion, demotion, risk, or penalty state.
- [ ] Support reduced motion and screen-reader announcements.
- [ ] Make Calm mode prominent and non-stigmatizing.
- [ ] Keep all teen displays positive-only and private by default.

### Admin and operations

- [ ] Add a dedicated Climb review queue.
- [ ] Show XP event history, rule version, evidence, user appeal, and prior decisions.
- [ ] Require reason codes for corrections.
- [ ] Prevent support staff from directly editing ledger totals.
- [ ] Add anomaly detection for farming, collusion, replay, and impossible timing.
- [ ] Document response procedures for widespread erroneous penalties.
- [ ] Publish transparent user-facing rule summaries.

### Experiment

- [ ] Run separate XP-only, XP-plus-leagues, and XP-plus-leagues-plus-stakes adult arms.
- [ ] Keep Calm mode available in every arm.
- [ ] Measure the north star as people with meaningful actions on three or more days per week.
- [ ] Measure D30 retention for users enrolled during the first two weeks.
- [ ] Measure league opt-in, Calm-mode uptake, appeals, upheld appeals, deletion, push opt-out, and pressure reports.
- [ ] Set absolute and relative harm thresholds with minimum exposure.
- [ ] Add automatic arm shutdown controls.
- [ ] Exclude teens from the stakes and public-league experiment.
- [ ] Review outcomes by age band, plan, stage, activity baseline, and relevant accessibility segment without publishing small cells.

### Gate

- [ ] Ledger totals reproduce exactly from immutable XP events.
- [ ] Duplicate and replayed writes cannot create additional XP.
- [ ] Paid features cannot improve rank-relevant earning capacity.
- [ ] Momentum never exceeds 25 per day or 75 per week.
- [ ] Teen accounts cannot receive Momentum, penalties, stakes, Rust, or public league membership.
- [ ] Penalty reversals and appeals are auditable end to end.
- [ ] The Sunday settlement and local-time presentation pass timezone tests.
- [ ] No experiment arm exceeds approved harm thresholds.
- [ ] Accessibility review passes for all Climb states.
- [ ] Marketing and in-product copy match the implemented rules.

---

## Phase L1 · Free Learn foundation and group learning

- [ ] Phase L1 complete

**Goal:** Deliver trustworthy free learning, one equitable XP path, and safe group study before commerce.

**Depends on:** Phase 0. May run in parallel with E and F.

### Course and content data

- [ ] Add first-class courses, versions, sections, lessons, quizzes, projects, enrollments, and progress records.
- [ ] Support video, text, quizzes, and projects at launch.
- [ ] Keep live sessions out of launch scope.
- [ ] Distinguish platform-native courses from free outside links.
- [ ] Distinguish free, paid, certificate-bearing, and non-certificate courses.
- [ ] Store educator ownership, publication state, version, language, accessibility metadata, and content rating.
- [ ] Define immutable purchased-version identifiers for later commerce.
- [ ] Add course draft, review, publish, suspend, archive, and legal-takedown states.
- [ ] Preserve enrollment and progress history across course version changes.
- [ ] Define prerequisite, estimated effort, learning objective, and assessment metadata.
- [ ] Prevent users from writing authoritative progress or completion state directly.
- [ ] Replace or harden the current direct progress-write model (`supabase/migrations/20261024000600_learn.sql:116-133`).

### Access and entitlement

- [ ] Give every user one XP-eligible learning path.
- [ ] Keep access entitlement separate from XP eligibility.
- [ ] Ensure paid access never yields more Week XP than equivalent free effort.
- [ ] Add explicit entitlement checks for every course asset and assessment.
- [ ] Preserve current plan limits only where consistent with OD4.
- [ ] Update the current Free-path logic (`lib/billing/limits.ts:26-48`, `lib/learn/access.ts:1-43`) to the approved one-XP-path model.
- [ ] Add enrollment withdrawal, archive, deletion, and re-enrollment behavior.
- [ ] Add offline-access policy and entitlement checks where offline content is supported.

### Outside learning material

- [ ] Permit users to save eligible free educational links.
- [ ] Validate supported URL schemes and block unsafe redirects.
- [ ] Fetch minimal metadata without copying protected content.
- [ ] Show the source, destination domain, and external-link notice.
- [ ] Add dead-link and changed-access reporting.
- [ ] Distinguish linking from embedding.
- [ ] Obtain legal and platform-policy approval before embedding YouTube or another provider.
- [ ] Avoid awarding XP for raw watch time on third-party embeds.
- [ ] Award completion only through a separate learner action or assessment with plausibility controls.
- [ ] Add a rights-owner and provider takedown path.

### Group learning

- [ ] Support two-person, small-group, and large-group study spaces for free content.
- [ ] Define membership, invitation, join approval, removal, blocking, and reporting.
- [ ] Keep each learner’s progress private unless they explicitly share a selected status.
- [ ] Provide group goals without exposing detailed behavioral history by default.
- [ ] Provide lesson-scoped discussion and shared bookmarks.
- [ ] Define whether shared notes are personal, group-owned, or copied.
- [ ] Keep quiz answers and graded project submissions private by default.
- [ ] Prevent group membership from granting course access.
- [ ] Check every member’s entitlement before showing a paid-course group surface in later phases.
- [ ] Remove a member’s paid-course group access immediately when entitlement is refunded or revoked.
- [ ] Prohibit one-to-one adult-to-teen messaging through group features.
- [ ] Keep teen groups moderated and non-discoverable at launch.
- [ ] Prevent exact schedules, school information, or contact details from being displayed for teens.

### Learning evidence

- [ ] Record lesson completions, quiz attempts, project submissions, and assessor decisions as distinct evidence.
- [ ] Define valid completion for each content format.
- [ ] Require server-verifiable effort signals for XP.
- [ ] Prevent paid AI feedback from determining XP validity.
- [ ] Route extra eligible learning beyond the rank-relevant cap to Lifetime XP only.
- [ ] Add correction and appeal paths for failed completion checks.
- [ ] Add accessible alternatives for timed or media-based learning.

### Certificates foundation

- [ ] Define educator-issued and NextMilestone-issued certificate types.
- [ ] Prevent a course from issuing both certificate types for the same completion.
- [ ] Store issuer, course version, learner, completion basis, issue time, expiry, status, and revocation reason.
- [ ] Give every certificate a public verification identifier independent of recruiter access.
- [ ] Keep certificates private by default.
- [ ] Prevent certificates from affecting XP, rating, titles, leagues, votes, or organic candidate order.
- [ ] Mark identity verification, assessment verification, and course completion as separate claims.
- [ ] Do not call a certificate identity verified unless OD15 verification succeeded.
- [ ] Restrict teen certificates from recruiter visibility and public identity surfaces.

### UX and accessibility

- [ ] Add course browse, detail, enrollment, lesson, quiz, project, and progress interfaces.
- [ ] Add transcripts, captions, keyboard controls, text alternatives, and playback accessibility.
- [ ] Provide visible course version and update notes.
- [ ] Explain which path is XP eligible and why.
- [ ] Explain that buying a course cannot buy rank.
- [ ] Show outside links as third-party content.
- [ ] Add reporting for inaccessible, misleading, unsafe, or rights-infringing content.

### Gate

- [ ] Free courses support every launch format.
- [ ] One XP-eligible path is available on every plan.
- [ ] Paid access cannot increase Week XP earning capacity.
- [ ] Course progress is server-authoritative and replay-safe.
- [ ] Group membership cannot bypass entitlement checks.
- [ ] Third-party embedding has policy approval.
- [ ] Teen group safeguards prevent adult direct contact and sensitive-profile exposure.
- [ ] Certificates are private by default and do not affect rank.
- [ ] Accessibility review passes for video, text, quiz, and project flows.

---

## Phase F · Social network, Spaces, voting, and safety

- [ ] Phase F complete

**Goal:** Add useful professional sharing and pseudonymous discussion without turning popularity into career rank.

**Depends on:** Phase 0. May run in parallel with E and L1; G may start after F’s abuse-control Gate passes.

### Identity and graph

- [ ] Add profile follows, connection requests, accepted connections, blocks, mutes, and relationship history.
- [ ] Keep a profile identity separate from an optional Space handle.
- [ ] Prevent public linkage between a Space handle and profile identity.
- [ ] Preserve private internal linkage for moderation and abuse enforcement.
- [ ] Add handle uniqueness, changes, cooldowns, impersonation review, and reserved-name rules.
- [ ] Re-verify recruiter and organization affiliations.
- [ ] Implement best-effort exclusion of verified current and affiliated organizations.
- [ ] Clearly disclose residual linkage and re-identification risk.
- [ ] Add user-managed organization block lists.

### Posts and threads

- [ ] Add profile posts for learning, progress, and milestones.
- [ ] Add Space questions, discussions, replies, and thread structure.
- [ ] Add drafts, edits, revision history, deletion, archive, reports, and moderation state.
- [ ] Add attachments with malware, type, size, and rights controls.
- [ ] Add audience choices and safe defaults.
- [ ] Prevent private learning records from becoming posts automatically.
- [ ] Require explicit sharing for each progress or certificate post.
- [ ] Let users exclude social activity from recruiter view.
- [ ] Keep teen profile-identity posting off by default.
- [ ] Permit teen Space participation only under the approved pseudonymous and moderated policy.

### Voting

- [ ] Add upvotes and downvotes with public net counts.
- [ ] Keep voter identity nonpublic.
- [ ] Exclude votes and social popularity from candidate search, XP, rating, titles, certificates, and challenge eligibility.
- [ ] Do not create profile karma.
- [ ] Define score update, undo, deletion, moderation, and account-removal behavior.
- [ ] Add vote-rate limits and anomaly detection.
- [ ] Detect coordinated brigading, reciprocal voting, sockpuppets, and sudden cross-thread attacks.
- [ ] Define whether displayed scores are delayed or fuzzed without contradicting the owner’s public-count decision.
- [ ] Explain any temporary score delay in user-facing copy.
- [ ] Preserve an auditable authoritative count separate from the displayed count.

### Feed and discovery

- [ ] Define feed objectives that do not optimize solely for engagement time.
- [ ] Exclude private job-search behavior from social recommendations.
- [ ] Exclude teen behavioral profiles from personalized recommendations until approved.
- [ ] Add chronological and following-based controls.
- [ ] Label recommendations and explain the high-level reason for inclusion.
- [ ] Add frequency limits for repetitive creators, employers, and topics.
- [ ] Prevent paid educator promotion from influencing votes or people rank.
- [ ] Separate sponsored inventory from organic content.

### Messaging and safety

- [ ] Define whether direct messaging launches in F or remains deferred.
- [ ] Require block, report, mute, attachment, spam, and rate-limit controls before messaging launch.
- [ ] Block unsolicited adult-to-teen DMs.
- [ ] Block recruiter-to-teen messages regardless of mutual follows.
- [ ] Prevent group and educator tools from bypassing DM restrictions.
- [ ] Add link and scam warnings for suspicious messages.
- [ ] Add grooming, sexual exploitation, threat, and self-harm escalation procedures.
- [ ] Add moderator-visible relationship and report context with strict access controls.
- [ ] Notify users about enforcement without exposing reporters.

### Moderation

- [ ] Extend report targets beyond the current post, reply, and user model (`supabase/migrations/20261024001100_community.sql:165-187`).
- [ ] Add reports for profiles, Spaces, organizations, jobs, courses, projects, challenges, ads, and messages.
- [ ] Add standardized reasons, severity, evidence, assignments, deadlines, decisions, and appeals.
- [ ] Add repeat-offender and ban-evasion signals.
- [ ] Add organization and educator impersonation workflows.
- [ ] Add transparency metrics for reports, response time, appeal rate, reversals, and teen-safety incidents.
- [ ] Prohibit public shaming or automated announcement of penalties.

### Privacy and copy

- [ ] Describe profile identity, Space handle, voting visibility, recruiter visibility, and residual linkage separately.
- [ ] Use “pseudonymous and data-minimized, with residual linkage risk.”
- [ ] Explain that demotion may be inferable but is never announced.
- [ ] Explain that voters are not publicly identified.
- [ ] Explain that social activity never determines candidate rank.
- [ ] Add teen-facing explanations in age-appropriate language.
- [ ] Prevent public page metadata from leaking private or teen-only content.

### Gate

- [ ] No public endpoint links a Space handle to profile identity.
- [ ] Voting cannot alter XP, rating, titles, candidate rank, or certificate status.
- [ ] Brigading and sockpuppet simulations trigger documented controls.
- [ ] Blocking prevents profile, feed, message, and organization-contact paths.
- [ ] Teen accounts cannot receive unsolicited adult or recruiter messages.
- [ ] Teen posts cannot expose prohibited contact, school-schedule, or precise-location fields.
- [ ] Every social object has report, moderation, appeal, deletion, and retention behavior.
- [ ] Abuse staffing and response targets are proven at pilot load.
- [ ] G’s required identity and abuse controls are approved for use.

---

## Phase G · Organizations, jobs, sponsorship, and Apply with profile

- [ ] Phase G complete

**Goal:** Let verified employers post and promote relevant jobs and receive candidate-initiated applications without selling people’s rank.

**Depends on:** Phase 0 and F’s identity and abuse-control Gate. May run in parallel with H and L2.

### Organizations

- [ ] Add a first-class `organizations` model.
- [ ] Add organization membership, role, invitation, removal, and verified-domain state.
- [ ] Support company, recruiter, founder, and authorized representative roles.
- [ ] Add beneficial or responsible legal-entity details required for contracts and enforcement.
- [ ] Add domain, business, and representative verification.
- [ ] Add re-verification and suspicious-change review.
- [ ] Add organization block, suspension, termination, and appeal.
- [ ] Keep organizations separate from the existing application-tracker `companies` model (`supabase/migrations/20250101000000_initial_schema.sql:62-78`).

### Native jobs

- [ ] Add native job postings owned by verified organizations.
- [ ] Keep native jobs distinct from external imported job inventory (`supabase/migrations/20250101000017_job_search.sql:46-78`).
- [ ] Require title, description, employment type, location, remote status, work jurisdictions, pay period, currency, pay range, and benefits summary.
- [ ] Apply the native pay-range rule to every jurisdiction, not only states that mandate it.
- [ ] Add draft, review, publish, pause, close, expire, remove, and appeal states.
- [ ] Add posting edit history and applicant-visible material-change notices.
- [ ] Add duplicate, scam, discriminatory, misleading, and prohibited-work checks.
- [ ] Add application route and accessibility metadata.
- [ ] Define teen-eligibility fields but keep them non-operative until the teen hiring workflow is approved.

### Organic discovery

- [ ] Define the relevance floor and organic job-ranking factors.
- [ ] Exclude employer payment from organic ranking.
- [ ] Exclude social votes and popularity from organic ranking.
- [ ] Keep organic results reproducible and auditable.
- [ ] Give users filters and sorting controls.
- [ ] Label imported and native jobs distinctly.
- [ ] Add stale, closed, deleted, and expired handling.
- [ ] Add job-reporting and employer-appeal flows.

### Sponsored job slots

- [ ] Add separately labeled sponsored slots.
- [ ] Limit sponsored inventory to no more than one slot per ten results.
- [ ] Require every sponsored job to meet the same relevance floor as organic jobs.
- [ ] Never reorder organic results to make room for a sponsor.
- [ ] Exclude sponsorship from people rank and candidate search.
- [ ] Record sponsor, campaign, creative, placement, relevance decision, impression, click, and billing event.
- [ ] Add frequency and repetition controls.
- [ ] Add advertiser and job-policy review.
- [ ] Use “Sponsored” or equally unambiguous disclosure.

### Apply with profile

- [ ] Make application initiation a candidate action.
- [ ] Show the exact profile fields, certificates, progress, and attachments that will be shared.
- [ ] Default to the minimum approved field set.
- [ ] Keep social posts and Space activity excluded by default.
- [ ] Require explicit confirmation for each application.
- [ ] Record the legal entity receiving the application.
- [ ] Record shared fields, versions, consent time, withdrawal status, and delivery state.
- [ ] Give candidates a visible application and sharing history.
- [ ] Support correction before submission.
- [ ] Define post-submission correction, withdrawal, deletion, and employer notification behavior.
- [ ] Block Apply with profile for teens.
- [ ] Allow external application links for teens only if the Phase 0 owner decision approves them.
- [ ] Warn that NextMilestone has not verified an external job’s eligibility for a minor.

### Billing

- [ ] Add employer plans for native postings and sponsored slots.
- [ ] Keep recruiter search and ATS export out of G unless J access is enabled.
- [ ] Add invoices, tax treatment, refunds, disputes, credits, cancellation, and account closure.
- [ ] Prevent billing state from changing organic relevance or people rank.
- [ ] Add billing audit logs and privileged-change review.
- [ ] Define when a removed or fraudulent job receives a refund.

### Legal and candidate rights

- [ ] Update Terms and Privacy Policy before the first employer pilot.
- [ ] Require employer commitments on lawful jobs, pay disclosure, discrimination, accommodations, record handling, and deletion.
- [ ] Prohibit marketing the service as background checking, screening, or vetting.
- [ ] Add accessible accommodation and support paths.
- [ ] Add candidate explanations for material automated recommendations.
- [ ] Add correction and appeal flows.
- [ ] Log versioned decision inputs where legally required.
- [ ] Define employer access retention and deletion duties.
- [ ] Apply verified-current-employer and affiliated-organization exclusions with residual-risk disclosure.

### Gate

- [ ] Every organization in the pilot has verified identity, domain, and authority.
- [ ] Every native job contains the required pay, benefits, jurisdiction, and entity fields.
- [ ] Sponsored placements meet the one-per-ten limit and never reorder organic results.
- [ ] Payment cannot influence any person rank or organic candidate position.
- [ ] Apply with profile shares only the candidate-confirmed snapshot.
- [ ] Teen accounts cannot use Apply with profile or be exposed to an employer.
- [ ] Job reports, removal, refund, and employer appeal work end to end.
- [ ] Updated Terms and Privacy Policy are live before employer access.
- [ ] Counsel has approved the implemented employer and application workflow.

---

## Phase L2 · Educators, paid courses, certificates, and payouts

- [ ] Phase L2 complete

**Goal:** Add a rights-respecting creator marketplace with entitlement-safe group study and auditable payments.

**Depends on:** Phase 0, L1, and F safety controls. May run in parallel with G and H.

### Creator eligibility

- [ ] Restrict creator onboarding, uploads, monetization, and payouts to the United States at launch.
- [ ] Require creators to be at least 18 at launch.
- [ ] Verify creator identity and payout eligibility.
- [ ] Collect tax information through an approved provider.
- [ ] Add creator terms, content license, warranties, prohibited content, termination, and appeal.
- [ ] Let any eligible adult creator upload drafts.
- [ ] Separate upload eligibility from monetization eligibility.
- [ ] Define monetization thresholds and measurement windows explicitly.
- [ ] Prevent subscribers, likes, or votes from directly generating payment.
- [ ] Prevent payment or promotion from increasing creator XP, rating, title, league position, or candidate rank.

### Course authoring

- [ ] Add course author, coauthor, editor, reviewer, and organization roles.
- [ ] Support video, text, quizzes, and projects.
- [ ] Add draft autosave, version history, preview, review, publish, unpublish, archive, and takedown.
- [ ] Add captions, transcripts, alt text, accessible assessments, and downloadable resources.
- [ ] Add declared prerequisites, outcomes, duration, update date, language, and certificate type.
- [ ] Add content-origin and rights declarations.
- [ ] Add plagiarism, malware, prohibited-content, and copyright-reporting controls.
- [ ] Add educator analytics without exposing individual learner behavior beyond the approved scope.
- [ ] Prevent educators from privately messaging teen learners.

### Video delivery

- [ ] Select a video hosting and streaming provider after cost, security, accessibility, privacy, and deletion review.
- [ ] Implement upload, transcode, playback, signed access, captions, thumbnails, and deletion.
- [ ] Track stored and delivered minutes for cost controls.
- [ ] Add upload limits, quota warnings, abusive-download protection, and failure recovery.
- [ ] Prevent playback analytics from becoming rank-bearing XP evidence by themselves.
- [ ] Keep raw viewing telemetry out of educator exports.
- [ ] Add geographic, device, and concurrency controls only where proportionate and disclosed.

### Paid course commerce

- [ ] Add course price, currency, tax class, sale state, and version.
- [ ] Define “lifetime access” as access to the purchased version while NextMilestone supports it.
- [ ] Preserve purchased-version access after later course updates.
- [ ] Define the upgrade path to later versions.
- [ ] Define refund rights for removal, material incompleteness, duplicate purchase, technical failure, and policy violation.
- [ ] Show refund terms before purchase.
- [ ] Add receipts, purchase history, refund status, chargeback state, and support.
- [ ] Prevent a refund or chargeback from leaving paid-course group access active.
- [ ] Prevent buying a course or certificate from increasing Week XP, rating, titles, leagues, or candidate position.
- [ ] Block direct teen purchases unless a separately approved guardian purchase system exists.

### Revenue share

- [ ] Implement the approved educator-attributed and platform-attributed sale channels.
- [ ] Apply 97% of Net Course Revenue for educator-referred sales and 37% for NextMilestone-referred sales, only after “net” is defined.
- [ ] Show attribution and expected share before the sale becomes final.
- [ ] Define coupon, referral, organic, paid promotion, refund, chargeback, tax, and fee treatment.
- [ ] Add immutable revenue-ledger entries.
- [ ] Add payout holds, minimums, schedules, reserves, adjustments, and statements.
- [ ] Require dual approval for manual payout corrections.
- [ ] Prevent self-referral and related-party attribution fraud.

### Creator payouts

- [ ] Confirm processor approval for creator marketplace payouts.
- [ ] Keep course-sale and advertising payouts separate from challenge prizes.
- [ ] Complete KYC, sanctions, tax, and bank-account verification.
- [ ] Add failed-payout, returned-payout, account-change, and fraud-review flows.
- [ ] Add payout statements and tax-document delivery.
- [ ] Define reserves and negative-balance recovery.
- [ ] Add creator support and formal payout appeals.
- [ ] Block every under-18 payout path.

### Paid group learning

- [ ] Verify active entitlement for every paid-course group member.
- [ ] Recheck entitlement on join, lesson access, synchronized activity, refund, chargeback, revocation, and account deletion.
- [ ] Never stream or copy paid content through another member’s entitlement.
- [ ] Keep progress, quiz answers, and graded work individual.
- [ ] Define shared notes and discussion ownership.
- [ ] Prevent copying protected course content into unrestricted Spaces.
- [ ] Show a clear message when a member loses entitlement.
- [ ] Preserve discussion records only according to the approved retention policy.
- [ ] Prohibit paid-course groups from bypassing teen purchase restrictions.

### Certificates

- [ ] Let the educator or NextMilestone issue the certificate, never both for the same completion.
- [ ] Define assessment and integrity requirements before issuance.
- [ ] Add identity-verified certificate status only after government-ID verification.
- [ ] Use a vetted verification provider.
- [ ] Retain the verification result, provider, method, and timestamp rather than reusable ID images.
- [ ] Add certificate verification, expiry, suspension, revocation, correction, and appeal.
- [ ] Show issuer, evidence type, course version, and identity-verification status separately.
- [ ] Keep certificates private until the learner shares them.
- [ ] Prevent certificates from becoming challenge rating or employment-selection scores.
- [ ] Exclude teen certificates from recruiter and public identity surfaces.

### Copyright and DMCA

- [ ] Register a DMCA designated agent.
- [ ] Publish a compliant takedown and counter-notice process.
- [ ] Adopt and reasonably implement a repeat-infringer policy.
- [ ] Add rights-owner contact, evidence, notice, counter-notice, restoration, and termination records.
- [ ] Train staff on takedown handling and misrepresentation risks.
- [ ] Define content preservation during disputes.
- [ ] Add a process for educator departure, death, incapacity, or rights loss.
- [ ] Review the existing user-content license before course launch (`app/terms/page.tsx:82-90`).

### Gate

- [ ] Every monetized creator is 18+, US-based, verified, and payout eligible.
- [ ] Paid access survives ordinary course updates and obeys purchased-version rules.
- [ ] Refund, chargeback, entitlement removal, and group-access removal work end to end.
- [ ] Revenue attribution and payout totals reproduce from immutable ledger records.
- [ ] No course purchase, certificate, referral, or promotion can improve person rank.
- [ ] Identity verification does not expose raw ID documents to ordinary NextMilestone systems.
- [ ] DMCA registration, takedown, counter-notice, and repeat-infringer processes are operational.
- [ ] Accessibility, privacy, commerce, and creator terms pass review.
- [ ] Minor accounts cannot publish, monetize, buy, or receive payouts.

---

## Phase H · Unrated challenges and competitions

- [ ] Phase H complete

**Goal:** Launch transparent, appealable challenges without yet turning results into a universal rating.

**Depends on:** Phase 0 and F safety controls. Hiring challenges also depend on G organizations. May run in parallel with G and L2.

### Challenge model

- [ ] Add platform-hosted, company-hosted, and eligible user-hosted challenge records.
- [ ] Require the host to choose public competition or hiring challenge before publication.
- [ ] Lock the challenge type after the first entrant.
- [ ] Identify the responsible legal entity on every hiring challenge.
- [ ] Add rules, eligibility, jurisdictions, timeline, rubric, judges, rewards, intellectual-property terms, and dispute process.
- [ ] Add draft, review, publish, entry-open, entry-closed, judging, disputed, settled, canceled, and archived states.
- [ ] Version the rules and preserve entrant-visible snapshots.
- [ ] Keep user-hosted challenges unrated at launch.

### Rewards and prizes

- [ ] Let the host choose rewards subject to platform policy.
- [ ] Require guaranteed meaningful compensation before any IP assignment or exclusive license.
- [ ] Permit no-reward challenges only for clearly labeled community or learning purposes.
- [ ] Require official rules for every cash-prize challenge.
- [ ] Require the host to pay cash prizes directly to winners.
- [ ] Keep challenge prize funds out of Stripe and NextMilestone payout flows.
- [ ] Process only the platform hosting fee through the approved payments system.
- [ ] Require proof of prize capacity or funding before publication.
- [ ] Add winner confirmation, host-payment evidence, dispute, cancellation, and nonpayment enforcement.
- [ ] Block teens from cash-prize challenges.

### Entry and consent

- [ ] Show challenge type, host entity, rules, rubric, reward, IP terms, and sharing terms before entry.
- [ ] Require itemized consent for result, challenge rank, submission, and selected profile fields.
- [ ] Default shared profile fields to name, headline, and Challenge Rating only when rating later exists.
- [ ] Keep contact details opt-in.
- [ ] Keep anti-cheat telemetry private from the host.
- [ ] Share only the platform’s anti-cheat finding where permitted.
- [ ] Record every consent item and version.
- [ ] Let entrants download their entry agreement.
- [ ] Define withdrawal deadlines and consequences.
- [ ] Block teen entry into cash-prize, hiring, and rated challenges.
- [ ] Permit teen no-cash learning challenges only after the approved safety configuration exists.

### Submissions and judging

- [ ] Add secure submission, versioning, deadline, receipt, and withdrawal.
- [ ] Add supported artifact types and malware scanning.
- [ ] Add rubric-based judging and judge conflict disclosures.
- [ ] Add blind judging where appropriate.
- [ ] Add scoring audit logs and reasoned decisions.
- [ ] Add tie and unresponsive-judge rules.
- [ ] Add correction, appeal, and independent review.
- [ ] Add accommodation requests and adjusted assessment paths.
- [ ] Prevent social votes from determining hiring-challenge outcomes unless counsel and the rubric explicitly approve a nonselection use.

### Anti-cheat and integrity

- [ ] Define allowed tools, collaboration, AI assistance, external resources, and disclosure requirements.
- [ ] Collect only proportionate integrity telemetry.
- [ ] Prohibit covert webcam, biometric, or invasive device surveillance without separate approval.
- [ ] Add plagiarism, duplicate-submission, collusion, timing, and impossible-pattern checks.
- [ ] Add human review before material disqualification.
- [ ] Explain findings and provide correction and appeal.
- [ ] Version anti-cheat rules and models.
- [ ] Monitor false positives and subgroup impact.
- [ ] Separate anti-cheat evidence from host-accessible data.

### Host access and retention

- [ ] Limit host access to the entry-screen authorized data.
- [ ] Give the platform twelve months of default access to exported result records.
- [ ] Define the host’s permitted retention separately.
- [ ] Send deletion, withdrawal, and current-employer-block updates through the host API or webhook.
- [ ] Require host confirmation of propagated deletion.
- [ ] Log every view and export.
- [ ] Prevent hosts from searching nonentrants through challenge tools.
- [ ] Add host suspension and challenge shutdown controls.

### Hiring challenge compliance

- [ ] Require accommodations, validation evidence, impact monitoring, notices, explanations, correction, and appeals.
- [ ] Prohibit a challenge score from being the sole route to a job.
- [ ] Require an alternative route or equivalent accommodation where applicable.
- [ ] Add employer recordkeeping and retention commitments.
- [ ] Preserve the exact rules, rubric, version, inputs, and outcome for audit.
- [ ] Review each hiring challenge as an employment-selection tool before publication.
- [ ] Prevent claims that challenge results measure general employability.

### Gate

- [ ] Challenge type cannot change after the first entrant.
- [ ] Every entrant receives the exact rules and sharing snapshot accepted.
- [ ] Hosts cannot access anti-cheat telemetry.
- [ ] Cash rewards are host-paid and outside the platform payment rail.
- [ ] Every prize challenge has approved rules and proof of host capacity.
- [ ] Teen accounts cannot enter cash-prize or hiring challenges.
- [ ] Appeals can reverse a result without destroying the original audit record.
- [ ] Accommodation and alternative-route workflows pass testing.
- [ ] No H result changes Challenge Rating.
- [ ] Counsel approves the implemented public-competition and hiring-challenge flows.

---

## Phase L3 · Contextual advertising and creator ad revenue

- [ ] Phase L3 complete

**Goal:** Fund free educator content with transparent, contextual advertising that cannot buy rank or exploit learner behavior.

**Depends on:** Phase 0, L2, and F safety controls.

### Advertising scope

- [ ] Sell ads directly rather than integrating third-party ad trackers.
- [ ] Permit ads only on eligible free educator content.
- [ ] Prohibit ads on paid courses.
- [ ] Prohibit retargeting, audience uploads, cross-site tracking, and lookalike audiences.
- [ ] Use page or lesson context rather than user behavioral profiles.
- [ ] Exclude job-search behavior, applications, employer interactions, assessment results, age, health, disability, and other sensitive signals.
- [ ] Define prohibited advertisers, products, claims, landing pages, and creative.
- [ ] Add frequency, repetition, placement, and interruption limits.
- [ ] Keep ads out of quizzes, high-stakes assessments, payment screens, appeals, crisis content, and private messages.
- [ ] Block teen ads at initial launch unless the Phase 0 owner decision and counsel approve a narrower policy.

### Ad product and delivery

- [ ] Add advertisers, campaigns, creatives, contextual categories, placements, orders, budgets, billing, and review states.
- [ ] Add human review before first delivery for each advertiser and campaign.
- [ ] Label every ad clearly and persistently.
- [ ] Keep sponsored course placement separate from organic course order.
- [ ] Require promoted courses to meet the same safety and quality floor as organic courses.
- [ ] Prevent paid promotion from altering votes, XP, rating, titles, certificates, league position, or candidate order.
- [ ] Record the reason a contextual ad was eligible without recording a learner profile.
- [ ] Add user reporting and advertiser appeal.
- [ ] Add campaign pause and global ad kill switches.
- [ ] Minimize impression and click logs and define their retention.

### Creator ad revenue

- [ ] Set ad-monetization eligibility: 1,000 valid followers, 4,000 qualified watch hours in 12 months, 3 publications or updates in 90 days, and passed review (versioned).
- [ ] Define eligible views, watch time, ad impressions, geography, content, and policy state.
- [ ] Pay educators 55% of Net Creator Ad Revenue, allocated by valid qualified watch time; never per like or follower.
- [ ] Keep advertising revenue separate from course-sale revenue.
- [ ] Calculate creator earnings from valid monetized activity rather than likes or subscribers.
- [ ] Treat subscribers only as an eligibility input where approved.
- [ ] Delay final earnings until the invalid-traffic review window closes.
- [ ] Provide estimated and finalized earnings separately.
- [ ] Add clawback, reserve, correction, appeal, and statement processes.
- [ ] Prohibit creators from incentivizing viewing, clicking, liking, subscribing, or commenting.

### Invalid traffic

- [ ] Define invalid impression, view, watch-time, click, and referral patterns.
- [ ] Detect self-viewing, loops, bots, device farms, proxy clusters, hidden playback, background playback, and related-party traffic.
- [ ] Separate learning completion evidence from creator-payment evidence.
- [ ] Prevent XP events from automatically validating monetized watch time.
- [ ] Prevent monetized watch time from automatically validating XP.
- [ ] Add progressive holds before account termination.
- [ ] Require human review for material clawbacks or monetization suspension.
- [ ] Provide a reasoned notice and appeal.
- [ ] Preserve evidence under restricted access.
- [ ] Monitor false positives and disparate effects.

### Privacy and GPC

- [ ] Map every advertising data flow and recipient.
- [ ] Update the Privacy Policy’s current no-advertising-cookie and no-third-party-tracker language precisely (`app/privacy/page.tsx:52-60`).
- [ ] Document why directly sold contextual delivery does or does not constitute sale or sharing under applicable law.
- [ ] Define GPC behavior for every ad and analytics request.
- [ ] Prevent consent dark patterns.
- [ ] Prevent advertising identifiers from being joined to job-search, candidate, challenge, course-assessment, or teen data.
- [ ] Add deletion and retention behavior for advertising logs.
- [ ] Complete a data-protection assessment before launch.
- [ ] Complete a separate minor assessment before showing any ad to a known teen.

### Disclosures and endorsement

- [ ] Add clear ad disclosures consistent with FTC expectations.
- [ ] Require creators to disclose paid endorsements, free products, affiliate relationships, and sponsor control.
- [ ] Add disclosure fields and visible placement requirements.
- [ ] Prohibit burying disclosure only in a profile or description.
- [ ] Add enforcement for missing or misleading disclosures.
- [ ] Distinguish platform-sold ads from creator-sponsored content.
- [ ] Add advertiser substantiation requirements for objective claims.
- [ ] Add learner-facing explanations of contextual selection.

### Gate

- [ ] No third-party ad tracker, retargeting pixel, audience upload, or behavioral profile exists in production traffic.
- [ ] No ad appears on a paid course.
- [ ] Payment cannot alter organic course order or any person rank.
- [ ] XP and creator-payment evidence are independently validated.
- [ ] Invalid-traffic tests catch approved fraud scenarios without automatic irreversible punishment.
- [ ] GPC behavior and privacy disclosures match actual network and data flows.
- [ ] FTC-style ad and endorsement disclosures pass legal and usability review.
- [ ] Teen accounts receive no ads unless the specific teen-ad Gate has counsel approval and passed its assessment.
- [ ] Creator earnings reproduce exactly from valid finalized ledger events.

---

## Phase I · Certified Challenge Rating and permanent titles

- [ ] Phase I complete

**Goal:** Validate a narrow, chess-inspired Challenge Rating in shadow mode before anyone uses it for hiring.

**Depends on:** Phase H and Phase 0 legal, validation, and appeals foundations.

### Certification standard

- [ ] Define the platform certification standard for rated challenges.
- [ ] Require problem review, rubric review, anti-cheat standard, difficulty calibration, fixed rating weight, accommodations, and auditability.
- [ ] Prevent hosts from purchasing rated status.
- [ ] Require independent platform approval for every rated event.
- [ ] Keep user-hosted challenges unrated at launch.
- [ ] Publish the distinction between rated and unrated events.
- [ ] Add domain tags and evidence next to every rating.
- [ ] Prohibit calling the rating employability, talent, intelligence, or overall candidate quality.

### Rating model

- [ ] Name the score “NextMilestone Challenge Rating.”
- [ ] Use Glicko-2 or the final validated implementation.
- [ ] Store rating, rating deviation, volatility, event contribution, model version, and correction links.
- [ ] Use rating deviation for provisional status and inactivity uncertainty.
- [ ] Define provisional-entry requirements.
- [ ] Define inactivity behavior without punitive silent decay of permanent achievements.
- [ ] Define event weighting before registration opens.
- [ ] Define ties, incomplete events, withdrawals, disqualifications, canceled events, and corrected results.
- [ ] Make ratings recomputable from certified event history.
- [ ] Prevent mocks, courses, certificates, social votes, posts, XP, purchases, and employer payment from affecting rating.
- [ ] Exclude teens from rated events and rating display.

### Titles and peaks

- [ ] Define permanent titles from peak rating plus a minimum number of certified events.
- [ ] Store and display peak rating separately from current rating.
- [ ] Define provisional and inactive title presentation.
- [ ] Prevent payment, subscription, certificate purchase, or host spend from altering title eligibility.
- [ ] Add title correction and revocation rules for fraud or erroneous events.
- [ ] Preserve an audit trail for every title grant and correction.

### Shadow mode

- [ ] Compute ratings without exposing them to users, hosts, recruiters, or search.
- [ ] Compare predicted and observed event performance.
- [ ] Measure stability, reliability, calibration, gaming, and subgroup impact.
- [ ] Review challenge comparability within each domain tag.
- [ ] Test sensitivity to participation volume and repeated hosts.
- [ ] Review anti-cheat false positives before rating inclusion.
- [ ] Review accommodations for equivalence.
- [ ] Add independent methodology review.
- [ ] Predefine acceptable error, stability, impact, and appeal thresholds.
- [ ] Keep shadow ratings out of APIs, exports, analytics available to employers, and notifications.

### Candidate rights

- [ ] Draft the eventual rating explanation before public release.
- [ ] Show event contributions, uncertainty, provisional state, inactivity effect, and correction status.
- [ ] Add result correction, anti-cheat appeal, event appeal, and rating appeal.
- [ ] Define deadlines and independent escalation.
- [ ] Prevent challenged data from silently continuing to influence employer decisions.
- [ ] Define what happens when a certified event is later invalidated.
- [ ] Add downloadable rating history.

### Gate

- [ ] Every rating contribution comes from a platform-certified comparable event.
- [ ] Hosts cannot pay for certification or rating weight.
- [ ] Shadow ratings are inaccessible to employers and participants.
- [ ] Rating histories reproduce from certified event records.
- [ ] Reliability, stability, impact, accommodation, and false-positive thresholds are met.
- [ ] Appeals and event invalidation correctly recompute downstream ratings and titles.
- [ ] Teen accounts cannot enter rated events or receive a rating.
- [ ] Independent methodology and counsel reviews approve a limited public pilot.
- [ ] No product copy describes Challenge Rating as employability.

---

## Phase J · Candidate search, recruiter seats, and ATS export

- [ ] Phase J complete

**Goal:** Let verified employers find opted-in adults using transparent, relevant evidence without selling rank or exporting unauthorized data.

**Depends on:** Phase G, Phase F, and Phase I’s public-pilot Gate.

### Recruiter accounts

- [ ] Add paid recruiter seats under verified organizations.
- [ ] Require named users rather than shared credentials.
- [ ] Add role, invitation, removal, seat transfer, MFA, and re-verification.
- [ ] Add employer-purpose attestation and acceptable-use acceptance.
- [ ] Add recruiter suspension, organization suspension, and appeal.
- [ ] Log searches, profile views, saves, messages, exports, and administrative actions.
- [ ] Detect scraping, bulk harvesting, credential sharing, and anomalous access.

### Candidate eligibility and consent

- [ ] Require the adult user to opt into recruiter visibility.
- [ ] Exclude teens categorically.
- [ ] Let users choose which progress, certificates, challenge results, posts, and fields recruiters may see.
- [ ] Keep Space activity, votes, downvotes, social popularity, and private learning records excluded.
- [ ] Keep current-employer and affiliated-organization exclusions enabled by default.
- [ ] Add user block lists.
- [ ] Explain residual organizational-linkage risk.
- [ ] Let users leave recruiter search without leaving NextMilestone.
- [ ] Apply visibility changes promptly to future access.
- [ ] Show users an access and export history.

### Search and rank

- [ ] Define organic candidate-search objectives and factors.
- [ ] Exclude payment, subscription, sponsorship, ad activity, social votes, popularity, and course spend.
- [ ] Exclude protected-class proxies where prohibited or unjustified.
- [ ] Prevent Challenge Rating from being the sole search or selection route.
- [ ] Show rating domain, uncertainty, evidence, and provisional status where rating is visible.
- [ ] Give recruiters filters without creating unsupported “quality” or “employability” scores.
- [ ] Add candidate-facing explanations of material ranking factors.
- [ ] Add correction and appeal.
- [ ] Audit search results for stability, relevance, gaming, and adverse impact.
- [ ] Keep paid recruiter features from reordering people.

### Recruiter contact

- [ ] Permit contact only under the adult user’s chosen settings.
- [ ] Block recruiter contact for teens.
- [ ] Add rate limits, spam controls, templates, reporting, blocking, and organization-level enforcement.
- [ ] Prevent bypass through Space handles, groups, educators, or challenge tools.
- [ ] Show the recruiter’s verified organization and purpose.
- [ ] Add candidate-controlled email and contact-detail sharing.
- [ ] Log every contact attempt.
- [ ] Add suppression for current and affiliated organizations.

### ATS export

- [ ] Make ATS export a paid employer feature.
- [ ] Export only candidate-authorized data.
- [ ] Show the exact export snapshot to the candidate.
- [ ] Log exporter, organization, destination, fields, purpose, and timestamp.
- [ ] Display the export event in the candidate’s history.
- [ ] Add withdrawal, deletion, correction, and current-employer-block webhooks.
- [ ] Require the recipient to acknowledge each propagated change.
- [ ] Require deletion within 30 days unless law requires retention.
- [ ] Record any asserted legal-retention exception and its basis.
- [ ] Prevent exports of Space activity, votes, anti-cheat telemetry, private notes, or teen data.
- [ ] Disable bulk export until abuse, retention, and deletion controls have been demonstrated.
- [ ] Add destination verification and webhook signing.
- [ ] Set default platform access to exported result records at twelve months.
- [ ] Define what remains after platform access expires.

### Hiring-law controls

- [ ] Require employers to use the product only for lawful employment purposes.
- [ ] Provide candidate notices, explanations, correction, and appeal.
- [ ] Preserve versioned search and decision inputs where required.
- [ ] Support accommodation and alternative review.
- [ ] Monitor outcome and exposure patterns for adverse impact.
- [ ] Prohibit sole reliance on Challenge Rating or automated candidate order.
- [ ] Prohibit marketing language such as screening, vetted, background checked, or guaranteed fit.
- [ ] Add employer training and in-product reminders.
- [ ] Implement legally required audit and notice controls before relevant jurisdictions are enabled.
- [ ] Reassess FCRA status against the final data, marketing, and employer workflows.

### Gate

- [ ] Every recruiter belongs to a currently verified organization and uses MFA.
- [ ] Every searchable candidate is an opted-in adult.
- [ ] Payment cannot influence organic candidate order.
- [ ] Social votes, Space activity, and course purchases cannot influence candidate order.
- [ ] Recruiters cannot discover or contact teens.
- [ ] Every profile view, message, save, and export is logged and visible as approved.
- [ ] ATS withdrawal and deletion propagation passes end-to-end testing.
- [ ] Export recipients acknowledge the contractual 30-day deletion duty.
- [ ] Search explanations, corrections, appeals, accommodations, and impact monitoring are operational.
- [ ] Counsel approves the final FCRA, employment, privacy, and jurisdiction launch posture.

---

## Phase K · Integrated launch and scale gate

- [ ] Phase K complete

**Goal:** Prove that the combined product is coherent, safe, supportable, and accurately represented before broad launch.

**Depends on:** Every phase included in the intended launch bundle.

### Integrated journeys

- [ ] Test new adult onboarding through learning, Climb, social sharing, job discovery, application, challenge, certificate, and recruiter visibility.
- [ ] Test teen onboarding through allowed learning and pseudonymous community paths.
- [ ] Test the eighteenth-birthday transition.
- [ ] Test creator onboarding through upload, sale, refund, ad revenue, payout, suspension, and appeal.
- [ ] Test employer onboarding through verification, job post, sponsorship, application receipt, challenge hosting, recruiter search, export, and deletion.
- [ ] Test account deletion across every subsystem.
- [ ] Test current-employer blocking across posts, applications, challenges, search, contact, and exports.
- [ ] Test identity changes, organization changes, compromised accounts, and revoked verification.
- [ ] Test accessibility across every critical journey.

### Rank-integrity audit

- [ ] Verify that payment cannot increase XP, rating, title, league position, votes, certificates, or candidate rank.
- [ ] Verify that course price and certificate purchase do not affect learning XP.
- [ ] Verify that sponsored jobs never reorder organic jobs.
- [ ] Verify that educator promotion never affects votes or people rank.
- [ ] Verify that hosts cannot buy rated status or rating weight.
- [ ] Verify that Pro features have rank-equivalent free earning paths.
- [ ] Verify that corrections and appeals recompute every affected downstream state.
- [ ] Publish the plain-language rank-integrity policy.

### Privacy and teen audit

- [ ] Verify that private job-search activity never appears in social or advertising products.
- [ ] Verify that Space handles cannot be publicly resolved to profiles.
- [ ] Verify that teen accounts cannot enter employer, creator-commerce, cash-prize, rating, public-league, or adult-DM paths.
- [ ] Verify that turning 18 does not automatically publish teen history.
- [ ] Verify that recruiter visibility and ATS export require explicit adult choices.
- [ ] Verify that contextual advertising does not use behavioral, employment, assessment, or sensitive data.
- [ ] Verify deletion propagation to hosts, employers, ATS recipients, processors, and backups.
- [ ] Complete final privacy and minor-design assessments.

### Operational readiness

- [ ] Staff moderation, appeals, privacy, employer, creator, payout, security, and minor-safety queues.
- [ ] Run tabletop exercises for employer fraud, grooming, prize nonpayment, mass XP error, rating error, creator fraud, copyright takedown, and data breach.
- [ ] Validate kill switches for every high-risk subsystem.
- [ ] Publish internal escalation directories and after-hours coverage.
- [ ] Validate payout, refund, chargeback, tax, and reconciliation processes.
- [ ] Validate advertiser, employer, creator, and challenge-host suspension processes.
- [ ] Validate evidence access and legal-hold controls.
- [ ] Establish launch monitoring and incident thresholds.

### Metrics

- [ ] Track the member north star: people with meaningful actions on three or more days per week.
- [ ] Track employer outcomes separately, including qualified applications, response, interview, and reported hire.
- [ ] Track D30 retention by relevant cohort.
- [ ] Track Calm mode, league opt-in, stake use, appeals, upheld appeals, deletion, and push opt-out.
- [ ] Track course enrollment, legitimate completion, project completion, group participation, refunds, and accessibility failures.
- [ ] Track creator activation, course quality, valid revenue, invalid traffic, payout failures, and disputes.
- [ ] Track job quality, application completion, employer response, scams, reports, and sponsored-slot relevance.
- [ ] Track challenge completion, accommodation, appeals, false-positive integrity findings, prize disputes, and host nonpayment.
- [ ] Track rating stability, uncertainty, correction rate, subgroup outcomes, and employer overreliance.
- [ ] Track recruiter views, messages, blocks, exports, withdrawal propagation, and deletion compliance.
- [ ] Track teen reports, adult-contact attempts, blocked flows, age appeals, and safety response time.
- [ ] Apply privacy thresholds and suppress small reporting cells.

### Launch experiments and stop rules

- [ ] Define minimum exposure before interpreting relative harm metrics.
- [ ] Define absolute and relative stop thresholds for deletion, opt-out, pressure reports, harassment, teen incidents, appeals, refunds, fraud, and complaints.
- [ ] Automate alerts for breached thresholds.
- [ ] Give product, trust and safety, privacy, and security independent stop authority.
- [ ] Document restart criteria after a stopped rollout.
- [ ] Prevent revenue targets from overriding a safety or legal stop.
- [ ] Review experiments for interaction effects across Climb, social, courses, ads, challenges, and hiring.

### Marketing and copy

- [ ] Remove claims that NextMilestone is not acting as a recruiter where no longer accurate.
- [ ] Remove claims that match information is never shared with employers where no longer accurate.
- [ ] Update no-advertising language for contextual ads.
- [ ] Avoid “screened,” “vetted,” “background checked,” “employability,” and guaranteed-outcome claims.
- [ ] Explain sponsored job slots without implying paid organic priority.
- [ ] Explain Challenge Rating as narrow, domain-tagged evidence from certified events.
- [ ] Explain certificate issuer, evidence, identity verification, and revocation.
- [ ] Explain lifetime course access and its legal-removal and platform-support limits.
- [ ] Explain teen restrictions before a teen attempts a blocked feature.
- [ ] Explain that social popularity and downvotes do not affect hiring rank.
- [ ] Verify every public promise against production behavior.

### Final Gate

- [ ] All included phase Gates are checked.
- [ ] No unresolved critical security, privacy, accessibility, integrity, legal, or teen-safety finding remains.
- [ ] Counsel’s final review matches the production data flows and copy.
- [ ] Rank-integrity tests show no paid route to person rank.
- [ ] Teen-isolation tests show no prohibited employer, adult-message, commerce, challenge, rating, league, or ad path.
- [ ] Deletion, withdrawal, correction, appeal, refund, and suspension work across subsystem boundaries.
- [ ] Operational staffing and kill switches have passed tabletop exercises.
- [ ] Metrics and stop rules are live before rollout.
- [ ] Marketing, Terms, Privacy Policy, community rules, creator terms, employer terms, challenge rules, ad policies, and teen disclosures are published.
- [ ] The owner signs the final launch acceptance record.

## Reference authorities for implementation review

- [U.S. Department of Labor: child labor in nonagricultural occupations](https://www.dol.gov/agencies/whd/fact-sheets/43-child-labor-non-agriculture)
- [U.S. Department of Labor: state child-labor laws](https://www.dol.gov/agencies/whd/state/child-labor)
- [FTC: COPPA compliance FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [California Attorney General: CCPA](https://oag.ca.gov/privacy/ccpa)
- [Colorado SB24-041](https://www.leg.colorado.gov/bills/sb24-041)
- [Connecticut Data Privacy Act](https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act)
- [Maryland targeted-advertising restriction](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&enactments=false&section=14-4707)
- [FTC: Disclosures 101 for Social Media Influencers](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers)
- [U.S. Copyright Office: DMCA Section 512](https://www.copyright.gov/512/)
- [IRS: managing taxes for gig work](https://www.irs.gov/businesses/small-businesses-self-employed/manage-taxes-for-your-gig-work)
- [IRS Publication 525: prizes and awards](https://www.irs.gov/publications/p525)
- [Stripe: accounts involving users under 18](https://support.stripe.com/questions/can-i-use-stripe-if-i-am-under-18)