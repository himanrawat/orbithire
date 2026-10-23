"use client";

// Records one view of a post (deduplicated per member in the database). Renders nothing.

import { useEffect } from "react";
import { recordViews } from "@/lib/community/client";

export function RecordView({ postId, skip }: Readonly<{ postId: string; skip: boolean }>) {
	useEffect(() => {
		if (!skip) void recordViews([postId]);
	}, [postId, skip]);
	return null;
}
