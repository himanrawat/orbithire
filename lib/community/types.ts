/** Shared types, labels and limits for Community (PRD v2, area 6). No server imports. */

export const POST_TYPES = ["milestone", "learning", "question", "link"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_TYPE_LABELS: Readonly<Record<PostType, string>> = {
	milestone: "Milestone",
	learning: "Learning",
	question: "Question",
	link: "Link",
};

/** Must match the CHECK constraint on community_posts.topic. */
export const TOPICS = [
	"career-growth",
	"interviews",
	"job-search",
	"frontend",
	"backend",
	"system-design",
	"leadership",
	"learning",
] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Readonly<Record<Topic, string>> = {
	"career-growth": "Career growth",
	interviews: "Interviews",
	"job-search": "Job search",
	frontend: "Frontend",
	backend: "Backend",
	"system-design": "System design",
	leadership: "Leadership",
	learning: "Learning",
};

export const REPORT_TARGETS = ["post", "reply", "user"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ["spam", "harassment", "hate", "misinformation", "off-topic", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Readonly<Record<ReportReason, string>> = {
	spam: "Spam or self-promotion",
	harassment: "Harassment",
	hate: "Hate or discrimination",
	misinformation: "Misleading information",
	"off-topic": "Off-topic",
	other: "Something else",
};

export const RELATION_ACTIONS = ["follow", "unfollow", "mute", "unmute", "block", "unblock"] as const;
export type RelationAction = (typeof RELATION_ACTIONS)[number];

export const CAREER_STAGE_LABELS: Readonly<Record<string, string>> = {
	student: "Student",
	early: "Early career",
	experienced: "Experienced",
	leader: "Leader",
};

export const COMMUNITY_LIMITS = {
	titleLength: 200,
	bodyLength: 5000,
	urlLength: 2048,
	replyLength: 3000,
	reportDetailsLength: 1000,
	requestNoteLength: 500,
	feedSize: 30,
	/** How many recent posts the For you ranking considers. */
	rankingPool: 200,
	/** Posts older than this drop out of For you. */
	rankingWindowDays: 21,
	viewBatch: 50,
} as const;

export const DEFAULT_LAUNCH_FIELD = "software engineering";

export type CommunityMember = Readonly<{
	userId: string;
	field: string;
	displayName: string;
	status: "active" | "suspended";
	joinedAt: string;
}>;

export type PostAuthor = Readonly<{
	id: string;
	displayName: string;
	headline: string | null;
}>;

export type CommunityPost = Readonly<{
	id: string;
	type: PostType;
	topic: Topic;
	title: string;
	body: string;
	url: string | null;
	helpfulCount: number;
	replyCount: number;
	hidden: boolean;
	createdAt: string;
	author: PostAuthor;
	isOwn: boolean;
	markedHelpful: boolean;
	saved: boolean;
	followingAuthor: boolean;
}>;

export type CommunityReply = Readonly<{
	id: string;
	body: string;
	hidden: boolean;
	createdAt: string;
	author: PostAuthor;
	isOwn: boolean;
}>;

export type PersonAhead = Readonly<{
	userId: string;
	displayName: string;
	headline: string | null;
	careerStage: string | null;
}>;

export function isTopic(value: unknown): value is Topic {
	return typeof value === "string" && (TOPICS as readonly string[]).includes(value);
}

export function isPostType(value: unknown): value is PostType {
	return typeof value === "string" && (POST_TYPES as readonly string[]).includes(value);
}

export function careerStageLabel(stage: string | null | undefined) {
	return stage ? (CAREER_STAGE_LABELS[stage] ?? null) : null;
}
