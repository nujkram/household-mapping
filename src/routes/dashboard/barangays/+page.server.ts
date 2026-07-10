export const ssr = false;
import { redirect, error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({
	locals,
	fetch
}: {
	locals: { user?: any };
	fetch: typeof globalThis.fetch;
}): Promise<any> => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	try {
		const res = await fetch('/api/admin/barangay', {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		});
		if (!res.ok) throw new Error(`barangay API returned ${res.status}`);
		const result = await res.json();
		// Surface a real error instead of silently rendering an empty list.
		return { barangays: result.response ?? [], user: locals.user };
	} catch (err) {
		console.error('Error loading barangays:', err);
		throw error(500, 'Could not load barangays. Please try again.');
	}
};
