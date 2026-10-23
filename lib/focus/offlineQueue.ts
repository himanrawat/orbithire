// A small offline outbox in localStorage. Items are queued while offline (or always) and
// POSTed in batches when the browser is online; the server must be idempotent by the item
// key, because a batch can be sent twice if the tab closes before the response arrives.
//
// `focusSessionQueue` is the focus timer's outbox. The PWA work can reuse
// `createOfflineQueue` for other entries (e.g. learning logs) with its own key and endpoint.

import type { FocusSessionRecord } from "./timer";

export type OfflineQueueOptions<T> = Readonly<{
	/** localStorage key */
	storageKey: string;
	/** POST endpoint that accepts `{ [bodyField]: T[] }` */
	endpoint: string;
	bodyField: string;
	/** unique, stable id per item, used to de-duplicate and to drop sent items */
	keyOf: (item: T) => string;
	/** validates items read back from storage */
	isItem: (value: unknown) => value is T;
	maxItems?: number;
	batchSize?: number;
}>;

export type FlushResult = Readonly<{ sent: number; remaining: number; ok: boolean }>;

export type OfflineQueue<T> = Readonly<{
	read: () => T[];
	enqueue: (item: T) => void;
	flush: (fetchImpl?: typeof fetch) => Promise<FlushResult>;
	/** Flushes now (when online) and on every `online` event. Returns a cleanup function. */
	register: () => () => void;
}>;

function getStorage(): Storage | null {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}

function isOnline() {
	return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** 4xx other than auth/rate limits means the batch will never be accepted: drop it. */
export function shouldDropBatch(status: number) {
	return status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 408 && status !== 429;
}

export function createOfflineQueue<T>(options: OfflineQueueOptions<T>): OfflineQueue<T> {
	const maxItems = options.maxItems ?? 200;
	const batchSize = options.batchSize ?? 50;
	let flushing: Promise<FlushResult> | null = null;

	const read = (): T[] => {
		try {
			const raw = getStorage()?.getItem(options.storageKey);
			const parsed: unknown = raw ? JSON.parse(raw) : [];
			return Array.isArray(parsed) ? parsed.filter(options.isItem) : [];
		} catch {
			return [];
		}
	};

	const write = (items: T[]) => {
		try {
			getStorage()?.setItem(options.storageKey, JSON.stringify(items.slice(-maxItems)));
		} catch {
			// Storage full or blocked: nothing more we can do offline.
		}
	};

	const removeKeys = (keys: Set<string>) => {
		write(read().filter((item) => !keys.has(options.keyOf(item))));
	};

	const enqueue = (item: T) => {
		const key = options.keyOf(item);
		write([...read().filter((existing) => options.keyOf(existing) !== key), item]);
	};

	const sendBatch = async (batch: T[], fetchImpl: typeof fetch) => {
		const res = await fetchImpl(options.endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ [options.bodyField]: batch }),
		});
		if (res.ok || shouldDropBatch(res.status)) {
			removeKeys(new Set(batch.map(options.keyOf)));
			return res.ok;
		}
		return false;
	};

	const runFlush = async (fetchImpl: typeof fetch): Promise<FlushResult> => {
		const batch = read().slice(0, batchSize);
		if (batch.length === 0 || !isOnline()) return { sent: 0, remaining: read().length, ok: batch.length === 0 };
		try {
			const ok = await sendBatch(batch, fetchImpl);
			return { sent: ok ? batch.length : 0, remaining: read().length, ok };
		} catch {
			return { sent: 0, remaining: read().length, ok: false };
		}
	};

	const flush = (fetchImpl: typeof fetch = fetch) => {
		flushing ??= runFlush(fetchImpl).finally(() => {
			flushing = null;
		});
		return flushing;
	};

	const register = () => {
		if (typeof window === "undefined") return () => undefined;
		const onOnline = () => {
			void flush();
		};
		window.addEventListener("online", onOnline);
		void flush();
		return () => window.removeEventListener("online", onOnline);
	};

	return { read, enqueue, flush, register };
}

function isFocusSessionRecord(value: unknown): value is FocusSessionRecord {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.client_id === "string" &&
		typeof v.task_label === "string" &&
		typeof v.planned_minutes === "number" &&
		typeof v.started_at === "string" &&
		typeof v.ended_at === "string" &&
		typeof v.completed === "boolean"
	);
}

export const focusSessionQueue = createOfflineQueue<FocusSessionRecord>({
	storageKey: "nm.focus.queue.v1",
	endpoint: "/api/focus/sessions",
	bodyField: "sessions",
	keyOf: (session) => session.client_id,
	isItem: isFocusSessionRecord,
});
