import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';
import { scopedClusterFor, barangayIdsInCluster } from '$lib/server/clusterAccess';
import { NUMERIC_STRING } from '$lib/utils/geo';

export const ssr = false;

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const db = await clientPromise();
		const householdsCollection = db.collection('households');
		const barangaysCollection = db.collection('barangays');

		// A cluster-scoped encoder only ever sees their cluster on the map.
		const cluster = scopedClusterFor(locals.user);
		const clusterBarangayIds = cluster ? await barangayIdsInCluster(db, cluster) : null;
		const barangayScope = clusterBarangayIds ? { _id: { $in: clusterBarangayIds } } : {};
		const householdScope = clusterBarangayIds ? { barangayId: { $in: clusterBarangayIds } } : {};

		const barangays = await barangaysCollection
			.find({ isActive: true, ...barangayScope }, { projection: { _id: 1, name: 1 } })
			.sort({ name: 1 })
			.toArray();

		// Only fetch the fields the map actually renders/filters on — not entire
		// household documents (which contain PII the map never shows).
		const households = await householdsCollection
			.find(
				{
					isActive: true,
					latitude: { $regex: NUMERIC_STRING },
					longitude: { $regex: NUMERIC_STRING },
					...householdScope
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
			barangays.map((b: any) => [b._id, b.name] as [string, string])
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
