import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Barangay, SessionUser } from '$lib/utils/types';
import { ROLES } from '$lib/utils/roles';
import { CLUSTERS, resolveClusterId } from '$lib/utils/clusters';
import { NUMERIC_STRING } from '$lib/utils/geo';
import clientPromise from '$lib/server/mongo';
import { encoderTaggingEnabled } from '$lib/server/settings';

type HouseholdDocument = {
	latitude: string;
	longitude: string;
	tag: string;
};

type HouseholdCoordinate = {
	lat: number;
	lng: number;
	tag: string;
};

export const ssr = false;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const role = locals.user.role;
	const db = await clientPromise();
	const Household = db.collection('households');

	// Gates the encoder-facing tagging copy below. Admins always tag.
	const encoderTagging = await encoderTaggingEnabled();

	// Tag counts are cheap and useful to every role.
	// TODO: not cluster-scoped — a cluster-bound encoder sees global counts.
	const tagGroups = (await Household.aggregate(
		[
			// Match the admin KPI facet below, which also counts active only.
			{ $match: { isActive: true } },
			{
				$group: {
					_id: { $ifNull: ['$tag', 'UNTAGGED'] },
					count: { $sum: 1 }
				}
			}
		],
		{ allowDiskUse: true }
	).toArray()) as { _id: string; count: number }[];

	const tagCounts = { APIN: 0, KONTRA: 0, UNTAGGED: 0 };
	for (const group of tagGroups) {
		if (group._id === 'APIN' || group._id === 'KONTRA') {
			tagCounts[group._id] = group.count;
		} else {
			// Any empty-string / legacy tag value folds into UNTAGGED.
			tagCounts.UNTAGGED += group.count;
		}
	}

	// Encoders and Grant Officers get a light, task-focused landing — skip the
	// heavy map data entirely.
	if (role !== ROLES.ADMINISTRATOR) {
		let activeGrants = 0;
		if (role === ROLES.GRANT_OFFICER) {
			activeGrants = await db.collection('grants').countDocuments({ isActive: true });
		}
		return {
			user: locals.user as SessionUser,
			tagCounts,
			encoderTagging,
			activeGrants,
			barangays: [] as Barangay[],
			households: [] as HouseholdCoordinate[],
			analytics: null
		};
	}

	// Administrator: full overview — map data plus analytics for KPIs/charts.
	const Barangay = db.collection('barangays');
	const Grant = db.collection('grants');

	// Everything the KPI tiles and charts need, in one pass over households.
	const facetPromise = Household.aggregate([
		{ $match: { isActive: true } },
		{
			$facet: {
				total: [{ $count: 'count' }],
				// Families living inside another household's dwelling.
				subFamilies: [
					{ $match: { parentHouseholdId: { $exists: true, $nin: [null, ''] } } },
					{ $count: 'count' }
				],
				voters: [{ $match: { isVoter: true } }, { $count: 'count' }],
				located: [
					// Only count coordinates that actually parse to numbers (matches the
					// map), so 'NaN'/'abc'/'' don't inflate the KPI.
					{
						$match: {
							latitude: { $regex: NUMERIC_STRING },
							longitude: { $regex: NUMERIC_STRING }
						}
					},
					{ $count: 'count' }
				],
				perBarangayTag: [
					{
						$group: {
							_id: { barangayId: '$barangayId', tag: { $ifNull: ['$tag', 'UNTAGGED'] } },
							count: { $sum: 1 }
						}
					}
				],
				reached: [{ $match: { 'grants.0': { $exists: true } } }, { $count: 'count' }],
				awardsTotal: [{ $unwind: '$grants' }, { $count: 'count' }],
				awardsByMonth: [
					{ $unwind: '$grants' },
					{ $match: { 'grants.receivedAt': { $type: 'date' } } },
					{
						$group: {
							_id: { $dateToString: { format: '%Y-%m', date: '$grants.receivedAt' } },
							count: { $sum: 1 }
						}
					},
					{ $sort: { _id: 1 } }
				]
			}
		}
	], { allowDiskUse: true }).toArray();

	const [barangays, householdsWithCoords, facets, activeGrants, totalGrants] = await Promise.all([
		Barangay.find().toArray(),
		Household.find(
			{ latitude: { $regex: NUMERIC_STRING }, longitude: { $regex: NUMERIC_STRING } },
			{ projection: { latitude: 1, longitude: 1, tag: 1 } }
		).toArray() as unknown as Promise<HouseholdDocument[]>,
		facetPromise,
		Grant.countDocuments({ isActive: true }),
		Grant.countDocuments({})
	]);

	const facet = facets[0] ?? {};
	const firstCount = (arr: { count?: number }[] | undefined): number => arr?.[0]?.count ?? 0;

	// Households per barangay, segmented by tag — top 10 plus an "Other" bucket.
	const barangayNames = new Map(barangays.map((b: any) => [b._id, b.name] as [string, string]));
	// barangayId -> resolved cluster (stored field wins, name config fallback).
	const barangayClusters = new Map<string, string | null>(
		barangays.map((b: any) => [b._id, resolveClusterId(b)] as [string, string | null])
	);
	const perBarangay = new Map<
		string,
		{ name: string; clusterId: string | null; APIN: number; KONTRA: number; UNTAGGED: number; total: number }
	>();
	for (const g of (facet.perBarangayTag ?? []) as {
		_id: { barangayId: string; tag: string };
		count: number;
	}[]) {
		const key = g._id.barangayId ?? 'unknown';
		const row =
			perBarangay.get(key) ??
			({
				name: barangayNames.get(key) || 'Unknown',
				clusterId: barangayClusters.get(key) ?? null,
				APIN: 0,
				KONTRA: 0,
				UNTAGGED: 0,
				total: 0
			} as const as any);
		const tag = g._id.tag === 'APIN' || g._id.tag === 'KONTRA' ? g._id.tag : 'UNTAGGED';
		row[tag] += g.count;
		row.total += g.count;
		perBarangay.set(key, row);
	}
	const barangayRows = [...perBarangay.values()].sort((a, b) => b.total - a.total);
	const topBarangays = barangayRows.slice(0, 10);
	const rest = barangayRows.slice(10);
	if (rest.length > 0) {
		topBarangays.push(
			rest.reduce(
				(acc, r) => ({
					name: `Other (${rest.length} barangays)`,
					clusterId: null,
					APIN: acc.APIN + r.APIN,
					KONTRA: acc.KONTRA + r.KONTRA,
					UNTAGGED: acc.UNTAGGED + r.UNTAGGED,
					total: acc.total + r.total
				}),
				{ name: '', clusterId: null as string | null, APIN: 0, KONTRA: 0, UNTAGGED: 0, total: 0 }
			)
		);
	}

	// Awards per month for the last 12 months, zero-filled so the line is honest
	// about quiet months.
	const monthCounts = new Map(
		((facet.awardsByMonth ?? []) as { _id: string; count: number }[]).map((m) => [
			m._id,
			m.count
		])
	);
	const awardsByMonth: { month: string; label: string; count: number }[] = [];
	const now = new Date();
	for (let i = 11; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		awardsByMonth.push({
			month: key,
			label: d.toLocaleDateString('en-US', { month: 'short' }),
			count: monthCounts.get(key) ?? 0
		});
	}

	// Roll barangays up into their fixed clusters (+ an Unassigned bucket).
	const clusterAgg = new Map<string, { APIN: number; KONTRA: number; UNTAGGED: number }>();
	for (const c of CLUSTERS) clusterAgg.set(c.id, { APIN: 0, KONTRA: 0, UNTAGGED: 0 });
	clusterAgg.set('UNASSIGNED', { APIN: 0, KONTRA: 0, UNTAGGED: 0 });
	for (const row of barangayRows) {
		const cid = row.clusterId ?? 'UNASSIGNED';
		const bucket = clusterAgg.get(cid)!;
		bucket.APIN += row.APIN;
		bucket.KONTRA += row.KONTRA;
		bucket.UNTAGGED += row.UNTAGGED;
	}
	const byCluster = [
		...CLUSTERS.map((c) => ({ name: c.label, ...clusterAgg.get(c.id)! })),
		{ name: 'Unassigned', ...clusterAgg.get('UNASSIGNED')! }
	].filter((r) => r.APIN + r.KONTRA + r.UNTAGGED > 0);

	const analytics = {
		totalHouseholds: firstCount(facet.total),
		subFamilies: firstCount(facet.subFamilies),
		voters: firstCount(facet.voters),
		located: firstCount(facet.located),
		reached: firstCount(facet.reached),
		awardsTotal: firstCount(facet.awardsTotal),
		activeGrants,
		totalGrants,
		topBarangays,
		byCluster,
		awardsByMonth
	};

	const householdCoordinates = householdsWithCoords
		.map(
			(h: HouseholdDocument): HouseholdCoordinate => ({
				lat: Number(h.latitude),
				lng: Number(h.longitude),
				tag: h.tag
			})
		)
		.filter((h: HouseholdCoordinate) => !Number.isNaN(h.lat) && !Number.isNaN(h.lng));

	return {
		user: locals.user as SessionUser,
		barangays: barangays as unknown as Barangay[],
		households: householdCoordinates,
		tagCounts,
		encoderTagging,
		activeGrants,
		analytics
	};
};
