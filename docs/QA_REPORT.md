# OrbitHire v2 – end-to-end QA report

Date: 2026-10-21 · Base: `update/application` @ 18d214e · Tester: final QA pass (Agent N)

## Setup

- `next dev` on :3217 and the worker (`uv run worker`, HTTP on :8797) against the local
  self-hosted Supabase (migrations 000–028). Neither was reset.
- Storage: a throwaway MinIO container. All `R2_*` variables of the app and the worker pointed
  at it, never at the real bucket. Imported PDFs reference keys that are not in that MinIO, so
  they return 404 there. That is expected.
- AI keys in `.env.local` are placeholders. Every LLM, embedding and scoring call fails with
  HTTP 401 and is checked for a graceful message only. No paid API was called.
- Browser: headless Chromium (Playwright 1.56) at 1440×900 and 390×844 (touch), each in dark
  and light mode. Logged in as `test@orbithire.local` through the real `/signin` form. Each page
  was checked for console errors, page errors, 4xx/5xx and failed requests, horizontal overflow
  (including the mobile layout viewport growing past 390 px) and dead links or buttons.
- Admin: a temporary `super_admin` `qa-admin@orbithire.local` (bcrypt hash) was inserted
  directly and deleted afterwards.

## Results

| # | Page / flow | Result | Bug found | Fix (file) | Re-verified |
|---|---|---|---|---|---|
| 1 | Landing (logged out), signin, signup, forgot password, privacy, terms, contact | Pass after fix | On mobile, the Spotlight SVG made the layout viewport 539 px wide (page zoomed out, horizontal scroll) | Root wrapper `relative overflow-x-clip` (`app/page.tsx`) | Yes, 390 px |
| 1 | Protected route while logged out | Pass | – | – | `/jobs` → `/signin?redirect=%2Fjobs` |
| 1 | Dashboard layout / sidebar / every app page | Pass after fix | **`SidebarLayout` mounted every page twice** (a hidden desktop `<main>` plus a mobile `<main>`). Every fetch and effect ran twice (dashboard counts, job inbox, document preview and so on), element ids were duplicated (`#job-search-country`, `#rk-companies`, …), and on mobile the `<label htmlFor>`s pointed at the hidden copy | One `<main>` with a CSS-variable margin (`md:ml-[var(--sidebar-width)]`) (`components/Sidebar.tsx`) | Yes: collapse/expand 240↔64 px, mobile menu, all pages in 4 modes |
| 1 | Sidebar nav, mobile hamburger, theme toggle, user menu, notifications bell | Pass | – | – | – |
| 2 | Job Inbox: tabs, counts, source / remote / min salary / min score filters, Show hidden (deal-breaker reasons) | Pass | – | – | – |
| 2 | Job Inbox on mobile | Pass after fix | A long title (`truncate` link in an auto grid track) made every card 715 px wide. Buttons such as "Create application" were cut off and the page zoomed out | `grid-cols-1` and `max-w-full` on the title (`app/(dashboard)/jobs/page.tsx`) | Yes |
| 2 | Shortlist / Skip, Shortlisted and Skipped tabs, job detail, Open posting, Copy MCP prompt (clipboard), Generate documents (pre-fills /generate), Create application → `/companies/<id>`, then "View application" | Pass | – | – | – |
| 2 | Job detail "Scoring failed" text | Fixed | The raw provider error was shown to the user (`Error code: 401 - {'error': {... 'Incorrect API key provided: your-ope***' ...}}`) | `describe_llm_error()` stores a short reason for 401/403/429 (`worker/orbithire_worker/ranking/pipeline.py`) + test (`worker/tests/ranking/test_secrets_scoring.py`) | Unit test. Existing rows keep the old text until they are scored again (today's daily LLM cap was used up) |
| 2 | Fetch now | Pass | – | – | Real fetch (1 search with 5 results/query + watchlist ATS boards): "Fetching… 1 running" → "Last fetch … 120 jobs found, 2 new". A second click → 429 "You fetched less than 10 minutes ago" shown inline |
| 3 | Settings → Job search: add a DE search (Arbeitnow, Bundesagentur, Wellfound scraper) and an AU search (SEEK shown as blocked and disabled), the 3-search limit (button disabled, API 409 `search_limit`), edit (sources and country persisted), pause, delete; watchlist add via a careers URL (ATS auto-detected), disable, delete; portals.yml upload (`1 added, 64 updated, 18 skipped`) | Pass | – | – | – |
| 3 | Settings → Ranking settings save | **Pass after fix** | **Saves were silently lost and reads were stale.** `/api/settings/ranking` reads the session from `req.cookies`, so Next.js put its Supabase `fetch`es in the Data Cache (`.next/cache/fetch-cache`, revalidate 1 year) even with `dynamic = "force-dynamic"`. A PUT whose body matched an earlier one returned the cached 200 without writing, and GET returned old values | `export const fetchCache = "force-no-store"` in every route that builds its Supabase client from `req.cookies` (`app/api/settings/ranking/route.ts`, `app/api/settings/route.ts`, `app/api/settings/apikey/route.ts`, `app/api/profile/route.ts`, `app/api/generate/resume/route.ts`) | Yes: 13 → 12 → 13 → 12 all persist in the DB, and the fetch-cache stays empty after the whole run (incl. admin) |
| 3 | Settings → AI provider | Pass | – | – | Provider switch. Test Connection with a fake key shows "API key appears to be invalid (too short)". Save is disabled without a key |
| 3 | Settings → AI connections: create token → shown once → copy (clipboard = token), snippet copy, "I have saved it", revoke; connected OAuth app listed → Disconnect | Pass | – | – | – |
| 3 | Settings → Import: tracker CSV preview only (`0 to create, 0 to update, 8 to skip`, "Already imported") | Pass | – | – | Not applied |
| 3 | Settings → Account / Billing / Integrations | Pass | – | – | Placeholders marked "Soon" |
| 3 | Settings page markup | Fixed | Nested `<main>` inside the layout's `<main>` | `<div>` (`app/settings/page.tsx`) | Yes |
| 4 | /templates: 5 resume and 3 cover-letter Typst templates incl. ModernCV, 8/8 thumbnails load | Pass | – | – | – |
| 4 | /generate up to the AI call | Pass after fix | The generic "Failed to generate content. Please try again." (HTTP 500) hid the real cause (rejected key) | A `ProviderError` returns 502 with a clear message: the platform key → "The built-in AI service is unavailable right now. Add your own API key in Settings → AI Provider…"; the user's own key → the provider message + suggestion (`app/api/generate/resume/route.ts`) | Yes. The free-generation quota is not consumed |
| 4 | Document editor `/documents/[id]` (Typst resume) | Pass after fix | The form labels were not associated with their inputs (screen readers, `getByLabel`) | `useId()` + `htmlFor`/`id` in `Field` (`app/(dashboard)/documents/[id]/page.tsx`) | Live preview renders (worker `/preview`), editing the headline updates it, switching the template to ModernCV re-renders, Save → "Saved version 2", badge Rendering → PDF ready, download 200 `application/pdf` from MinIO |
| 4 | Version history: list (Portal / AI (MCP)), view diff + preview, Restore → "Restored version 1 as version 3", PDF re-rendered | Pass | – | – | – |
| 4 | Failed PDF: forced a 28-page render (`PDF has 28 pages (max 6)`) → panel on dashboard + /companies, badge tooltip, Retry, Retry all; fixed the content in the editor → PDF ready → panel gone | Pass after fix | "1 PDF need attention" | "1 PDF needs attention" (`components/documents/FailedPdfsPanel.tsx`) | Yes |
| 4 | My Resumes on mobile | Pass after fix | The card row didn't wrap: the layout viewport grew to 433 px and the title was squeezed to about 100 px | Stack on mobile, `min-w-0`, wrapping meta row (`app/(dashboard)/resumes/page.tsx`) | Yes |
| 5 | Applications list: All / Saved / Applied / Interviewing filters, search | Pass | – | – | – |
| 5 | Application detail: Edit → status Applied → saved; the job match moves to the Inbox "Applied" tab; follow-up "Follow up with recruiter" (+3 days) created, old one completed | Pass | – | – | – |
| 5 | New application (`/companies/new`, linked from the dashboard "New Company" buttons) | **Pass after fix** | **The form never saved** (`// TODO: Save to Supabase`). After a fake 1 s delay it redirected to `/companies/<slug>`, which has no record | POSTs to `/api/companies` and opens `/companies/<id>`; errors shown inline (`app/(dashboard)/companies/new/page.tsx`) | Yes: create → detail → delete → back to the list |
| 5 | Dashboard follow-ups: Snooze | Fixed | Snooze set "now + 3 days", so a reminder already 3 days out didn't move (looked like a dead button) | Extends from `max(now, next reminder)` (`app/(dashboard)/dashboard/page.tsx`) | Yes: 10/24 → 10/27 |
| 5 | Dashboard "View All Follow-ups" | Fixed | Linked to `/follow-ups`, which doesn't exist (404) | "View all applications" → `/companies` (`app/(dashboard)/dashboard/page.tsx`) | Yes. All other internal links resolve |
| 5 | Notifications: dropdown, Mark all read (badge 9+ → none) | Pass | – | – | – |
| 6 | `/oauth/authorize`: logged out → signin with redirect; consent (desktop light, mobile dark), Allow → `code`+`state`+`iss`, PKCE exchange → `read write`; app listed in AI connections → Disconnect | Pass | – | – | – |
| 6 | `npm run oauth:smoke` | Pass | – | – | "All OAuth checks passed" |
| 6 | `npm run mcp:smoke` | Pass | – | – | "all checks passed" (save_resume → PDF ready 0.5 s) |
| 7 | Admin: signin, dashboard, users, credits, access codes, admins, contacts, settings, tasks | Pass after fix | Hydration errors on `/admin/users` and `/admin/tasks` (and `ContactsTable`): `toLocaleString()` differs between the server (en-GB / server TZ) and the browser, so React threw away the SSR HTML | `components/LocalDate.tsx` formats after mount; used in the three tables | Yes, no page errors |
| 7 | Admin → Tasks: status counts, failed-by-type, Test task (done), Failing test task (retried with backoff), details dialog, Retry, status filter | Pass | – | – | – |
| – | Docs | Fixed | USER_GUIDE said the follow-up comes after 7 days. The code (and the dashboard tip) use 3 days after Applied | `docs/USER_GUIDE.md` | – |

## Not changed (noted)

- Branding still says "CVLeap AI" in the sidebar, mobile header and landing (product name OrbitHire).
  This is a product decision, not a bug, so it was left alone.
- Settings → AI provider model list still shows older model names (Claude 3.5 Sonnet, Gemini 1.5).
  They are only dropdown labels and should be refreshed with the provider registry.
- `app/(dashboard)/companies/data.ts` (mock `companyDirectory`) is now unused.
- In dev, Playwright reports Supabase `HEAD` count requests as `ERR_ABORTED`. The counts render
  correctly, so this is a Chromium/Playwright artifact.

## Checks before commit

`npx tsc --noEmit` ✔ · `npm run build` ✔ (only the known supabase-realtime Edge warning) ·
worker `uv run pytest` 319 passed ✔ · Typst template tests 77 passed ✔ · `scripts/test-import.ts` 8 passed ✔

## Data left for the test user (demo data)

- Application **Antal International – React Developer**, created from the Job Inbox, status
  Applied, one active follow-up. Its job match shows under Inbox → Applied.
- 2 shortlisted and 2 skipped job matches. One new posting batch from the real "Fetch now".
- Resume "Frontend Engineer – Ui Developer at Mphasis" now uses the ModernCV template with
  versions 1–3 (its current PDF key lives in the QA MinIO, which was removed, so download it
  after a re-save).
- Notifications marked as read. Ranking settings unchanged (min salary 12 LPA).

Removed again: QA job searches, the watchlist test company, "QA Delete Me Inc", the QA failing
resume and its versions/tasks, the QA MCP token, the QA OAuth client, the admin test tasks and the
QA admin.

## Screenshots

`docs/qa-screenshots/` (desktop 1440 px unless noted; PNG, 128 colours):
01 landing · 02 dashboard · 03 job inbox (+03b mobile) · 04 job detail (taken before the
scoring-message fix) · 05 job search settings · 06 AI connections with a connected app ·
07 import preview · 08 templates · 09 generate with failing AI key · 10 document editor (ModernCV)
· 11 version history · 12 failed-PDF panel · 13 application detail · 14 My Resumes mobile ·
15 OAuth consent · 16 admin tasks.
