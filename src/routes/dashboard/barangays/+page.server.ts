import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

export const ssr = false;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	try {
		const db = await clientPromise();
		// Query the DB directly (like every other dashboard loader) instead of an
		// internal fetch to /api/admin/barangay — the self-request pattern is
		// fragile on serverless. `$ne: false` includes barangays without an
		// explicit isActive field.
		const barangays = await db
			.collection('barangays')
			.find({ isActive: { $ne: false } })
			.sort({ name: 1 })
			.toArray();

		return { barangays, user: locals.user };
	} catch (err) {
		console.error('Error loading barangays:', err);
		throw error(500, 'Could not load barangays. Please try again.');
	}
};
