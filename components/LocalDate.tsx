"use client";

import { useEffect, useState } from "react";

/**
 * A date in the viewer's locale and time zone. Rendered after mount: the server's
 * locale / time zone differ from the browser's, which broke hydration on SSR'd tables.
 */
export function LocalDate({ value, withTime = false }: { value: string | null | undefined; withTime?: boolean }) {
	const [text, setText] = useState("");
	useEffect(() => {
		if (!value) return setText("—");
		const d = new Date(value);
		setText(withTime ? d.toLocaleString() : d.toLocaleDateString());
	}, [value, withTime]);
	return <>{text}</>;
}
