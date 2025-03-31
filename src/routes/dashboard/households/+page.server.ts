import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const db = await clientPromise();
		const barangaysCollection = db.collection('barangays');

		// Only load barangays from server
		const barangays = await barangaysCollection
			.find({ isActive: true })
			.sort({ name: 1 })
			.toArray();

		return {
			barangays
		};
	} catch (error) {
		console.error('Error loading barangays:', error);
		return {
			barangays: []
		};
	}
};
