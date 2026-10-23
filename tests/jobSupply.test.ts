import { describe, expect, it } from "vitest";
import {
	SOURCE_REGISTRY,
	sourceAttribution,
	sourceEnabledByDefault,
	sourceLabel,
	sourcePolicy,
} from "@/lib/jobs/sourceRegistry";
import { API_SOURCE_IDS, ATS_TYPES, JOB_SITES, defaultSitesFor, defaultSourcesFor } from "@/lib/jobs/types";
import { TASK_TYPES, isTaskType } from "@/lib/taskTypes";

describe("job source registry", () => {
	it("records a legal basis for every source", () => {
		const ids = new Set(SOURCE_REGISTRY.map((s) => s.id));
		for (const id of [...API_SOURCE_IDS, ...JOB_SITES, ...ATS_TYPES]) {
			expect(ids.has(id), id).toBe(true);
		}
		expect(SOURCE_REGISTRY.every((s) => s.legalBasis.length > 0)).toBe(true);
		expect(ids.size).toBe(SOURCE_REGISTRY.length);
	});

	it("gates terms-restricted and India-only sources", () => {
		expect(["linkedin", "glassdoor", "indeed"].every((id) => sourcePolicy(id)?.tosRestricted)).toBe(true);
		expect(["naukri", "instahyre", "cutshort"].every((id) => sourcePolicy(id)?.indiaOnly)).toBe(true);
		expect(sourceEnabledByDefault("linkedin")).toBe(false);
		expect(sourceEnabledByDefault("naukri")).toBe(false);
		expect(sourceEnabledByDefault("greenhouse")).toBe(true);
		expect(sourceEnabledByDefault("google")).toBe(true);
	});

	it("credits aggregators that require attribution", () => {
		expect(sourceAttribution("remoteok", "https://remoteok.com/remote-jobs/1")).toEqual({
			label: "Remote OK",
			href: "https://remoteok.com/remote-jobs/1",
		});
		expect(sourceAttribution("himalayas", null)).toEqual({ label: "Himalayas", href: "https://himalayas.app" });
		expect(sourceAttribution("jobicy", "https://jobicy.com/jobs/1")?.label).toBe("Jobicy");
		expect(sourceAttribution("greenhouse", "https://boards.greenhouse.io/acme/jobs/1")).toBeNull();
		expect(sourceLabel("usajobs")).toBe("USAJOBS");
		expect(sourceLabel("something-new")).toBe("something-new");
	});
});

describe("job search defaults (US-first)", () => {
	it("never preselects restricted or India-only boards", () => {
		for (const country of ["US", "IN", "GB"]) {
			const sites = defaultSitesFor(country);
			expect(sites.every((s) => sourceEnabledByDefault(s))).toBe(true);
			const sources = defaultSourcesFor(country);
			expect(sources.every((s) => sourceEnabledByDefault(s))).toBe(true);
			expect(sources.length).toBeGreaterThan(0);
		}
	});

	it("leaves Remotive opt-in", () => {
		expect(defaultSourcesFor("US")).not.toContain("remotive");
	});
});

describe("task types", () => {
	it("include the shared watchlist fetch", () => {
		expect(TASK_TYPES).toContain("fetch_watchlist");
		expect(isTaskType("fetch_watchlist")).toBe(true);
	});
});
