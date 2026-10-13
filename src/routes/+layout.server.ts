import type { LayoutServerLoad } from './$types';
import { getSettings } from '$lib/server/settings';
import { isAdmin } from '$lib/utils/roles';

export const load: LayoutServerLoad = async ({ locals }) => {
	// App-wide switches: may ENCODERS / TAGGERS view and set the political tag?
	// Admins always may; these only affect those two roles. Logged-out requests
	// skip the read, so /auth/login never touches the settings collection.
	//
	// Admins read fresh: they're a handful of users, so the extra findOne is
	// negligible, and it means the person editing the flags always sees ground
	// truth after invalidateAll() rather than another instance's stale copy.
	const settings = locals.user
		? await getSettings({ fresh: isAdmin(locals.user.role) })
		: { encoderTagging: false, taggerTagging: false };

	return {
		user: locals.user,
		encoderTagging: settings.encoderTagging,
		taggerTagging: settings.taggerTagging
	};
};
