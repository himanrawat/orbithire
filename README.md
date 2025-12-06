OrbitHire -- spec
=================

Goal: let candidates paste a job description, auto-tailor an ATS-friendly resume + cover letter (OpenAI + Groq), store/share versions company-wise, and track applications with 7-day follow-up emails (includes recruiter-facing message). Backend: Supabase (auth + DB + edge functions). File storage: Cloudflare R2 (presigned uploads/downloads). Region-ready templates (Germany/EU include optional profile photo slot).

Env setup
---------
1) Copy `.env.example` to `.env` and fill values.  
2) Required keys: Supabase URL + anon key (+ service role for edge), OpenAI + Groq, Cloudflare R2 (account, access, secret, bucket), email provider key (Resend), app URL, follow-up from email. Optional: PostHog.

User flow
---------
- Landing page: sign in/up buttons; when logged in, swap for user name + avatar; CTA to go to `/dashboard`.
- Dashboard: profile completeness meter; recent resumes/cover letters; Paste JD entry point; application tracker, reminders, and company folders.
- Upload and parse: user uploads PDF/Word -> R2 presigned upload -> backend parses text -> structured profile is filled; user can edit profile separately from any resume.
- JD-to-tailored docs: user pastes JD -> AI compares JD vs profile -> generates resume (ATS-first layout) + cover letter; saves both as new versions; offers download/share link; user can file them into the company folder for that application.
- Sharing: per-resume/cover-letter share token with view logging; export to PDF/Docx.
- Application tracking: create application from a tailored resume/CL; statuses (Saved -> Applied -> Interview -> Offer -> Rejected); recruiter contact log; reminders; outbound follow-up email after 7 days.
- Company folders: when user applies to a company (e.g., Google), auto-create a folder for that company. Store multiple chosen resumes/cover letters/JDs inside. Let user add ad-hoc notes on what was discussed with HR.
- Follow-up: if no status change after 7 days from Applied, send user an email that includes follow-up copy for the recruiter; optionally one-click send to recruiter now.

Key constraints
---------------
- No external job fetch; user always pastes JD.
- Germany/EU: include profile photo slot in templates; keep modern ATS layout (no heavy graphics).
- Profiles are distinct from any generated resume; resumes/cover letters are versioned.

Architecture
------------
- Frontend: Next.js (App Router), React, TypeScript, Tailwind (or CSS-in-JS), client Supabase auth.
- Backend: Supabase Postgres + RLS; Supabase Edge Functions for AI orchestration, parsing, follow-up scheduler, email delivery.
- AI: OpenAI (precision rewrite), Groq (fast extraction/diff). Prompt to enforce ATS structure (plain text/bullets, minimal styling).
- Storage: Cloudflare R2 for originals and generated PDFs/Docx; store derived plain text in Postgres for semantic ops/search.
- Email/notifications: Supabase Edge Function hooked to a provider (Resend/Postmark/SES) for follow-ups; web push/FCM for in-app notifications.

Data model (Supabase)
---------------------
- `profiles`: id (uuid, FK to auth), name, headline, summary, skills (jsonb), photo_url (R2), location, visa_status, work_authorization, updated_at.
- `resumes`: id, user_id, title, locale (enum: global, india, eu, de), ai_model_used, jd_hash (for provenance), content_text (plain), file_url (R2), created_at.
- `cover_letters`: id, user_id, resume_id (nullable), jd_hash, content_text, file_url, created_at.
- `job_descriptions`: id, user_id, title, company, location, remote (bool), salary_range, jd_text, jd_hash, created_at.
- `company_folders`: id, user_id, company_name, company_slug, created_at.
- `company_files`: id, company_folder_id, file_type (enum: resume/cover_letter/jd/note), resume_id, cover_letter_id, job_description_id, file_url (R2), note_text (for quick HR notes), created_at.
- `applications`: id, user_id, company_folder_id, job_description_id, resume_id, cover_letter_id, status (enum), applied_at, follow_up_due_at, last_follow_up_sent_at, recruiter_email, recruiter_name, notes.
- `recruiter_interactions`: id, application_id, type (call/email/note), body, occurred_at.
- `templates`: id, name, locale, has_photo (bool), file_url (R2), preview_url.
- `shares`: id, user_id, target_type (resume/cover_letter), target_id, token, expires_at, viewed_count, last_viewed_at.

