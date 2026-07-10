import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';
import { scopedClusterFor } from '$lib/server/clusterAccess';
import { resolveClusterId, isClusterId } from '$lib/utils/clusters';

const DEFAULT_LIMIT = 20;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const load: PageServerLoad = async ({ url, locals }) => {
	// Filter/sort/pagination state lives in the URL so it survives reloads,
	// back/forward, and can be shared as a link.
	const q = url.searchParams.get('q')?.trim() ?? '';
	const barangay = url.searchParams.get('barangay') ?? '';
	const tag = url.searchParams.get('tag') ?? '';
	const sort = url.searchParams.get('sort') === 'fullName' ? 'fullName' : 'updatedAt';
	const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
	const page = Math.max(0, Number(url.searchParams.get('page')) || 0);
	const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT));

	// An encoder scoped to a cluster is locked to it; everyone else may choose
	// a cluster via the URL filter.
	const lockedCluster = scopedClusterFor(locals.user);
	const requestedCluster = url.searchParams.get('cluster') ?? '';
	const cluster = lockedCluster ?? (isClusterId(requestedCluster) ? requestedCluster : '');

	try {
		const db = await clientPromise();
		const householdsCollection = db.collection('households');
		const barangaysCollection = db.collection('barangays');

		// Full active barangay list (for name lookup + cluster resolution).
		const allBarangays = await barangaysCollection
			.find(
				{ isActive: true },
				// latitude/longitude drive the Create/Update drawer maps; cluster
				// (with name fallback) drives cluster filtering.
				{ projection: { _id: 1, name: 1, latitude: 1, longitude: 1, cluster: 1 } }
			)
			.sort({ name: 1 })
			.toArray();

		// Barangay ids belonging to the active cluster (if any).
		const clusterBarangayIds = cluster
			? allBarangays.filter((b: any) => resolveClusterId(b) === cluster).map((b: any) => b._id)
			: null;

		// A scoped encoder only ever sees their cluster's barangays in dropdowns.
		const barangays = lockedCluster
			? allBarangays.filter((b: any) => resolveClusterId(b) === lockedCluster)
			: allBarangays;

		// Build the query — the DB does filtering/sorting/pagination.
		const clauses: Record<string, unknown>[] = [{ isActive: true }];
		if (clusterBarangayIds) clauses.push({ barangayId: { $in: clusterBarangayIds } });
		if (q) {
			const pattern = escapeRegex(q);
			clauses.push({
				$or: [
					{ fullName: { $regex: pattern, $options: 'i' } },
					{ phone: { $regex: pattern, $options: 'i' } }
				]
			});
		}
		if (barangay) clauses.push({ barangayId: barangay });
		if (tag === 'UNTAGGED') {
			// Treat missing/empty tags as UNTAGGED (legacy + CSV-imported rows).
			clauses.push({ $or: [{ tag: 'UNTAGGED' }, { tag: { $in: [null, ''] } }] });
		} else if (tag) {
			clauses.push({ tag });
		}
		const query = clauses.length > 1 ? { $and: clauses } : clauses[0];

		const [households, total] = await Promise.all([
			// No projection: the Update drawer edits the full document, so partial
			// rows here would wipe fields on save.
			householdsCollection
				.find(query)
				.sort({ [sort]: dir })
				.skip(page * limit)
				.limit(limit)
				.toArray(),
			householdsCollection.countDocuments(query)
		]);

		const barangayMap = new Map(allBarangays.map((b: any) => [b._id, b.name] as [string, string]));

		// Multi-family dwellings: how many other families live in each listed
		// household (one indexed query for the visible page).
		const pageIds = households.map((h: any) => h._id);
		const subCounts = new Map<string, number>();
		const serviceSummary = new Map<string, { count: number; total: number }>();
		if (pageIds.length > 0) {
			const [subRows, svcRows] = await Promise.all([
				householdsCollection
					.aggregate([
						{ $match: { parentHouseholdId: { $in: pageIds }, isActive: true } },
						{ $group: { _id: '$parentHouseholdId', count: { $sum: 1 } } }
					])
					.toArray() as Promise<{ _id: string; count: number }[]>,
				// Services recorded against each visible household.
				db
					.collection('services')
					.aggregate([
						{ $match: { householdId: { $in: pageIds } } },
						{
							$group: {
								_id: '$householdId',
								count: { $sum: 1 },
								// Centavos; legacy float peso records fall back to ×100.
								total: {
									$sum: {
										$ifNull: [
											'$amountCentavos',
											{ $multiply: [{ $ifNull: ['$amount', 0] }, 100] }
										]
									}
								}
							}
						}
					])
					.toArray() as Promise<{ _id: string; count: number; total: number }[]>
			]);
			for (const r of subRows) subCounts.set(r._id, r.count);
			for (const r of svcRows) serviceSummary.set(r._id, { count: r.count, total: r.total });
		}

		return {
			households: households.map((h: any) => ({
				...h,
				barangayName: barangayMap.get(h.barangayId) || 'Unknown Barangay',
				subFamilyCount: subCounts.get(h._id) ?? 0,
				serviceCount: serviceSummary.get(h._id)?.count ?? 0,
				serviceTotal: serviceSummary.get(h._id)?.total ?? 0
			})),
			barangays,
			total,
			page,
			limit,
			q,
			barangay,
			tag,
			sort,
			dir: dir === 1 ? 'asc' : 'desc',
			cluster,
			lockedCluster: lockedCluster ?? ''
		};
	} catch (error) {
		console.error('Error loading households:', error);
		return {
			households: [],
			barangays: [],
			total: 0,
			page: 0,
			limit,
			q,
			barangay,
			tag,
			sort,
			dir: 'desc',
			cluster,
			lockedCluster: lockedCluster ?? ''
		};
	}
};
