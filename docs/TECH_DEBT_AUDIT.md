# Technical Debt and Optimization Audit

**Project:** NextMilestone / OrbitHire  
**Audit date:** 23 October 2026  
**Scope:** Next.js application, API routes, Supabase migrations, MCP/OAuth, R2 storage, and Python worker

The repository contains approximately 56,000 lines of TypeScript, TSX, and Python across 63 API routes. The Python worker is comparatively healthy, with 319 tests passing. The web application needs several security and correctness fixes before lower-level performance optimization.

## Prioritization method

Each item is scored using:

```text
Priority score = (Impact + Risk) × (6 - Effort)
```

Impact and risk are scored from 1–5. Effort is scored from 1–5, where lower effort raises priority.

## Highest-priority findings

| Priority | Finding | Score | Where and what to fix |
| --- | --- | ---: | --- |
| P0 | Generation credits are not consumed | 40 | `app/api/generate/resume/route.ts:233` checks for legacy reasons such as `free_tier`, while the current SQL returns `credits_available`. It then calls the legacy `increment_free_generation` at line 600 instead of `decrement_ai_credits`. Replace check-then-update with one atomic `reserve_generation_credit(auth.uid())` RPC. Refund only for provider failures where no usable generation was returned. |
| P0 | Admin session cookie is just the admin UUID | 30 | `app/api/auth/admin/signin/route.ts:55` stores `admin.id` directly. Every admin route trusts that value, for example `app/api/auth/admin/verify/route.ts:21`. Replace it with a cryptographically random, hashed server-side session containing expiry, rotation, revocation, and optional device metadata. Centralize `requireAdmin()` and role checks. |
| P0 | Public R2 diagnostic endpoint | 45 | `app/api/test-r2/route.ts:7` is unauthenticated, lists bucket objects, and returns raw infrastructure errors. Remove it from production or require super-admin authentication and return only a boolean health status. |
| P0 | Privileged quota RPCs accept arbitrary user IDs | 36 | `supabase/migrations/20250101000010_admin_system.sql:77` defines `SECURITY DEFINER` functions taking `p_user_id`, and grants credit decrement to all authenticated users at line 200. Use `auth.uid()` internally, reject mismatched IDs, pin `search_path`, and revoke obsolete `increment_free_generation`. |
| P1 | Credit additions are race-prone | 28 | `app/api/admin/users/credits/route.ts:51` reads the balance and then writes `current + amount`. Concurrent requests can lose updates. Replace this with an atomic SQL `UPDATE ... SET ai_credits = ai_credits + p_amount RETURNING ai_credits`. |
| P1 | Lint and CI quality gates are effectively absent | 36 | `package.json:5` runs `next lint`, but it opens an interactive setup prompt because no ESLint configuration exists. No repository CI workflows were found. Add ESLint, formatting, TypeScript, Python tests, migration validation, smoke-script type checks, and build checks to CI. |
| P1 | Authentication and public forms lack application-level rate limits | 27 | Sign-in, signup, admin sign-in/signup, password reset, resend confirmation, and `app/api/contact/route.ts` rely primarily on downstream behavior. Add IP/account throttling, backoff, CAPTCHA after repeated attempts, normalized generic auth responses, and audit events. |
| P1 | Account enumeration during signup | 32 | `app/api/auth/signup/route.ts:108` explicitly reports that an account exists. Return the same success response whether the email is new or existing. |
| P1 | Request validation is inconsistent | 27 | At least 35 route handlers consume `req.json()` directly. Introduce Zod schemas for every API boundary, including maximum string/array sizes, UUIDs, enums, URLs, email normalization, unknown-key rejection, and a common validation-error response. |

## Performance and architecture backlog

