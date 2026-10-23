import { describe, expect, it } from "vitest";
import {
	GPC_COOKIE,
	hasGpcSignal,
	isGpcEnabled,
	isGpcEnabledInBrowser,
	isGpcHeaderValue,
	shouldLoadNonEssentialTracking,
} from "@/lib/privacy/gpc";
import { CONTACT_RETENTION_MONTHS, contactRetentionNotice } from "@/lib/privacy/retention";
import {
	EXPORT_TABLES,
	escapeHtml,
	exportFilename,
	formatUsDate,
	parseExportFormat,
	renderExportSummaryHtml,
	stripOmittedColumns,
	type AccountExport,
} from "@/lib/account/export";
import {
	accountDeleteSchema,
	chunk,
	confirmationMatches,
	userStoragePrefix,
} from "@/lib/account/delete";
import { buildAiGenerationRow } from "@/lib/ai/generations/log";
import { PROMPT_VERSIONS } from "@/lib/prompts/versions";
import { aiLabelForSource } from "@/lib/ai/generations/labels";

const USER_ID = "6beedc31-1111-4222-8333-444455556666";

describe("Global Privacy Control", () => {
	it("accepts only the value 1", () => {
		expect(isGpcHeaderValue("1")).toBe(true);
		expect(isGpcHeaderValue(" 1 ")).toBe(true);
		expect(isGpcHeaderValue("0")).toBe(false);
		expect(isGpcHeaderValue(null)).toBe(false);
	});

	it("reads the header, forwarded header or cookie", () => {
		expect(hasGpcSignal(new Headers({ "Sec-GPC": "1" }))).toBe(true);
		expect(hasGpcSignal(new Headers({ "x-nm-gpc": "1" }))).toBe(true);
		expect(hasGpcSignal(new Headers())).toBe(false);
		const cookies = { get: (name: string) => (name === GPC_COOKIE ? { value: "1" } : undefined) };
		expect(isGpcEnabled(new Headers(), cookies)).toBe(true);
	});

	it("detects the signal in the browser", () => {
		expect(isGpcEnabledInBrowser({ globalPrivacyControl: true }, "")).toBe(true);
		expect(isGpcEnabledInBrowser({}, `theme=dark; ${GPC_COOKIE}=1`)).toBe(true);
		expect(isGpcEnabledInBrowser({}, `${GPC_COOKIE}=10`)).toBe(false);
		expect(isGpcEnabledInBrowser(undefined, undefined)).toBe(false);
	});

	it("turns off non-essential tracking when GPC is on", () => {
		expect(shouldLoadNonEssentialTracking(true)).toBe(false);
		expect(shouldLoadNonEssentialTracking(false)).toBe(true);
	});
});

describe("contact retention", () => {
	it("keeps messages for 18 months", () => {
		expect(CONTACT_RETENTION_MONTHS).toBe(18);
		expect(contactRetentionNotice()).toContain("18 months");
	});
});

describe("account export", () => {
	it("parses the format", () => {
		expect(parseExportFormat(null)).toBe("json");
		expect(parseExportFormat("html")).toBe("html");
		expect(parseExportFormat("pdf")).toBeNull();
	});

	it("never exports secrets", () => {
		const settings = EXPORT_TABLES.find((spec) => spec.table === "user_settings");
		expect(settings?.omit).toContain("ai_api_key_encrypted");
		expect(
			stripOmittedColumns([{ id: 1, ai_api_key_encrypted: "x" }], settings?.omit)
		).toEqual([{ id: 1 }]);
	});

	it("names files by date", () => {
		expect(exportFilename("json", new Date("2026-10-23T12:00:00Z"))).toBe(
			"nextmilestone-export-2026-10-23.json"
		);
	});

	it("escapes HTML and formats US dates", () => {
		expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe(
			"&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;"
		);
		expect(escapeHtml({ toString: () => "<b>" })).toBe("");
		expect(formatUsDate("2026-10-23T00:00:00Z")).toBe("Oct 23, 2026");
		expect(formatUsDate("nope")).toBe("");
	});

	it("renders a safe printable summary", () => {
		const data: AccountExport = {
			exported_at: "2026-10-23T00:00:00Z",
			format_version: 1,
			account: { id: USER_ID, email: "a@b.co" },
			tables: {
				profiles: [{ full_name: "<script>x</script>" }],
				companies: [{ name: "Acme", job_title: "Engineer", status: "applied", created_at: "2026-10-01T00:00:00Z" }],
			},
			unavailable: ["job_matches"],
		};
		const html = renderExportSummaryHtml(data);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("Acme");
		expect(html).toContain("Oct 1, 2026");
		expect(html).toContain("Job matches");
	});
});

describe("account deletion", () => {
	it("requires the account email, ignoring case and spaces", () => {
		expect(confirmationMatches(" A@B.co ", "a@b.co")).toBe(true);
		expect(confirmationMatches("a@b.co", "c@b.co")).toBe(false);
		expect(confirmationMatches("a@b.co", null)).toBe(false);
	});

	it("validates the body strictly", () => {
		expect(accountDeleteSchema.safeParse({ confirmEmail: "a@b.co" }).success).toBe(true);
		expect(accountDeleteSchema.safeParse({ confirmEmail: "a@b.co", extra: 1 }).success).toBe(false);
		expect(accountDeleteSchema.safeParse({}).success).toBe(false);
	});

	it("only builds a storage prefix for a UUID", () => {
		expect(userStoragePrefix(USER_ID)).toBe(`${USER_ID}/`);
		expect(() => userStoragePrefix("")).toThrow();
		expect(() => userStoragePrefix("../other")).toThrow();
	});

	it("splits keys into batches", () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 1000)).toEqual([]);
		expect(() => chunk([1], 0)).toThrow();
	});
});

describe("AI generation log", () => {
	it("builds a row with the prompt version", () => {
		expect(
			buildAiGenerationRow({ userId: USER_ID, feature: "resume", model: " gpt-4o-mini ", provider: "openai", itemType: "resume" })
		).toEqual({
			user_id: USER_ID,
			feature: "resume",
			model: "gpt-4o-mini",
			provider: "openai",
			prompt_version: PROMPT_VERSIONS.resume,
			item_type: "resume",
			item_ref: null,
		});
	});

	it("falls back when the model is blank and clips long values", () => {
		const row = buildAiGenerationRow({ userId: USER_ID, feature: "cover_letter", model: "", itemRef: "x".repeat(500) });
		expect(row.model).toBe("unknown");
		expect(row.item_ref).toHaveLength(200);
	});

	it("labels documents by source", () => {
		expect(aiLabelForSource("portal")).toBe("AI draft");
		expect(aiLabelForSource("mcp")).toBe("Drafted by your AI assistant");
		expect(aiLabelForSource("import")).toBeNull();
	});
});
