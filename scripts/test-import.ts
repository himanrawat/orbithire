/**
 * Tests for the import helpers in lib/import (no TS test runner in this repo).
 *
 *   npx ts-node -T --project tsconfig.scripts.json scripts/test-import.ts
 *
 * Optional: AI_JOB_SEARCH_DIR=~/Desktop/ai-job-search also runs the real tracker
 * CSV / CLAUDE.md through the parsers (read-only).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseCsv, parseCsvObjects } from "../lib/import/csv";
import { IMPORT_MARKER, mapTrackerRow, mapTrackerStatus, planTrackerImport, summarizePlan } from "../lib/import/tracker";
import { importFileKey, matchPdfFilename, parsePdfFilename } from "../lib/import/filenames";
import { diffProfile, parseClaudeProfile, toYearMonth } from "../lib/import/profile";
import { diffDocuments } from "../lib/documentDiff";

let passed = 0;
function test(name: string, fn: () => void) {
	try {
		fn();
		passed++;
		console.log(`ok   ${name}`);
	} catch (err) {
		console.error(`FAIL ${name}`);
		throw err;
	}
}

const HEADER =
	"date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline";
const CSV = [
	HEADER,
	'2026-10-20,Anthropic,Artificial Intelligence,"Product Designer, Safeguards",Product Design,online,drafted,,88,"Visa needed; ""quoted""",cv/main_anthropic_product_designer_safeguards.pdf,cover_letters/cover_anthropic_product_designer_safeguards.pdf,https://job-boards.greenhouse.io/anthropic/jobs/1,',
	"2026-10-18,Elastic,Software,UX Engineer,UX Engineering,online,applied,Jane Doe,94,,cv/main_elastic_ux_engineer.pdf,,https://jobs.elastic.co/x,2026-11-01",
	"2026-10-17,Acme,Software,Engineer,,referral,no response,,,,,,LinkedIn,",
	"2026-10-17,Acme,Software,Engineer,,referral,applied,,,,,,LinkedIn,",
	",,,,,,,,,,,,,",
].join("\n");

test("csv: quotes, escaped quotes, blank lines", () => {
	const rows = parseCsv('a,b\n"x, y","he said ""hi"""\r\n\n1,2');
	assert.deepEqual(rows, [["a", "b"], ["x, y", 'he said "hi"'], ["1", "2"]]);
	assert.equal(parseCsvObjects(CSV).length, 4, "all-empty row dropped");
});

test("status mapping follows the tracker vocabulary", () => {
	assert.equal(mapTrackerStatus("drafted").status, "saved");
	assert.equal(mapTrackerStatus("applied").status, "applied");
	assert.equal(mapTrackerStatus("interview").status, "interviewing");
	assert.equal(mapTrackerStatus("offer").status, "offered");
	assert.equal(mapTrackerStatus("hired").status, "offered");
	assert.equal(mapTrackerStatus("no response").status, "rejected");
	assert.equal(mapTrackerStatus("no_response").status, "rejected");
	assert.equal(mapTrackerStatus("offer declined").status, "withdrawn");
	assert.equal(mapTrackerStatus("withdrawn").status, "withdrawn");
	assert.deepEqual(mapTrackerStatus("weird"), { status: "saved", known: false });
});

test("row mapping", () => {
	const [first, second, third] = parseCsvObjects(CSV);
	const a = mapTrackerRow(first)!;
	assert.equal(a.name, "Anthropic");
	assert.equal(a.job_title, "Product Designer, Safeguards");
	assert.equal(a.status, "saved");
	assert.equal(a.applied_at, null, "drafted rows are not applied");
	assert.equal(a.job_url, "https://job-boards.greenhouse.io/anthropic/jobs/1");
	assert.equal(a.industry, "Artificial Intelligence");
	assert.ok(a.notes.startsWith(IMPORT_MARKER));
	assert.ok(a.notes.includes("Fit rating: 88"));
	assert.ok(a.notes.includes('Visa needed; "quoted"'));
	assert.ok(a.notes.includes("CV file: cv/main_anthropic_product_designer_safeguards.pdf"));
	const b = mapTrackerRow(second)!;
	assert.equal(b.status, "applied");
	assert.equal(b.applied_at, "2026-10-18T00:00:00.000Z");
	assert.equal(b.recruiter_name, "Jane Doe");
	assert.ok(b.notes.includes("Deadline: 2026-11-01"));
	const c = mapTrackerRow(third)!;
	assert.equal(c.job_url, null);
	assert.ok(c.notes.includes("Source: LinkedIn"));
	assert.equal(mapTrackerRow({ company: "" }), null);
});

test("plan: create, in-file duplicate, idempotent re-run, update fills gaps", () => {
	const plan = planTrackerImport(CSV, []);
	assert.deepEqual(summarizePlan(plan), { total: 4, create: 3, update: 0, skip: 1 });
	assert.equal(plan[3].reason, "Duplicate row in the CSV");

	// Re-run against what the first run created -> all skip
	const existing = plan
		.filter((p) => p.action === "create")
		.map((p, i) => ({ id: `id${i}`, ...(p.changes as any) }));
	const again = planTrackerImport(CSV, existing);
	assert.deepEqual(summarizePlan(again), { total: 4, create: 0, update: 0, skip: 4 });

	// Hand-made application (case differs) gets the tracker info + status advanced
	const manual = [
		{ id: "m1", name: "elastic", job_title: "ux engineer", status: "saved", notes: "my note", job_url: null, industry: null, recruiter_name: null, applied_at: null },
		{ id: "m2", name: "Anthropic", job_title: "Product Designer, Safeguards", status: "interviewing", notes: null, job_url: "https://x", industry: "AI", recruiter_name: null, applied_at: null },
	];
	const upd = planTrackerImport(CSV, manual);
	const elastic = upd.find((p) => p.mapped.name === "Elastic")!;
	assert.equal(elastic.action, "update");
	assert.equal(elastic.existingId, "m1");
	assert.equal(elastic.changes.status, "applied");
	assert.ok(String(elastic.changes.notes).startsWith("my note\n\n" + IMPORT_MARKER));
	const anthropic = upd.find((p) => p.mapped.name === "Anthropic")!;
	assert.equal(anthropic.changes.status, undefined, "never moves status backwards");
	assert.equal(anthropic.changes.job_url, undefined, "never overwrites a filled field");
});

const COMPANIES = [
	{ id: "c1", name: "Anthropic", job_title: "Product Designer, Claude Developer Platform", notes: null },
	{ id: "c2", name: "Anthropic", job_title: "Product Designer, Safeguards", notes: null },
	{ id: "c3", name: "CDW", job_title: "Product Designer-1", notes: null },
	{ id: "c4", name: "Scope AI", job_title: "Product Designer", notes: null },
	{ id: "c5", name: "Cal.com", job_title: "Design Engineer", notes: null },
	{ id: "c6", name: "Postman", job_title: "Software Engineer", notes: "Imported from job_search_tracker.csv\nCV file: cv/main_postman_software_engineer_frontend_ui.pdf" },
];

test("filename parsing", () => {
	assert.deepEqual(parsePdfFilename("cv/main_elastic_ux_engineer.pdf"), { kind: "resume", slug: "elastic_ux_engineer" });
	assert.deepEqual(parsePdfFilename("cover_elastic_ux_engineer.PDF"), { kind: "cover_letter", slug: "elastic_ux_engineer" });
	assert.equal(parsePdfFilename("My Cover Letter.pdf").kind, "cover_letter");
});

test("filename matching", () => {
	const m1 = matchPdfFilename("main_anthropic_product_designer_safeguards.pdf", COMPANIES);
	assert.equal(m1.companyId, "c2");
	assert.equal(m1.confidence, "exact");
	assert.equal(m1.title, "CV – Anthropic – Product Designer, Safeguards (imported)");
	assert.equal(matchPdfFilename("cover_anthropic_product_designer_claude_developer_platform.pdf", COMPANIES).companyId, "c1");
	assert.equal(matchPdfFilename("main_cdw_product_designer_1.pdf", COMPANIES).confidence, "exact");
	assert.equal(matchPdfFilename("main_scope_ai_product_designer.pdf", COMPANIES).companyId, "c4");
	const cal = matchPdfFilename("main_calcom_senior_product_design_engineer.pdf", COMPANIES);
	assert.equal(cal.companyId, "c5");
	assert.equal(cal.confidence, "role");
	const tr = matchPdfFilename("main_postman_software_engineer_frontend_ui.pdf", COMPANIES);
	assert.equal(tr.confidence, "tracker");
	assert.equal(tr.companyId, "c6");
	const none = matchPdfFilename("main_gitlab_senior_frontend_engineer.pdf", COMPANIES);
	assert.equal(none.companyId, null);
	assert.equal(none.confidence, "none");
	assert.equal(none.title, "CV – Gitlab Senior Frontend Engineer (imported)");
	assert.equal(matchPdfFilename("main_example.pdf", COMPANIES).suggestSkip, true);
	// a company name that is only a prefix of a longer word must not match ("cal" vs "calcom")
	assert.equal(matchPdfFilename("main_calcom_x.pdf", [{ id: "z", name: "Cal", job_title: "X" }]).companyId, null);
	assert.equal(importFileKey("u1", "resume", "cv/Main_Elastic UX.pdf"), "u1/resumes/import-main-elastic-ux.pdf");
	assert.equal(importFileKey("u1", "cover_letter", "cover_x.pdf"), "u1/cover-letters/import-cover-x.pdf");
});

const MD = `# Assistant
## Candidate Profile
### Identity
- **Name:** Jane Roe
- **Location:** Pune, India (open to remote work anywhere in India)
- **LinkedIn headline:** "Frontend Engineer | Design Systems"
### Education
<!-- comment -->
- **M.Sc. in CS** (completed 2022) - Some University
### Professional Experience
- **Design Engineer** (Jan 2025 - Present) - **Acme (Widgets)**
  - Built things.
  - Led **five** people.
- **Web Developer** (Aug 2021 - Jan 2024) - **Foo Ltd**
  - Shipped CRM.
### Technical Skills
- **Primary:** React, TypeScript, design systems (tokens, components), accessibility
- **Secondary:** Python, React
### Target Sectors
- Product and SaaS: UX Engineer, Design Engineer, and frontend-focused full-stack roles.
### Deal-breakers
- Compensation below INR 12 lakh per annum.
`;

test("profile parsing", () => {
	assert.equal(toYearMonth("Jan 2025"), "2025-01");
	assert.equal(toYearMonth("Present"), null);
	assert.equal(toYearMonth("completed 2022"), "2022");
	const p = parseClaudeProfile(MD, "Jane Roe\nPune\n+91 99999 88888 • jane@janeroe.dev\njaneroe.dev, LinkedIn\nFrontend engineer with five years of experience building accessible interfaces for complex products and design systems at scale.\nSkills\nReact");
	assert.equal(p.full_name, "Jane Roe");
	assert.equal(p.location, "Pune, India");
	assert.deepEqual(p.preferred_locations, ["Pune, India", "India", "Remote"]);
	assert.equal(p.headline, "Frontend Engineer | Design Systems");
	assert.equal(p.work_experience?.length, 2);
	assert.equal(p.work_experience?.[0].company, "Acme (Widgets)");
	assert.equal(p.work_experience?.[0].start_date, "2025-01");
	assert.equal(p.work_experience?.[0].end_date, null);
	assert.equal(p.work_experience?.[0].description, "• Built things.\n• Led five people.");
	assert.equal(p.work_experience?.[1].end_date, "2024-01");
	assert.deepEqual(p.education?.map((e) => [e.degree, e.institution, e.end_date]), [["M.Sc. in CS", "Some University", "2022"]]);
	assert.deepEqual(p.skills, ["React", "TypeScript", "design systems (tokens, components)", "accessibility", "Python"]);
	assert.deepEqual(p.target_job_titles, ["UX Engineer", "Design Engineer"]);
	assert.equal(p.salary_range, "INR 12 LPA+ (minimum)");
	assert.equal(p.phone, "+91 99999 88888");
	assert.equal(p.portfolio_url, "https://janeroe.dev");
	assert.ok(p.experience_summary?.startsWith("Frontend engineer with five years"));

	const diff = diffProfile({ full_name: "Jane Roe", location: "", skills: ["React"] }, p);
	const byField = Object.fromEntries(diff.map((d) => [d.field, d]));
	assert.equal(byField.full_name.changed, false);
	assert.equal(byField.full_name.defaultSelected, false);
	assert.equal(byField.location.defaultSelected, true, "empty current -> preselected");
	assert.equal(byField.skills.changed, true);
	assert.equal(byField.skills.defaultSelected, false, "non-empty current is never preselected");
});

test("document version diff", () => {
	const v1 = { basics: { name: "A", summary: "Old summary" }, work: [{ name: "Acme", position: "Dev", highlights: ["x", "y"] }], meta: { paper: "a4" } };
	const v2 = { basics: { name: "A", summary: "New summary", label: "Engineer" }, work: [{ name: "Acme", position: "Dev", highlights: ["x", "z"] }], meta: { paper: "a4" } };
	const d = diffDocuments(v1, v2);
	const by = Object.fromEntries(d.map((x) => [x.section, x]));
	assert.deepEqual(Object.keys(by).sort(), ["Experience", "Headline", "Summary"]);
	assert.equal(by.Headline.status, "added");
	assert.deepEqual(by.Summary.removed, ["Old summary"]);
	assert.deepEqual(by.Summary.added, ["New summary"]);
	assert.deepEqual(by.Experience.removed, ["  • y"]);
	assert.deepEqual(by.Experience.added, ["  • z"]);
	assert.deepEqual(diffDocuments(v1, v1), []);
	const letter = diffDocuments({ paragraphs: ["a", "b"] }, { paragraphs: ["a", "c"], closing: "Best," });
	assert.deepEqual(letter.map((x) => [x.section, x.status]), [["Body", "changed"], ["Closing", "added"]]);
});

const dir = process.env.AI_JOB_SEARCH_DIR;
if (dir) {
	test("real tracker CSV + CLAUDE.md (read-only)", () => {
		const csv = fs.readFileSync(path.join(dir, "job_search_tracker.csv"), "utf8");
		const plan = planTrackerImport(csv, []);
		console.log("     tracker plan:", summarizePlan(plan));
		assert.ok(plan.length > 0);
		const p = parseClaudeProfile(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"));
		console.log("     profile fields:", Object.keys(p).join(", "));
		assert.ok(p.full_name && p.work_experience?.length);
	});
}

console.log(`\n${passed} tests passed`);
