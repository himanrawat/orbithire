// Shared by the FAQ section and the page's FAQPage structured data.
export type FaqItem = { id: string; q: string; a: string };

export const FAQS: readonly FaqItem[] = [
	{
		id: "who",
		q: "Who is NextMilestone for?",
		a: "Students, early-career professionals, experienced people and leaders. Everyone gets the same app; your career stage changes what comes first on Today, not where things are.",
	},
	{
		id: "phone",
		q: "Is there a phone app?",
		a: "NextMilestone installs from your browser on iOS and Android, so there is nothing to download from a store. The focus timer and quick logging keep working offline and sync when you're back.",
	},
	{
		id: "questions",
		q: "Where do the interview questions come from?",
		a: "“Most asked” comes from people who report the questions they were asked after real interviews, plus curated sets for each role. Every question shows its source, and we don't use scraped interview content.",
	},
	{
		id: "ai",
		q: "What does the AI do, and what stays with me?",
		a: "AI drafts practice feedback, plans and tailored resumes. Each draft is labeled until you accept it, and nothing is sent, applied for or published without you.",
	},
	{
		id: "privacy",
		q: "Who can see my milestones?",
		a: "You choose per milestone: public or private. Things like “open to roles” are visible only to you, and you can preview your profile as the public sees it.",
	},
	{
		id: "where",
		q: "Which countries does it work in?",
		a: "The United States first, with pay in dollars. Canada, the UK, Europe and Australia follow, with local job sources and currencies.",
	},
];

// One set per inner page, shown on that page and grouped together on /faq.
export const TODAY_FAQS: readonly FaqItem[] = [
	{
		id: "when",
		q: "When is the plan made?",
		a: "Each morning at 6:30 AM in your time zone, so it's ready when you open the app. It updates during the day as you finish or skip items.",
	},
	{
		id: "skip",
		q: "What happens if I skip a day?",
		a: "Nothing. There are no streaks to break and no reminders about what you missed. The next plan starts from where you are.",
	},
	{
		id: "count",
		q: "Why only 3 to 5 items?",
		a: "A short plan gets done. Everything else is one click away in its own area, and Today shows it when it becomes the most useful thing.",
	},
	{
		id: "keyboard",
		q: "Can I use it from the keyboard?",
		a: "Yes. Press ⌘K (Ctrl K on Windows) to jump anywhere, and everything on Today works without a mouse.",
	},
];

export const PREP_FAQS: readonly FaqItem[] = [
	{
		id: "voice",
		q: "Can I answer out loud?",
		a: "Yes. Speak your answer and it's transcribed so you can edit it before asking for feedback, or type it if you prefer.",
	},
	{
		id: "feedback",
		q: "How does the AI feedback work?",
		a: "You get one strength, one gap and one thing to read next. It's labeled as an AI draft, and you can accept it, edit it or mark it wrong.",
	},
	{
		id: "report",
		q: "Can I add the questions I was asked?",
		a: "Yes. After an interview you can report the questions you were asked. Reports are what “Most asked” is built from, and they help everyone preparing for the same role.",
	},
	{
		id: "today",
		q: "Does it know when my interview is?",
		a: "If the interview is on your calendar, Today puts practice for that role first in the days before it.",
	},
];

export const FOCUS_FAQS: readonly FaqItem[] = [
	{
		id: "offline",
		q: "Does the timer work offline?",
		a: "Yes. The focus timer keeps running without a connection and syncs your minutes when you're back online.",
	},
	{
		id: "calendar",
		q: "Which calendars can I connect?",
		a: "Google Calendar at launch. Focus blocks appear on it, and interviews from it show up on Today.",
	},
	{
		id: "notifications",
		q: "Does it block other apps?",
		a: "No. NextMilestone holds its own notifications during a session. For other apps, use your phone's focus mode alongside it.",
	},
	{
		id: "streaks",
		q: "Are there streaks?",
		a: "No. Minutes count towards a goal you set, and a quiet week is never mentioned. Progress, not pressure.",
	},
];

export const JOBS_FAQS: readonly FaqItem[] = [
	{
		id: "sources",
		q: "Where do the jobs come from?",
		a: "Hundreds of US employers' career pages, plus public job APIs. We only use sources whose terms allow it, and duplicates of the same role are merged into one.",
	},
	{
		id: "score",
		q: "How is the match score worked out?",
		a: "From the skills, experience, location and pay on your profile against what the role asks for. Each score shows what helped and what's missing.",
	},
	{
		id: "apply",
		q: "Will it apply to jobs for me?",
		a: "No. You decide where to apply and you send every application. AI drafts a tailored resume when you shortlist a role, and you edit it before using it.",
	},
	{
		id: "paths",
		q: "What can I learn?",
		a: "Four launch paths at first, with short lessons you can do in a focus block. You can log things you learned elsewhere too.",
	},
];

export const COMMUNITY_FAQS: readonly FaqItem[] = [
	{
		id: "join",
		q: "How do I join the community?",
		a: "It's invite-only at launch. Sign up and you'll be added as groups open, starting in the US.",
	},
	{
		id: "private",
		q: "Do I have to share anything?",
		a: "No. Milestones are private until you make them public, one at a time, and you can preview your profile as the public sees it.",
	},
	{
		id: "helpful",
		q: "Why no likes?",
		a: "Likes reward what's popular. “Helpful” rewards what helped someone, which is the point of asking people a few steps ahead.",
	},
];
