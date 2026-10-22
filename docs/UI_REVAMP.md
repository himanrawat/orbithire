# App UI revamp: NextMilestone design system

Tracks the move of the signed-in app (and the admin area) from the stock shadcn theme to the NextMilestone design system. Started Oct 22, 2026.

**Scope: UI only.** No new features, no API, data or behavior changes. Copy changes are limited to tone and American spelling. New PRD features (Today, Learn, Focus…) are out of scope here.

**Approach: components first, in small chunks.** Each chunk is reviewed (screenshots in light and dark, desktop 1440 px and phone 390 px) before the next starts. A screen chunk only touches that screen's files.

**Source of truth:** the tokens in `components/marketing/nextmilestone.css` (from the design system's `tokens.json`), the fonts in `app/fonts.ts`, and the patterns already built for the marketing site and sign-in.

---

## Chunk 0 · Foundation ✅
- [x] Map the shadcn HSL variables (`--background`, `--primary`, `--border`…) to NextMilestone values in `app/globals.css`, light and dark. They live at the root, not in a `.nm` wrapper, because dialogs and menus render in portals outside any wrapper; `.nm` on marketing pages still overrides them, so the site is unchanged.
- [x] `--primary` is **ink**, not yellow: the app uses `text-primary` 43 times for links and icons, and yellow text fails contrast on paper. The yellow is a separate Tailwind color, `cap` (`--brand-cap`), for the one main action (chunk 1).
- [x] Brand fonts on `<html>`; Tailwind `font-sans` (Host Grotesk), `font-display` (Anek Latin Wide), `font-mono` (Geist Mono); radius 10 px
- [x] Every app screen checked in light and dark: renders, no console errors

## Chunk 1 · Primitives (`components/ui`) ✅
- [x] Brand tokens (`--surface`, `--kind-*`, `--shadow-float`, `--radius-*`…) available app-wide: `nextmilestone.css` now defines them on `:root` and `.nm` and is loaded in the root layout, so portals (menus, dialogs) can read them. Marketing values are unchanged.
- [x] Button: 10 px radius, semibold, `gap-2`; variants `default` (ink), **`cap`** (yellow main action, once per screen), `outline`, `secondary`, `ghost`, `destructive`, `link` (info blue); 44 px on phones for `default` and `icon`
- [x] Input, Textarea, Select trigger: 44 px, `line-control` border, focus ring in `--focus`, `aria-invalid` turns the border red. (44 px rather than the marketing site's 48 px, for app density; still a full touch target.)
- [x] Label: 550 weight, 20 px line
- [x] Card: **had no styles at all** (a bare `div`), so every screen improvised. Now one surface recipe: 14 px radius, hairline border, `bg-card`, faint shadow. CardTitle in the display face.
- [x] Badge: soft status variants (`success`, `warning`, `destructive`, `info`) and the product-area variants (`focus`, `learn`, `prep`, `jobs`, `interview`) from the tokens
- [x] Dialog: ink scrim, 22 px radius, float shadow, 40 px close target, display-face title; 16 px side gutter on phones
- [x] Dropdown menu, Select content: 14 px radius, float shadow, 36 px rows, hairline separators
- [x] Table: 13 px semibold headers, hairline rows, accent hover
- [x] Calendar: selected day in cap yellow, today outlined
- [x] Removed `GridBackground` from 10 screens and deleted the unused `components/ui/aceternity.tsx`
- [ ] Accordion: left as is. The marketing FAQ uses it with its own classes; no app screen uses it yet.

**Moved to chunk 4 (per screen), with this mapping.** The app has ~230 raw Tailwind palette classes in 22 files (green, amber, purple, blue, red, orange). Remapping the palette globally would silently change meanings and break `/10` opacity, so each screen swaps them by intent:

| Raw classes today | Meaning | Use instead |
| --- | --- | --- |
| `green-*` | done, success, connected | `text-[var(--success)]`, `bg-[var(--success-soft)]`, Badge `success` |
| `amber-*`, `yellow-*` | warning, pending | `text-[var(--cap-ink)]`, `bg-[var(--cap-soft)]`, Badge `warning` |
| `red-*` | error, rejected | `text-destructive`, `bg-[var(--danger-soft)]`, Badge `destructive` |
| `blue-*` | info, applied, links | `text-[var(--info)]`, `bg-[var(--info-soft)]`, Badge `info` / `jobs` |
| `purple-*`, `violet-*`, `indigo-*` | AI, generation | `text-[var(--kind-prep)]`, `bg-[var(--kind-prep-soft)]` (AI drafts) or neutral ink |
| `orange-*` | interview, attention | `text-[var(--kind-interview)]`, `bg-[var(--kind-interview-soft)]` |

Also per screen: native `<select>` elements (Industry, "All sources") bypass the Select component; give them the field style or swap to `Select`. Pick the one `cap` button for each screen.

## Chunk 2 · App shell ✅
- [x] Sidebar on the night ground with print grain, in both themes; logo turns light on it
- [x] Active item: raised row, a cap-yellow marker on the panel edge, and the icon in its area color (Generate = prep, Job Inbox = jobs, Companies = interview, Resumes = learn, Templates = focus); `aria-current="page"`
- [x] Collapse moved from a floating ghost button over the page into the sidebar's bottom group; Settings added there too
- [x] Top bar (`components/app/AppShell.tsx`): notifications, theme, and an account menu with initials in the arch frame, name and email (avatar photo when there is one)
- [x] Notifications: icons in area colors, cap-yellow unread count and dot, labeled bell for screen readers
- [x] **One shell**: settings and profile moved into the `(dashboard)` route group (URLs unchanged) and their copied sidebar and phone header removed. They now get the desktop top bar they were missing.
- [x] Phone: header with menu, logo, notifications, theme and account; menu sheet 280 px with its own close button; no horizontal scroll at 390 px

## Chunk 3 · Shared app patterns (`components/app/`) ✅
- [x] `PageHeader`: back link, icon tile, display-face title, lead, actions (stacked on phones)
- [x] `SectionHeader`, `StatTile` (mono number, optional area tint), `EmptyState` (milestone mark, one action), `Skeleton`
- [x] `status.tsx`: one `APPLICATION_STATUS` map (saved, applied, interviewing, offered, rejected, withdrawn) replacing three copies of raw palette colors; `ApplicationStatusBadge`
- [x] `PdfStatusBadge` on tokens
- [x] Segmented tabs (`tabListClass`, `tabClass`, `tabCountClass`) and `nativeSelectClass`

## Chunk 4 · Screens ✅
- [x] Two mechanical passes over every app file: the translucent card recipe removed (Card has it now), and ~230 raw palette classes mapped to tokens with the table in chunk 1 (`dark:` variants dropped, tokens switch themselves). 0 raw palette classes left.
- [x] Error alerts, note boxes, empty states and spinners share one look across screens
- [x] Every screen: `PageHeader`, one `cap` (yellow) action, consistent container (`max-w-*`, 16/32 px gutters)
- [x] Import: gained a page heading
- [x] Templates: header, gallery cards (selected = ink ring + cap check), dark-mode fix on the hover button (white text on white)
- [x] Job Inbox: segmented status tabs, styled filters, empty state, mono scores, cap edge on unseen jobs; **"07:00 IST" now shows the user's local time** (the cron is 01:30 UTC, verified)
- [x] Job detail, company detail, new application, resumes, document editor: headers, back links, cap actions; delete moved from solid red to an outline danger button
- [x] Companies: segmented filters, shared status colors; delete button now reachable by keyboard and visible on phones (was hover-only)
- [x] Dashboard: quick-action card folded into the header; StatTiles with area tints
- [x] Generate: gained a page heading; steps use cap for current and ink for done; content now has a container (cards ran edge to edge) that widens on the preview step
- [x] Settings and Profile: headers (redundant "Back to dashboard" removed; Settings is in the sidebar), segmented tabs, cap save
- [x] `ModelDropdown` dark-mode bug (hard-coded `bg-white`) fixed; all native selects on `nativeSelectClass`

## Chunk 5 · Admin ✅
- [x] AdminSidebar rebuilt on the night ground with the cap marker. Fixed two bugs: on phones it started open over the page; collapsing left a 192 px gap because the page padding did not follow. Desktop is now a fixed 256 px panel; phones get a top bar and a sheet.
- [x] All 8 admin pages on `PageHeader`; mono stat numbers
- [ ] **Not visually verified**: needs an admin sign-in, and the owner account is still waiting on the command from the chat. Type-checked only.

## Chunk 6 · QA ✅
- [x] 10 app screens × light, dark, 390 px: no console errors, no horizontal scroll
- [x] axe: 0 serious or critical violations (fixed one: the API key show/hide button had no name and a 16 px target)
- [x] Keyboard: first six tab stops on every screen show a focus ring
- [x] 390 px targets: all ≥ 44 px except accepted exceptions (an inline text link, a checkbox inside a 44 px label, visually hidden file inputs). Phone logo link raised to 44 px.
- [x] Marketing, sign-in and admin sign-in unchanged and clean at desktop and 390 px
- [x] After screenshots in `docs/qa-screenshots/ui-revamp/` (no true "before" set: the old screenshot was CVLeap-branded and removed)

## Follow-ups (not done)
- Check the screens with real data (lists of jobs, applications, resumes) once `hello@himanshurawat.in` can sign in; QA ran on the empty test account.
- Admin screens: visual pass after the owner account exists.
- Title Case labels remain in some card titles and buttons ("Profile Completion", "Create Your First Folder"); a sentence-case copy pass is tone-only and can follow.
- Company cards nest the delete `<button>` inside the card `<a>` (pre-existing, invalid HTML); fixing it changes the click target, so it is left for a behavior pass.

---

## Log
| Date | Chunk | Notes |
| --- | --- | --- |
| 2026-10-22 | — | List created |
| 2026-10-22 | 0 | Tokens, fonts, `cap` color. Caught and fixed a clash: a global `--cap` triplet blanked the logo's yellow cap, so it is named `--brand-cap`. |
| 2026-10-22 | 1 | 10 primitives restyled; Card gained a real style; aceternity removed; tokens global. Checked 9 screens in light, dark and 390 px: no errors, no horizontal scroll. |
| 2026-10-22 | 2 | Night sidebar, shared AppShell, settings and profile folded into the shell. Checked expanded, collapsed, both themes, account menu, phone sheet: no errors. |
| 2026-10-23 | 3 | PageHeader, blocks, status map, tabs, select style. |
| 2026-10-23 | 4 | Palette and card passes over 25 files; 14 screens restyled; fixes: Generate had no container, ModelDropdown and gallery dark-mode bugs, hover-only delete. |
| 2026-10-23 | 5 | Admin sidebar rebuilt (phone overlay and collapse-gap bugs fixed); 8 headers. Not visually verified (no admin login). |
| 2026-10-23 | 6 | QA: 30 screen/theme runs clean; axe 0 serious; one a11y fix; screenshots saved. |
