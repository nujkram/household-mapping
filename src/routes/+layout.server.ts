import type { LayoutServerLoad } from './$types';
import { encoderTaggingEnabled } from '$lib/server/settings';
import { isAdmin } from '$lib/utils/roles';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		// App-wide switch: may ENCODERS view/set the political tag? Admins always
		// may; this only affects ENCODER. Logged-out requests skip the read, so
		// /auth/login never touches the settings collection.
		//
		// Admins read fresh: they're a handful of users, so the extra findOne is
		// negligible, and it means the person editing the flag always sees ground
		// truth after invalidateAll() rather than another instance's stale copy.
		encoderTagging: locals.user
			? await encoderTaggingEnabled({ fresh: isAdmin(locals.user.role) })
			: false
	};
};
