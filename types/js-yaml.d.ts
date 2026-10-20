// Minimal typings for js-yaml 4 (only what lib/jobs/portals.ts uses).
declare module "js-yaml" {
	export interface LoadOptions {
		filename?: string;
		json?: boolean;
	}
	export function load(str: string, opts?: LoadOptions): unknown;
}
