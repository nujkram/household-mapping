import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';
import { scopedClusterFor, barangayIdsInCluster } from '$lib/server/clusterAccess';

export const ssr = false;

// Households are now fetched per-viewport by /api/admin/household/map; the loader
// only needs the barangay list (filter dropdown + name resolution), cluster-scoped.
export const load: PageServerLoad = async ({ locals }) => {
	try {
		const db = await clientPromise();
		const cluster = scopedClusterFor(locals.user);
		const scope = cluster ? { _id: { $in: await barangayIdsInCluster(db, cluster) } } : {};

		const barangays = await db
			.collection('barangays')
			.find({ isActive: true, ...scope }, { projection: { _id: 1, name: 1 } })
			.sort({ name: 1 })
			.toArray();

		return { barangays };
	} catch (error) {
		console.error('Error loading map data:', error);
		return { barangays: [] };
	}
};
