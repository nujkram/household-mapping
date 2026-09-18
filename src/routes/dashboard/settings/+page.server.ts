import type { PageServerLoad } from './$types';
import { getSettings } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	// Fresh, not cached: the page that edits the value must never show this
	// instance's stale copy. The hook table already restricts this to admins.
	return { settings: await getSettings({ fresh: true }) };
};
