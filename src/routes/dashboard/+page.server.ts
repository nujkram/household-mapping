import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Barangay, User } from '$lib/utils/types';
import clientPromise from '$lib/server/mongo';
type LoadResult = {
	user: User;
	barangays: Barangay[];
};

export const ssr = false;

export const load: PageServerLoad = async ({
	locals
}: Parameters<PageServerLoad>[0]): Promise<LoadResult> => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	// Add authorization check for ADMINISTRATOR role
	if (locals.user.role !== 'ADMINISTRATOR') {
		throw redirect(302, '/unauthorized');
	}

	const db = await clientPromise();
	const Barangay = db.collection('barangays');
	const barangays = await Barangay.find().toArray();

	return {
		user: locals.user as User,
		barangays
	};
};
