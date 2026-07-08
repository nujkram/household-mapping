// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
import type { SessionUser } from '$lib/utils/types';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
		}
		// interface PageData {}
		// interface Error {}
		// interface Platform {}
	}
}

export {};
