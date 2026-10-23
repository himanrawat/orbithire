"use client";

// "People a few steps ahead": members in your field at a later career stage. No follower
// counts, just a way to follow their posts.

import { useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/app/blocks";
import { errorMessage, updateRelation } from "@/lib/community/client";
import { careerStageLabel, type PersonAhead } from "@/lib/community/types";

function PersonRow({ person }: Readonly<{ person: PersonAhead }>) {
	const [following, setFollowing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function follow() {
		setError(null);
		try {
			await updateRelation(following ? "unfollow" : "follow", person.userId);
			setFollowing(!following);
		} catch (err) {
			setError(errorMessage(err, "Could not follow"));
		}
	}

	const stage = careerStageLabel(person.careerStage);
	return (
		<li className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
			<div className="min-w-0">
				<p className="truncate text-sm font-semibold">{person.displayName}</p>
				{stage && <p className="text-[13px] text-muted-foreground">{stage}</p>}
				{person.headline && <p className="line-clamp-2 text-[13px] text-muted-foreground">{person.headline}</p>}
				{error && <output className="block text-[13px] text-[var(--danger)]">{error}</output>}
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				aria-pressed={following}
				aria-label={`${following ? "Unfollow" : "Follow"} ${person.displayName}`}
				onClick={() => void follow()}
			>
				{following ? <Check className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
				{following ? "Following" : "Follow"}
			</Button>
		</li>
	);
}

export function PeopleAhead({ people }: Readonly<{ people: PersonAhead[] }>) {
	return (
		<Card>
			<CardContent className="p-5">
				<SectionHeader title="People a few steps ahead" description="Members in your field one or two stages along." />
				{people.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No suggestions yet. Set your career stage in Settings, and check back as more people join.
					</p>
				) : (
					<ul className="divide-y">
						{people.map((person) => (
							<PersonRow key={person.userId} person={person} />
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
