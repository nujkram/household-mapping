export const ssr = false;
import { redirect } from '@sveltejs/kit';

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

	let barangays = [];
	try {
		const res = await fetch('/api/admin/barangay', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const result = await res.json();
		barangays = result.response;
	} catch (error) {
		console.error('error', error);
	}

	return { barangays, user: locals.user };
};
