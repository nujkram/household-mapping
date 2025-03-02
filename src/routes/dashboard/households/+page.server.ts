import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const db = await clientPromise();
		const householdsCollection = db.collection('households');
		const barangaysCollection = db.collection('barangays');

		// Get all barangays first
		const barangays = await barangaysCollection.find({ isActive: true }).toArray();

		// Get all households with their tags
		const households = await householdsCollection
			.find({ isActive: true })
			.sort({ updatedAt: -1 }) // Sort by most recently updated
			.toArray();

		// Create a map of barangay IDs to names for quick lookup
		const barangayMap = new Map(barangays.map((b) => [b._id, b.name]));

		// Enhance household data with barangay names
		const enhancedHouseholds = households.map((household) => ({
			...household,
			barangayName: barangayMap.get(household.barangayId) || 'Unknown Barangay'
		}));

		return {
			households: enhancedHouseholds,
			barangays
		};
	} catch (error) {
		console.error('Error loading households:', error);
		return {
			households: [],
			barangays: []
		};
	}
};
