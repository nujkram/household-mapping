import type { Db } from 'mongodb';
import type { SessionUser } from '$lib/utils/types';
import { ROLES } from '$lib/utils/roles';
import { barangayNamesInCluster, isClusterId } from '$lib/utils/clusters';

/** The cluster an encoder is scoped to, or null (admins/officers/unscoped see all). */
export const scopedClusterFor = (user: SessionUser | null): string | null => {
	if (user?.role === ROLES.ENCODER && isClusterId(user.cluster)) return user.cluster ?? null;
	return null;
};

/** Barangay _ids whose (uppercased) name is in the given cluster. */
export const barangayIdsInCluster = async (db: Db, clusterId: string): Promise<string[]> => {
	const names = barangayNamesInCluster(clusterId);
	if (names.length === 0) return [];
	const rows = await db
		.collection('barangays')
		.aggregate([
			{ $addFields: { _nameUpper: { $toUpper: { $trim: { input: '$name' } } } } },
			{ $match: { _nameUpper: { $in: names } } },
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
