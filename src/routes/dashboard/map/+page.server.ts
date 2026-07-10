import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';
import { scopedClusterFor, barangayIdsInCluster } from '$lib/server/clusterAccess';
import { ROLES } from '$lib/utils/roles';
import { NUMERIC_STRING } from '$lib/utils/geo';

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

		// Admin heads-up: any household with valid string coords but no numeric
		// lat/lng mirror means the backfill migration hasn't run — the viewport
		// map can't show those until it does.
		let migrationNeeded = false;
		if (locals.user?.role === ROLES.ADMINISTRATOR) {
			const unmigrated = await db
				.collection('households')
				.findOne(
					{ lat: { $exists: false }, latitude: { $regex: NUMERIC_STRING } },
					{ projection: { _id: 1 } }
				);
			migrationNeeded = Boolean(unmigrated);
		}

		return { barangays, migrationNeeded };
	} catch (err) {
		console.error('Error loading map data:', err);
		throw error(500, 'Could not load the map. Please try again.');
	}
};
