export const ssr = false;
import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ locals }: { locals: { user?: any } }): Promise<any> => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	return { user: locals.user };
};