| Priority | Optimization | Score | Recommended fix |
| --- | --- | ---: | --- |
| P1 | R2 files are fully buffered in server memory | 21 | `app/api/files/[...path]/route.ts:67`, `app/api/profile/photo/route.ts:48`, and resume generation buffer complete objects. Stream the S3 body into `Response`, propagate `Content-Length` and `ETag`, support byte ranges for PDFs, and enforce maximum object sizes. |
| P1 | Resume and cover-letter generation is sequential | 21 | Resume generation starts around `app/api/generate/resume/route.ts:403`, cover generation around line 577, and the photo fetch at line 596. After atomic quota reservation, run independent AI calls and photo loading concurrently with controlled timeouts. |
| P1 | Dashboard pages ship very large client bundles | 21 | `app/(dashboard)/generate/page.tsx` is approximately 1,992 lines, `app/(dashboard)/profile/page.tsx` approximately 1,851, and `app/(dashboard)/companies/[companyId]/page.tsx` approximately 1,543. Split them into feature components, hooks, schemas, and server-loaded page shells. |
| P1 | Client-side data fetching is duplicated | 24 | AppShell, profile banners, settings, and pages independently request `/api/profile`. Introduce a shared query layer such as SWR/React Query or server-loaded context for caching, request deduplication, cancellation, retries, and invalidation. |
| P1 | Polling creates unnecessary request volume | 21 | Notifications poll every 30 seconds in `components/NotificationDropdown.tsx:84`; PDF and fetch tasks poll every few seconds in `components/PdfStatusBadge.tsx:93` and `components/jobs/FetchNowButton.tsx:68`. Consolidate polling, pause it in hidden tabs, apply exponential backoff, or use Supabase Realtime/SSE. |
| P2 | Excessive `select("*")` usage | 20 | Jobs, notifications, settings, MCP, and generation fetch full rows. Examples include `app/api/jobs/route.ts:44` and `app/api/generate/resume/route.ts:220`. Select only fields required by the response or computation. |
| P2 | Profile extraction is a 940-line synchronous route | 14 | `app/api/profile/extract/route.ts` combines file parsing, OCR/LLM logic, normalization, provider fallback, and HTTP handling. Split it into parsers and services; enqueue expensive OCR/LLM extraction through the worker and expose job status. |
| P2 | Heavy marketing animation code is always client-side | 18 | `components/ui/pushpin-tear-footer.tsx` is over 1,000 lines and contains timers/canvas animation. Dynamically load it below the fold, provide a static reduced-motion version, and measure its bundle/CPU impact. |
| P2 | Image optimization is bypassed | 18 | Several user and provider images use raw `<img>`. Use `next/image` where possible, define remote patterns, add fixed dimensions, and keep blob/data previews on native images only. |
| P2 | Storage configuration differs between app and worker | 24 | `lib/config.ts:31` falls back from `R2_ENDPOINT` to the public CDN base and ignores the documented `R2_ACCOUNT_ID`; the worker resolves these differently. Create one explicit model for the private S3 endpoint, public base URL, bucket, and proxy behavior. |

## Maintainability and reliability

### Centralize authentication and database clients

Supabase cookie adapters and `getUser()` handling are duplicated across dozens of routes. Several routes still use the deprecated `get`/`set`/`remove` cookie interface, including:

- `app/api/files/[...path]/route.ts:29`
- `lib/supabaseServer.ts:11`
- `lib/supabase-edge.ts:40`
- Multiple settings and document routes

Create shared helpers for:

- `requireUser()`
- `requireAdmin(role?)`
- Current `getAll`/`setAll` Supabase cookie adapters
- Service-role client creation
- Standard unauthorized, forbidden, validation, and server-error responses

### Reduce service-role usage

Routes such as `app/api/profile/route.ts:555` authenticate a user and then perform writes as the service role. Prefer the authenticated client with RLS or narrowly scoped database functions. This reduces the blast radius of application bugs.

### Add global security headers

`next.config.js` has no application-level configuration for:

- Content Security Policy
- `X-Content-Type-Options: nosniff`
- Referrer Policy
- Permissions Policy
- HSTS
- Global frame restrictions where appropriate

Start with report-only CSP because the animation, OAuth, and external-provider flows may need tuning.

### Validate actual image content

Signup and profile uploads trust client-provided MIME metadata. Decode images, verify magic bytes and dimensions, optionally re-encode them, cap pixel count, and always serve uploads with `nosniff`.

### Restrict legacy avatar redirects

`app/api/profile/photo/route.ts:144` redirects to any stored HTTP URL. Allow-list approved hosts or migrate legacy URLs into R2.

### Make worker tasks explicitly idempotent

