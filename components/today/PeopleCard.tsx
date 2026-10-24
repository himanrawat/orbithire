import { PersonRow } from "@/components/community/PeopleAhead";
import type { TodayPerson } from "@/lib/today/types";

/** Up to three members a few steps ahead in your field, to follow. Hidden when there are none. */
export function PeopleCard({ people }: Readonly<{ people: readonly TodayPerson[] }>) {
	if (people.length === 0) return null;
	return (
		<section aria-labelledby="people-heading" className="rounded-[var(--radius-md)] border bg-card p-4">
			<h2 id="people-heading" className="mb-3 text-[15px] font-semibold">
				People a few steps ahead
			</h2>
			<ul className="divide-y">
				{people.map((person) => (
					<PersonRow key={person.userId} person={person} />
				))}
			</ul>
		</section>
	);
}
