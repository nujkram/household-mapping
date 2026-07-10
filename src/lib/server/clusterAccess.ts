import type { Db } from 'mongodb';
import type { SessionUser } from '$lib/utils/types';
import { ROLES } from '$lib/utils/roles';
import { barangayNamesInCluster, isClusterId } from '$lib/utils/clusters';

/**
 * Sentinel cluster id for an encoder whose stored cluster is non-empty but NOT a
 * valid cluster id (config drift, corrupted/typo'd value). It matches NO barangay
 * anywhere, so such an encoder is denied everything — fail CLOSED, never open.
 */
export const NO_CLUSTER = '__NONE__';

/**
 * The cluster an encoder is scoped to.
 *  - null  → unrestricted (admins, grant officers, and encoders with cluster '')
 *  - valid id → scoped to that cluster
 *  - NO_CLUSTER → encoder has an unrecognized cluster → deny everything
 */
export const scopedClusterFor = (user: SessionUser | null): string | null => {
	if (user?.role !== ROLES.ENCODER) return null;
	const c = user.cluster;
	if (!c) return null; // explicitly "all clusters"
	return isClusterId(c) ? c : NO_CLUSTER; // invalid → fail closed
};

/**
 * Barangay _ids in the given cluster. A stored `cluster` field wins; barangays
 * without one fall back to the fixed name-based config (mirrors resolveClusterId).
 */
export const barangayIdsInCluster = async (db: Db, clusterId: string): Promise<string[]> => {
	const names = barangayNamesInCluster(clusterId);
	const noStoredCluster = { $or: [{ cluster: { $exists: false } }, { cluster: null }, { cluster: '' }] };
	const rows = await db
		.collection('barangays')
		.aggregate([
			{ $addFields: { _nameUpper: { $toUpper: { $trim: { input: '$name' } } } } },
			{
				$match: {
					$or: [
						// explicit override to this cluster
						{ cluster: clusterId },
						// or no override + name matches the config
						{ $and: [noStoredCluster, { _nameUpper: { $in: names } }] }
					]
				}
			},
			{ $project: { _id: 1 } }
		])
		.toArray();
	return rows.map((r) => r._id as string);
};

/**
 * Whether an encoder may act on a household in `barangayId`. Admins and
 * unscoped encoders always may. Returns false if the barangay is outside the
 * encoder's assigned cluster.
 */
export const encoderMayAccessBarangay = async (
	db: Db,
	user: SessionUser,
	barangayId: string | null | undefined
): Promise<boolean> => {
	const cluster = scopedClusterFor(user);
	if (!cluster) return true;
	if (!barangayId) return false;
	const ids = await barangayIdsInCluster(db, cluster);
	return ids.includes(barangayId);
};