The task queue is at-least-once. If completion persistence fails in `worker/orbithire_worker/worker.py:250`, the task is eventually reclaimed and its external side effects may repeat. Add idempotency keys or unique constraints for:

- Email sends
- PDF generation/storage
- Imports
- Fetch batches
- Notifications

### Authenticate the worker preview endpoint

`worker/orbithire_worker/internal_http.py:91` assumes network isolation. Docker Compose binds it safely to loopback, but add a shared internal token or mTLS so a future deployment change cannot expose document rendering publicly.

### Move MCP request limits to shared storage before scaling

`lib/mcp/rateLimit.ts:22` keeps request counters in process memory. Redis or an atomic PostgreSQL function will make limits consistent across application restarts and replicas.

The write-limit query should also receive a supporting partial/expression index covering `user_id`, `created_at`, and `metadata->>'token_id'` for `event_type LIKE 'mcp.%'`.

### Improve observability

The repository contains over 200 direct console/logger calls but no consistent application-wide implementation for:

- Request and correlation IDs
- Structured web logging
- Distributed tracing
- Error aggregation
- Endpoint latency and failure metrics
- Queue depth and queue age
- AI token usage and cost
- Fetch-source success rates
- R2 request latency and failures

### Align dependency versions

`package.json` uses Next.js 14 with `eslint-config-next` 15. Align framework and tooling versions first, then upgrade Next.js, TypeScript, React, Node typings, Supabase, and the AI SDKs in separately tested batches.

### Add web application tests

The Python worker has strong coverage, but no first-party Vitest, Jest, or Playwright configuration was detected. Prioritize tests for:

1. Generation quota enforcement and atomic reservation
2. Admin authentication and role enforcement
3. RLS and privileged RPC authorization
4. Signup enumeration prevention
5. Profile save and image upload behavior
6. Generation failure and credit-refund behavior
7. MCP/OAuth authorization boundaries
8. One end-to-end job-to-application workflow

## Recommended execution phases

### Phase 0: Security and cost hotfixes

Estimated duration: 1–3 days.

1. Remove or protect `/api/test-r2`.
2. Replace UUID admin cookies with real server-side sessions.
3. Implement atomic generation-credit reservation and consumption.
4. Secure all quota-related `SECURITY DEFINER` RPCs.
5. Remove or revoke obsolete quota functions.

### Phase 1: Quality gate and API hardening

Estimated duration: 3–7 days.

1. Add working ESLint and formatter configurations.
2. Add CI for TypeScript, build, Python tests, migrations, and smoke-script compilation.
3. Introduce shared user/admin authentication helpers.
4. Add Zod schemas to API boundaries.
5. Add public/auth endpoint rate limiting.
6. Add security headers and stronger upload validation.

### Phase 2: Runtime optimization

Estimated duration: 1–2 weeks.

1. Stream R2 objects and add range support.
2. Parallelize independent generation work.
3. Consolidate repeated profile/settings requests.
4. Replace independent polling loops with one coordinated mechanism.
5. Narrow `select("*")` database queries.

### Phase 3: Structural refactoring

Estimated duration: 2–4 weeks alongside feature work.

1. Split the large dashboard pages into feature modules.
2. Move initial data loading to server components where practical.
3. Split profile extraction into parsers, normalization, and provider services.
4. Extract storage and Supabase adapters into shared modules.
5. Add web unit, integration, and end-to-end coverage during each extraction.

### Phase 4: Scale readiness

1. Move MCP rate limiting to shared storage.
2. Add explicit worker idempotency guarantees.
3. Add structured logging, tracing, and operational dashboards.
4. Add queue latency, AI cost, source reliability, and storage metrics.
5. Upgrade dependencies in controlled, independently reversible batches.

## Suggested first implementation batch

The first batch should contain only narrowly scoped correctness and security changes:

1. Delete or protect `app/api/test-r2/route.ts`.
2. Add an `admin_sessions` table and replace the current `admin_token` UUID cookie.
3. Add an atomic `reserve_generation_credit()` RPC based on `auth.uid()`.
4. Update resume generation to use that RPC and remove calls to `increment_free_generation`.
5. Revoke authenticated access to arbitrary-user quota functions.
6. Add regression tests for admin-cookie forgery and concurrent credit reservations.