AI pipeline (JD -> tailored docs)
---------------------------------
1) Ingest JD text; hash for traceability.  
2) Extract key requirements (skills, years, must-have, location, language) via Groq.  
3) Compare against `profiles` + latest resume to find gaps and matches.  
4) Generate resume draft (OpenAI) with ATS-safe formatting; enforce locale rules (Germany/EU include photo slot).  
5) Generate cover letter aligned to JD; inject company/role/location.  
6) Save content_text; render to PDF/Docx template; store in R2; create new `resumes`/`cover_letters` rows linked to `job_descriptions` and optionally to `company_folders`.  
7) Optionally update `applications` (status=Saved) ready for user to mark Applied.

Templates (Germany/EU notes)
----------------------------
- Include photo placeholder; clean two-column or single-column; minimal colors.  
- Sections: Profile (2-3 lines), Skills (top-matching skills first), Experience (reverse-chronological with quant metrics), Education, Languages, Links.  
- Avoid personal data that hurts ATS (birthdate, marital status) unless required; keep bilingual labels if needed.

Company folders and storage layout
----------------------------------
- Auto-create folder per company slug (e.g., `google`) on first application.  
- R2 paths: `users/{user_id}/companies/{company_slug}/resumes/{resume_id}.pdf`, `/cover_letters/{cover_letter_id}.pdf`, `/jd/{job_description_id}.txt`, `/notes/{note_id}.txt`.  
- UI: each folder shows all resumes/cover letters used for that company, linked JDs, and quick "what I discussed with HR" notes. Users can add multiple resumes/cover letters per company.

Follow-up logic
---------------
- On `applications` insert/update to status=Applied, set `follow_up_due_at = applied_at + interval '7 days'`.  
- Scheduled edge function (daily cron) queries pending applications (status=Applied AND follow_up_due_at <= now() AND last_follow_up_sent_at IS NULL).  
- Send user email containing: reminder + ready-to-send recruiter email body; include one-click action to send via app (if recruiter_email stored).  
- Record `last_follow_up_sent_at`; if user triggers send-to-recruiter, log in `recruiter_interactions`.

Sample follow-up body (sent to user and optionally forwarded to recruiter)
--------------------------------------------------------------------------
```
Subject: Quick follow-up on my application for {{role}} at {{company}}

Hi {{recruiter_name | there}},

I applied for the {{role}} role on {{applied_date}} and wanted to reiterate my interest.
A quick recap: {{2-3 JD-matching achievements}}.
Happy to share anything else you need or to jump on a short call this week.

Thanks for your time,
{{your_name}}
{{phone}} | {{LinkedIn}}
```

Endpoints/edges (Supabase functions)
------------------------------------
- `parse-upload` (auth): accept R2 key -> extract text -> update `profiles` + store `resumes` source text.  
- `generate-docs` (auth): input JD text + locale -> returns resume/CL drafts, saves to DB/R2, links JD and optionally company folder.  
- `follow-up-cron` (service role, scheduled): run daily, send reminder emails, update `applications`.  
- `send-recruiter-email` (auth): send templated follow-up to recruiter_email if present; log interaction.
- `upsert-company-folder` (auth): ensure folder exists for a company, attach selected resumes/cover letters/JDs, and set folder on an application.
- `add-hr-note` (auth): append quick "what I talked to HR" note into `company_files` (file_type=note) and `recruiter_interactions`.

Implementation steps
--------------------
1) Scaffold Next.js + Supabase client; set envs for OpenAI, Groq, R2, email provider.  
2) Auth and layout: landing with conditional sign in/up vs user name+photo; protect `/dashboard`.  
3) Profile editor + upload-to-parse flow (R2 presigned -> edge parse -> profile fill).  
4) JD paste form + `generate-docs` call; display/render resume/CL; allow download/share.  
5) Templates: seed global/India/EU/DE templates (with photo slot for EU/DE).  
6) Company folders + application tracker UI: auto-create folder by company, attach multiple resumes/cover letters/JDs, notes on HR discussions; hook follow-up scheduling.  
7) Email/notification plumbing (user reminder + optional recruiter send).  
8) QA: ATS text output checks, locale toggles, RLS policies, file access scoped by user.

Notes on security and tenancy
-----------------------------
- Enforce RLS on all user-owned tables keyed by `user_id`.  
- Use presigned URLs for R2 uploads/downloads; never expose service keys to the client.  
- Rate-limit AI endpoints per user; store provenance (jd_hash, model) for auditing.  
- PII handling: keep photos in R2 with restricted ACL; scrub logs of JD text.
