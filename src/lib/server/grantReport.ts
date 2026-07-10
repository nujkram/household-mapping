import type { Db } from 'mongodb';
import { barangayIdsInCluster } from '$lib/server/clusterAccess';
import { resolveClusterId, clusterLabel, isClusterId } from '$lib/utils/clusters';

export type GrantRecipient = {
	_id: string;
	fullName: string;
	phone: string;
	barangayId: string;
	barangayName: string;
	cluster: string;
	receivedAt: Date | null;
	grantedByName: string;
};

export type RecipientFilters = {
	q?: string;
	barangay?: string;
	cluster?: string;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Households that received a grant, with their award date and who recorded it.
 * Used by both the report page and the Excel export so the exported file
 * always matches what's on screen.
 */
export const fetchGrantRecipients = async (
	db: Db,
	grantId: string,
	filters: RecipientFilters = {}
): Promise<GrantRecipient[]> => {
	const clauses: Record<string, unknown>[] = [
		{ isActive: true },
		{ 'grants.grantId': grantId }
	];

	if (filters.q?.trim()) {
		clauses.push({ fullName: { $regex: escapeRegex(filters.q.trim()), $options: 'i' } });
	}
	if (filters.barangay) {
		clauses.push({ barangayId: filters.barangay });
	}
	if (filters.cluster && isClusterId(filters.cluster)) {
		const ids = await barangayIdsInCluster(db, filters.cluster);
		clauses.push({ barangayId: { $in: ids } });
	}

	const rows = await db
		.collection('households')
		.aggregate([
			{ $match: { $and: clauses } },
			{
				// The award entry for THIS grant (a household holds many awards).
				$addFields: {
					award: {
						$first: {
							$filter: { input: '$grants', cond: { $eq: ['$$this.grantId', grantId] } }
						}
					}
				}
			},
			{
				$lookup: {
					from: 'barangays',
					localField: 'barangayId',
					foreignField: '_id',
					as: 'barangay',
					pipeline: [{ $project: { name: 1, cluster: 1 } }]
				}
			},
			{
				$lookup: {
					from: 'users',
					localField: 'award.grantedBy',
					foreignField: '_id',
					as: 'grantedByUser',
					// Never pull password hashes/tokens along.
					pipeline: [{ $project: { fullName: 1 } }]
				}
			},
			{
				$project: {
					fullName: 1,
					phone: 1,
					barangayId: 1,
					barangayName: { $ifNull: [{ $arrayElemAt: ['$barangay.name', 0] }, 'Unknown'] },
					barangayCluster: { $arrayElemAt: ['$barangay.cluster', 0] },
					receivedAt: '$award.receivedAt',
					grantedByName: { $ifNull: [{ $arrayElemAt: ['$grantedByUser.fullName', 0] }, ''] }
				}
			},
			// Distribution-list order: by barangay, then by name.
			{ $sort: { barangayName: 1, fullName: 1 } }
		])
		.toArray();

	return rows.map((r: any) => ({
		...r,
		cluster:
			clusterLabel(resolveClusterId({ cluster: r.barangayCluster, name: r.barangayName })) || '—'
	})) as GrantRecipient[];
};
