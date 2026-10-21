# OrbitHire user guide

OrbitHire collects new jobs for you every morning, ranks them against your profile, and
keeps every application with its tailored resume, cover letter and follow-ups in one place.

- [1. Set up your profile](#1-set-up-your-profile)
- [2. Job search settings](#2-job-search-settings)
- [3. The Job Inbox](#3-the-job-inbox)
- [4. How ranking works](#4-how-ranking-works)
- [5. Applications](#5-applications)
- [6. Resumes and cover letters](#6-resumes-and-cover-letters)
- [7. Using Claude or ChatGPT (MCP)](#7-using-claude-or-chatgpt-mcp)
- [8. Importing from ai-job-search](#8-importing-from-ai-job-search)
- [9. Troubleshooting](#9-troubleshooting)

## 1. Set up your profile

**Profile** holds the facts every document is built from: contact details, summary, skills,
work experience and education (your "master resume"), plus target job titles, preferred
locations and salary. Ranking and document generation both read it, so the more complete
it is, the better the results. You can fill it by hand, upload an existing CV to extract it,
or import it from an ai-job-search `CLAUDE.md` (see [section 8](#8-importing-from-ai-job-search)).

## 2. Job search settings

**Settings → Job search**

- **Searches**: keywords, locations, sites (LinkedIn, Indeed, Naukri, Glassdoor, Google),
  posted within N hours, results per query. Optional title filters: "must contain one of"
  and "exclude titles containing".
- **Watchlist**: companies whose own job boards (Greenhouse, Lever, Ashby) are checked
  directly. These are the most reliable sources.
- **Additional job APIs** (Adzuna, Jooble, Reed, USAJOBS) run when the server has their keys
  configured.
- **Ranking**: home country, languages you speak, excluded companies / locations, how many
  jobs per day get an AI score, and the morning digest email (on/off and send time).

Jobs are fetched automatically every morning at **07:00 IST**. **Fetch now** on the Job
Inbox runs it immediately (at most once every 10 minutes).

## 3. The Job Inbox

**Job Inbox** (`/jobs`) lists new matches, best first. Each card shows title, company,
location, salary (when published), posting age, score and the main reasons.

- **Shortlist**: keep it for later. **Skip**: hide it.
- **Open posting**: the original job page.
- **Create application**: creates an application from the posting (title, link, salary,
  description) and links the two.
- **Generate documents**: tailored resume + cover letter in the portal (uses your AI
  provider). **Copy MCP prompt**: the same job as a prompt for Claude / ChatGPT
  (see [section 7](#7-using-claude-or-chatgpt-mcp)).
- Jobs that hit a deal-breaker (excluded company or location, language you don't speak,
  visa needs, ...) are hidden by default; "hidden jobs" shows them with the reason.

Postings that disappear from their source for 14 days expire automatically.

## 4. How ranking works

Cheap checks first, AI last, so most jobs cost nothing to rank:

1. **Pre-filter**: rules from your profile and ranking settings (deal-breakers, location,
   language, title filters). Failing jobs are hidden with the reason.
2. **Profile similarity**: an embedding of the job description compared with your profile.
3. **AI score**: only the top jobs of the day (limit in Settings → Job search) get an LLM
   score from 0 to 100 with reasons and red flags. Your own API key (Settings → AI
   Provider) is used when set; otherwise the platform key, within a daily cap.

The Inbox is ordered by AI score, then similarity. "Not ranked yet" means the ranking task
has not run for that job (it runs right after each fetch).

## 5. Applications

**Companies** (`/companies`) is your application tracker. Status flow: Saved → Applied →
Interviewing → Offered, or Rejected / Withdrawn. Each application keeps the job description,
link, recruiter contact, interview rounds, notes, status history and all its resumes and
cover letters. Seven days after you mark one Applied without a change, you get a follow-up
reminder with a ready-to-send message for the recruiter.

## 6. Resumes and cover letters

Open any document to edit it (`/documents/<id>`): form fields on the left, live preview on
the right, template picker, accent colour and paper size.

- **Templates**: Typst templates rendered in the background (default **Modern**; also ATS
  Classic, Compact, EU Photo and ModernCV, each with a matching cover letter). Browse them
  under **Templates**. Documents made with the old HTML templates were moved to the closest
  Typst template automatically; imported PDFs are kept exactly as uploaded.
- **Saving** stores a new version and renders the PDF. The **PDF badge** shows
  Queued → Rendering → PDF ready, or **PDF failed** with a **Retry** button. A render that
  hangs for more than a couple of minutes also offers Retry.
- **Failed PDFs**: the dashboard and Applications page list every document whose PDF failed,
  with **Retry all**.
- **Version history** (panel under the preview): every save from the portal, an AI client
  (MCP) or an import is a version. Click one to see what differs from the editor (section by
  section) and a preview. **Restore** copies it into a *new* version and re-renders the PDF;
  old versions are never changed.
- Imported documents (from old PDFs) have no form fields until you fill them in; download
  the original PDF from the editor header.

## 7. Using Claude or ChatGPT (MCP)

OrbitHire is also an MCP server, so Claude (Desktop, Claude.ai, Claude Code) or ChatGPT can
read your profile and inbox, tailor documents in *your* AI subscription, and save them
straight into OrbitHire (as new versions you review, with the PDF rendered by OrbitHire).

**Setup: Settings → AI connections.** Create a personal access token there (scope
*read* or *read + write*). It is shown **once** (`orb_…`); copy it right away. You can
revoke it any time; the list shows when and from which client each token was last used.

The server endpoint is `https://<your-domain>/api/mcp` (Streamable HTTP). Every request
sends `Authorization: Bearer orb_…`.

- **Claude Desktop** (needs Node.js; `mcp-remote` requires https except for localhost).
  In Claude Desktop → Settings → Developer → Edit config:

  ```json
  {
    "mcpServers": {
      "orbithire": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "https://<your-domain>/api/mcp", "--header", "Authorization:${ORBITHIRE_AUTH}"],
        "env": { "ORBITHIRE_AUTH": "Bearer orb_YOUR_TOKEN" }
      }
    }
  }
  ```

- **Claude Code**:

  ```bash
  claude mcp add --transport http orbithire https://<your-domain>/api/mcp \
    --header "Authorization: Bearer orb_YOUR_TOKEN"
  ```

- **claude.ai and ChatGPT** custom connectors need an OAuth login, which is not available
  yet (planned). Use Claude Desktop or Claude Code for now.

What the AI client can do:

| Read | Write (needs a read + write token) |
|---|---|
| `get_profile`, `search_jobs`, `get_job`, `list_applications`, `get_application`, `list_templates`, `get_resume_schema`, `get_document` | `save_resume`, `save_cover_letter`, `create_application`, `update_application_status` |

Prompts `tailor_resume(job_id)` and `write_cover_letter(job_id)` carry the writing
guidelines. Every save from an AI client creates a **new** resume or cover letter plus a
version (source "AI (MCP)" in the version history) and queues its PDF; nothing existing is
overwritten. Limits: 60 requests per minute and 20 writes per hour per token (server
settings `MCP_RATE_LIMIT_PER_MIN`, `MCP_WRITE_LIMIT_PER_HOUR`).

Typical prompts: "Tailor my resume for the top job in my inbox", "Write a cover letter for
job <id>", "Move my Elastic application to interviewing". The tools never invent
experience: they work from your profile and flag gaps honestly.

## 8. Importing from ai-job-search

**Settings → Import** (or `/import`) brings in your previous workflow. Every step shows a
preview first; nothing is written until you confirm, and re-running is safe.

1. **Applications** from `job_search_tracker.csv`: one application per row. Status is
   mapped (drafted → Saved, interview → Interviewing, no_response → Rejected,
   offer_declined → Withdrawn), fit rating and other columns go into the notes. A row that
   matches an existing application (same company and role) only fills in empty fields.
2. **PDFs** from `cv/` and `cover_letters/`: `main_…pdf` become resumes, `cover_…pdf`
   cover letters, stored as they are ("PDF ready", marked *Imported*). Each file gets a
   proposed application (from the tracker's file columns or the file name) that you can
   change; unmatched files stay unattached. Run step 1 first so files can be matched.
3. **Profile** from `CLAUDE.md` (optionally plus a recent CV for phone, website and summary):
   current and proposed values side by side, one checkbox per field. Empty fields are
   pre-ticked; nothing else changes unless you tick it.

Prefer the terminal? `worker/README.md` → "One-time import" has the same tracker and PDF
import as a command.

## 9. Troubleshooting

| Problem | What to do |
|---|---|
| PDF stays "Queued" | The background worker isn't running (self-hosting: `cd worker && uv run worker`). Retry after it's up. |
| PDF failed | Hover the badge for the error, fix the content if it says so, then Retry / Retry all. |
| Live preview says "Preview service is not available" | Same: the worker is down. Saving still works; the PDF renders once it's back. |
| No new jobs | Check Settings → Job search has at least one search or watchlist company; use Fetch now. |
| Jobs not scored | AI scoring needs an API key (yours or the platform's) and is capped per day. |
