/**
 * End-to-end smoke test for the NextMilestone MCP server (/api/mcp).
 *
 * Needs: the app running (next dev / start), the worker running (for the PDF
 * step), Supabase reachable with the service role key, and a user that has
 * Job Inbox matches. It creates its own tokens (read+write, read-only,
 * revoked) and a temporary second user, runs the checks with the official
 * SDK client, prints timings, and cleans up (keeps the example resume unless
 * MCP_SMOKE_KEEP_RESUME=0).
 *
 *   MCP_URL=http://localhost:3107/api/mcp MCP_SMOKE_USER_ID=<profile id> \
 *     npx ts-node --transpile-only --project tsconfig.scripts.json scripts/mcp-smoke.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 * Never point this at production: it writes and deletes rows for the user.
 */
import { config as loadEnv } from "dotenv";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

loadEnv({ path: ".env.local" });

const MCP_URL = process.env.MCP_URL || "http://localhost:3000/api/mcp";
const USER_ID = process.env.MCP_SMOKE_USER_ID || "";
const KEEP_RESUME = process.env.MCP_SMOKE_KEEP_RESUME !== "0";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!USER_ID || !SUPABASE_URL || !SERVICE_KEY) {
	console.error("Set MCP_SMOKE_USER_ID, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
	process.exit(2);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let failures = 0;
const timings: [string, number][] = [];
function check(name: string, cond: boolean, detail = "") {
	console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` – ${detail}` : ""}`);
	if (!cond) failures++;
}
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
	const t0 = Date.now();
	try {
		return await fn();
	} finally {
		timings.push([label, Date.now() - t0]);
	}
}

async function makeToken(userId: string, name: string, scopes: string[], revoked = false) {
	const token = "orb_" + randomBytes(32).toString("base64url");
	const { data, error } = await db
		.from("mcp_tokens")
		.insert({
			user_id: userId,
			name,
			token_hash: createHash("sha256").update(token).digest("hex"),
			token_prefix: token.slice(0, 12),
			scopes,
			revoked_at: revoked ? new Date().toISOString() : null,
		})
		.select("id")
		.single();
	if (error) throw new Error(`token insert: ${error.message}`);
	return { token, id: data.id as string };
}

async function connect(token: string, name = "claude-ai") {
	const client = new Client({ name, version: "smoke" });
	const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
		requestInit: { headers: { Authorization: `Bearer ${token}` } },
	});
	await client.connect(transport);
	return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function body(res: any): any {
	const text = res?.content?.[0]?.text ?? "";
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

const SAMPLE_RESUME = {
	basics: {
		name: "Test Candidate",
		label: "Frontend Engineer",
		email: "test@orbithire.local",
		phone: "+91 98765 43210",
		location: "Ghaziabad, Delhi NCR, India",
		summary:
			"Frontend engineer with 4+ years building React and TypeScript interfaces for SaaS dashboards and AI-powered workflow tools. Owns features from Figma to production, with a focus on design systems, accessibility and clear error and recovery states.",
		profiles: [{ network: "LinkedIn", url: "https://linkedin.com/in/test-candidate" }],
	},
	work: [
		{
			name: "Sysmind Tech",
			position: "Design Engineer",
			location: "Noida, India",
			startDate: "2025-01",
			highlights: [
				"Lead design and frontend implementation for customer, admin and partner experiences of an AI workplace collaboration platform",
				"Build React, TypeScript and Next.js interfaces for live data, processing states, failures and recovery paths",
				"Guide a five-engineer frontend team; defined design tokens, accessibility criteria and reusable components",
			],
		},
		{
			name: "Webiosis Systems",
			position: "UI/UX Developer",
			startDate: "2024-01",
			endDate: "2025-01",
			highlights: [
				"Owned design-to-code for a zero-to-one school ERP spanning 50+ production screens",
				"Built a documented React and Tailwind CSS component library",
			],
		},
	],
	education: [{ institution: "Example University", studyType: "M.Sc.", area: "Computer Applications", endDate: "2022" }],
	skills: [
		{ name: "Frontend", keywords: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Accessibility"] },
		{ name: "Design", keywords: ["Figma", "Design systems", "Prototyping"] },
	],
	meta: { sectionOrder: ["summary", "experience", "skills", "education"] },
};

async function main() {
	const created = { tokens: [] as string[], resumes: [] as string[], letters: [] as string[], companies: [] as string[], otherUser: "" };
	const startedAt = new Date().toISOString();
	try {
		const rw = await makeToken(USER_ID, "smoke rw", ["read", "write"]);
		const ro = await makeToken(USER_ID, "smoke ro", ["read"]);
		const revoked = await makeToken(USER_ID, "smoke revoked", ["read", "write"], true);
		created.tokens.push(rw.id, ro.id, revoked.id);

		// ---- auth failures (raw HTTP)
		const init = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw", version: "0" } },
		};
		const post = (headers: Record<string, string>) =>
			fetch(MCP_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
				body: JSON.stringify(init),
			});
		const noTok = await post({});
		check("no token → 401 + WWW-Authenticate", noTok.status === 401 && /^Bearer /.test(noTok.headers.get("www-authenticate") || ""), noTok.headers.get("www-authenticate") || "");
		const badTok = await post({ Authorization: `Bearer ${revoked.token}` });
		const badTokenBody = (await badTok.json()) as { error?: { message?: string } };
		check("revoked token → 401 invalid_token", badTok.status === 401 && /invalid_token/.test(badTok.headers.get("www-authenticate") || ""), badTokenBody.error?.message);
		const junk = await post({ Authorization: "Bearer orb_nope" });
		check("malformed token → 401", junk.status === 401);
		const get = await fetch(MCP_URL, { headers: { Authorization: `Bearer ${rw.token}` } });
		check("GET → 405 (stateless)", get.status === 405);

		// ---- main flow
		const client = await timed("initialize", () => connect(rw.token));
		const tools = await timed("tools/list", () => client.listTools());
		const names = tools.tools.map((t) => t.name).sort();
		check("tools/list has 12 tools", names.length === 12, names.join(", "));
		const prompts = await timed("prompts/list", () => client.listPrompts());
		check("prompts/list", prompts.prompts.map((p) => p.name).sort().join() === "tailor_resume,write_cover_letter");

		const search = body(await timed("search_jobs", () => client.callTool({ name: "search_jobs", arguments: { limit: 5 } })));
		check("search_jobs returns jobs", search.count > 0, `${search.count} jobs; top: ${search.jobs?.[0]?.title} @ ${search.jobs?.[0]?.company}`);
		const q = body(await client.callTool({ name: "search_jobs", arguments: { query: "engineer", status: "any", limit: 3 } }));
		check("search_jobs text query", Array.isArray(q.jobs), `${q.count} match 'engineer'`);
		const jobId: string = search.jobs[0].job_id;

		const job = body(await timed("get_job", () => client.callTool({ name: "get_job", arguments: { job_id: jobId } })));
		check("get_job", job.job_id === jobId, `${job.title}; description ${job.description ? job.description.length : 0} chars`);

		const prompt = await timed("prompts/get tailor_resume", () => client.getPrompt({ name: "tailor_resume", arguments: { job_id: jobId } }));
		const ptext = (prompt.messages[0].content as { text: string }).text;
		check("tailor_resume prompt embeds job + rules", ptext.includes(jobId) && ptext.includes("untrusted") && ptext.includes("save_resume"), `${ptext.length} chars`);
		const cprompt = await client.getPrompt({ name: "write_cover_letter", arguments: { job_id: jobId } });
		check("write_cover_letter prompt", (cprompt.messages[0].content as { text: string }).text.includes("save_cover_letter"));

		const schema = body(await client.callTool({ name: "get_resume_schema", arguments: {} }));
		check("get_resume_schema", schema.resume?.type === "object" && !!schema.cover_letter);
		const templates = body(await client.callTool({ name: "list_templates", arguments: { kind: "resume" } }));
		check("list_templates", templates.templates?.length >= 4, templates.templates?.map((t: { template_id: string }) => t.template_id).join(", "));
		const prof = body(await client.callTool({ name: "get_profile", arguments: {} }));
		check("get_profile", typeof prof.is_empty === "boolean", `is_empty=${prof.is_empty}`);

		const invalid = await client.callTool({
			name: "save_resume",
			arguments: { resume: { basics: { name: "X" }, work: [{ company: "Acme", title: "Dev", bullets: ["a"] }] } },
		});
		const invalidText = (invalid.content as { text: string }[])[0].text;
		check("save_resume rejects invalid JSON Resume with hints", invalid.isError === true && invalidText.includes('use "name"'), invalidText.split("\n").slice(0, 3).join(" | "));

		const saved = body(
			await timed("save_resume", () =>
				client.callTool({ name: "save_resume", arguments: { resume: SAMPLE_RESUME, job_id: jobId, template_id: "modern" } })
			)
		);
		check("save_resume", !!saved.document_id && saved.pdf_status === "queued", `doc ${saved.document_id}, application ${saved.application_id} (created=${saved.application_created})`);
		created.resumes.push(saved.document_id);
		if (saved.application_created) created.companies.push(saved.application_id);

		const t0 = Date.now();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let doc: any = null;
		let polls = 0;
		while (Date.now() - t0 < 90_000) {
			polls++;
			doc = body(await client.callTool({ name: "get_document", arguments: { document_id: saved.document_id } }));
			if (doc.pdf_status === "ready" || doc.pdf_status === "failed") break;
			await new Promise((r) => setTimeout(r, 500));
		}
		timings.push(["save_resume → pdf ready", Date.now() - t0]);
		check("PDF ready", doc?.pdf_status === "ready", `${polls} polls, ${doc?.pdf_status}${doc?.pdf_error ? `: ${doc.pdf_error}` : ""}`);
		if (doc?.download_url) {
			const pdf = await fetch(doc.download_url);
			const buf = Buffer.from(await pdf.arrayBuffer());
			check("download_url serves a PDF", pdf.ok && buf.subarray(0, 4).toString() === "%PDF", `${buf.length} bytes`);
		} else {
			check("download_url present", false);
		}

		const db1 = await db.from("resumes").select("source, source_client, engine, company_id, job_posting_id").eq("id", saved.document_id).single();
		check("resume row: source=mcp, client, engine=typst, links", db1.data?.source === "mcp" && db1.data?.source_client === "claude" && db1.data?.engine === "typst" && !!db1.data?.company_id && !!db1.data?.job_posting_id, JSON.stringify(db1.data));
		const ver = await db.from("document_versions").select("version, source").eq("document_id", saved.document_id);
		check("document_versions row", ver.data?.length === 1 && ver.data[0].source === "mcp");

		const letter = body(
			await timed("save_cover_letter", () =>
				client.callTool({
					name: "save_cover_letter",
					arguments: {
						job_id: jobId,
						resume_id: saved.document_id,
						letter: {
							salutation: "Dear Hiring Manager,",
							paragraphs: [
								`I am applying for the ${job.title} role at ${job.company}.`,
								"At Sysmind Tech I lead design and frontend implementation for an AI workplace platform.",
								"Thank you for your consideration.",
							],
							closing: "Sincerely,",
						},
					},
				})
			)
		);
		check("save_cover_letter", !!letter.document_id && letter.application_id === saved.application_id, `doc ${letter.document_id}`);
		created.letters.push(letter.document_id);

		const apps = body(await client.callTool({ name: "get_application", arguments: { application_id: saved.application_id } }));
		check("get_application lists both documents", apps.resumes?.length >= 1 && apps.cover_letters?.length >= 1 && apps.job_id === jobId);
		const again = body(await client.callTool({ name: "create_application", arguments: { job_id: jobId } }));
		check("create_application is idempotent", again.created === false && again.application_id === saved.application_id);
		const st = body(await client.callTool({ name: "update_application_status", arguments: { application_id: saved.application_id, status: "applied" } }));
		check("update_application_status", st.changed === true && st.status === "applied", `${st.from} → ${st.status}`);
		const list = body(await client.callTool({ name: "list_applications", arguments: { status: "applied" } }));
		check("list_applications", list.applications?.some((a: { application_id: string }) => a.application_id === saved.application_id));

		const acts = await db.from("user_activities").select("event_type").eq("user_id", USER_ID).like("event_type", "mcp.%").gte("created_at", startedAt);
		check("writes logged in user_activities", (acts.data?.length ?? 0) >= 3, (acts.data || []).map((a) => a.event_type).join(", "));
		const tok = await db.from("mcp_tokens").select("last_used_at, last_client").eq("id", rw.id).single();
		check("token last_used_at + last_client", !!tok.data?.last_used_at && tok.data?.last_client === "claude-ai", JSON.stringify(tok.data));
		await client.close();

		// ---- read-only token
		const roClient = await connect(ro.token, "claude-code");
		const roWrite = await roClient.callTool({ name: "save_resume", arguments: { resume: SAMPLE_RESUME } });
		check("read-only token cannot write", roWrite.isError === true && /read-only/.test((roWrite.content as { text: string }[])[0].text));
		const roRead = body(await roClient.callTool({ name: "search_jobs", arguments: { limit: 1 } }));
		check("read-only token can read", roRead.count >= 0);
		await roClient.close();

		// ---- another user's ids → not found
		const email = `mcp-smoke-${Date.now()}@orbithire.local`;
		const other = await db.auth.admin.createUser({ email, password: randomBytes(12).toString("hex"), email_confirm: true });
		if (other.error || !other.data.user) throw new Error(`createUser: ${other.error?.message}`);
		created.otherUser = other.data.user.id;
		const otherTok = await makeToken(created.otherUser, "smoke other", ["read", "write"]);
		created.tokens.push(otherTok.id);
		const oc = await connect(otherTok.token);
		const probes: [string, Record<string, unknown>][] = [
			["get_job", { job_id: jobId }],
			["get_document", { document_id: saved.document_id }],
			["get_application", { application_id: saved.application_id }],
			["update_application_status", { application_id: saved.application_id, status: "rejected" }],
			["create_application", { job_id: jobId }],
			["save_resume", { resume: SAMPLE_RESUME, job_id: jobId }],
		];
		for (const [name, args] of probes) {
			const r = await oc.callTool({ name, arguments: args });
			check(`other user: ${name} → not found`, r.isError === true && /not found/i.test((r.content as { text: string }[])[0].text));
		}
		const os = body(await oc.callTool({ name: "search_jobs", arguments: { status: "any" } }));
		check("other user: search_jobs sees none of the test user's jobs", os.count === 0);
		await oc.close();
		const stillMine = await db.from("companies").select("status").eq("id", saved.application_id).single();
		check("test user's application untouched", stillMine.data?.status === "applied");
	} finally {
		// ---- cleanup
		const keep = KEEP_RESUME ? created.resumes[0] : null;
		const dropResumes = created.resumes.filter((id) => id !== keep);
		if (created.letters.length) await db.from("cover_letters").delete().in("id", created.letters).eq("user_id", USER_ID);
		if (dropResumes.length) await db.from("resumes").delete().in("id", dropResumes).eq("user_id", USER_ID);
		if (created.companies.length) {
			await db.from("job_matches").update({ company_id: null, status: "new" }).in("company_id", created.companies).eq("user_id", USER_ID);
			await db.from("companies").delete().in("id", created.companies).eq("user_id", USER_ID);
		}
		await db.from("user_activities").delete().eq("user_id", USER_ID).like("event_type", "mcp.%").gte("created_at", startedAt);
		await db.from("tasks").delete().eq("user_id", USER_ID).eq("type", "render_pdf").gte("created_at", startedAt).neq("payload->>document_id", keep ?? "");
		if (created.tokens.length) await db.from("mcp_tokens").delete().in("id", created.tokens);
		if (created.otherUser) await db.auth.admin.deleteUser(created.otherUser);
		console.log(`\ncleanup done${keep ? ` (kept example resume ${keep})` : ""}`);
	}

	console.log("\nTimings (ms):");
	for (const [label, ms] of timings) console.log(`  ${label.padEnd(28)} ${ms}`);
	console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
	process.exit(failures ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
