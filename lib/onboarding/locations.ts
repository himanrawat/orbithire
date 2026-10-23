/** Location picker data: "Remote (US)" plus a curated list of large US metro areas. */

export const REMOTE_US = "Remote (US)";

/** Roughly the 50 largest US metro areas, written the way job postings usually name them. */
export const US_METROS: readonly string[] = [
	"New York, NY",
	"Los Angeles, CA",
	"Chicago, IL",
	"Dallas–Fort Worth, TX",
	"Houston, TX",
	"Washington, DC",
	"Philadelphia, PA",
	"Atlanta, GA",
	"Miami, FL",
	"Phoenix, AZ",
	"Boston, MA",
	"San Francisco Bay Area, CA",
	"Riverside–San Bernardino, CA",
	"Detroit, MI",
	"Seattle, WA",
	"Minneapolis–St. Paul, MN",
	"San Diego, CA",
	"Tampa, FL",
	"Denver, CO",
	"Baltimore, MD",
	"St. Louis, MO",
	"Orlando, FL",
	"Charlotte, NC",
	"San Antonio, TX",
	"Portland, OR",
	"Sacramento, CA",
	"Pittsburgh, PA",
	"Austin, TX",
	"Las Vegas, NV",
	"Cincinnati, OH",
	"Kansas City, MO",
	"Columbus, OH",
	"Indianapolis, IN",
	"Cleveland, OH",
	"San Jose, CA",
	"Nashville, TN",
	"Virginia Beach, VA",
	"Providence, RI",
	"Jacksonville, FL",
	"Milwaukee, WI",
	"Raleigh–Durham, NC",
	"Oklahoma City, OK",
	"Memphis, TN",
	"Richmond, VA",
	"Louisville, KY",
	"New Orleans, LA",
	"Salt Lake City, UT",
	"Hartford, CT",
	"Buffalo, NY",
	"Birmingham, AL",
];

/** Every option in picker order: remote first, then metros. */
export const LOCATION_OPTIONS: readonly string[] = [REMOTE_US, ...US_METROS];

function simplify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[–—-]/g, " ")
		.replace(/[^a-z0-9 ]/g, "")
		.replace(/ +/g, " ")
		.trim();
}

/** Options matching a free-text query; the whole list when the query is empty. */
export function filterLocations(query: string, options: readonly string[] = LOCATION_OPTIONS): string[] {
	const needle = simplify(query);
	if (!needle) return [...options];
	return options.filter((option) => simplify(option).includes(needle));
}

/** True when the query already names one of the options exactly (ignoring case and punctuation). */
export function hasExactLocation(query: string, options: readonly string[] = LOCATION_OPTIONS): boolean {
	const needle = simplify(query);
	return needle.length > 0 && options.some((option) => simplify(option) === needle);
}
