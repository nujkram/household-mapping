import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

export const ssr = false;

export const load: PageServerLoad = async () => {
	try {
		const db = await clientPromise();
		const householdsCollection = db.collection('households');
		const barangaysCollection = db.collection('barangays');

		// Get all barangays
		const barangays = await barangaysCollection
			.find({ isActive: true })
			.sort({ name: 1 })
			.toArray();

		// Get all households with coordinates and tags
		const households = await householdsCollection
			.find({
				isActive: true,
				latitude: { $exists: true },
				longitude: { $exists: true }
			})
			.sort({ updatedAt: -1 })
			.toArray();

		// Create a map of barangay IDs to names
		const barangayMap = new Map(
			barangays.map((b: { _id: string; name: string }) => [b._id, b.name])
		);

		// Enhance household data with barangay names
		const enhancedHouseholds = households.map((household: any) => ({
			...household,
			barangayName: barangayMap.get(household.barangayId) || 'Unknown Barangay'
		}));

		return {
			households: enhancedHouseholds,
			barangays
		};
	} catch (error) {
		console.error('Error loading map data:', error);
		return {
			households: [],
			barangays: []
		};
	}
};
