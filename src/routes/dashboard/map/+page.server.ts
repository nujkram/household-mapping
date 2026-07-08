import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

export const ssr = false;

export const load: PageServerLoad = async () => {
	try {
		const db = await clientPromise();
		const householdsCollection = db.collection('households');
		const barangaysCollection = db.collection('barangays');

		const barangays = await barangaysCollection
			.find({ isActive: true }, { projection: { _id: 1, name: 1 } })
			.sort({ name: 1 })
			.toArray();

		// Only fetch the fields the map actually renders/filters on — not entire
		// household documents (which contain PII the map never shows).
		const households = await householdsCollection
			.find(
				{
					isActive: true,
					latitude: { $exists: true },
					longitude: { $exists: true }
				},
				{
					projection: {
						_id: 1,
						name: 1,
						fullName: 1,
						barangayId: 1,
						tag: 1,
						latitude: 1,
						longitude: 1,
						address: 1
					}
				}
			)
			.sort({ updatedAt: -1 })
			.toArray();

		const barangayMap = new Map(
			barangays.map((b: { _id: string; name: string }) => [b._id, b.name] as [string, string])
		);

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
