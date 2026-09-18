import type { Db } from 'mongodb';
import type { SessionUser } from '$lib/utils/types';
import { ROLES } from '$lib/utils/roles';
import {
	barangayNamesInCluster,
	isClusterId,
	normalizeScopeMode,
	type ScopeMode
} from '$lib/utils/clusters';

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
	// Scoped by an explicit barangay list instead — no cluster lock applies.
	if (normalizeScopeMode(user.scopeMode) === 'BARANGAYS') return null;
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
 * The barangay ids an encoder may act on — the single source of truth for both
 * kinds of caller: point checks (`encoderMayAccessBarangay`) and `$in` filters.
 *
 *  - `null` → unrestricted (admins, grant officers, encoders with no scope set)
 *  - `[]`   → denied everything; `{ $in: [] }` matches nothing, so a fail-closed
 *             scope needs no special-casing at any call site
 *  - ids    → exactly what they may reach
 *
 * Which rule applies is per-account (`scopeMode`). An encoder in BARANGAYS mode
 * with nothing assigned yet gets `[]`, not free rein: a half-configured account
 * is locked out rather than silently granted access.
 */
export const allowedBarangayIdsFor = async (
	db: Db,
	user: SessionUser | null
): Promise<string[] | null> => {
	if (user?.role !== ROLES.ENCODER) return null;

	if (normalizeScopeMode(user.scopeMode) === 'BARANGAYS') {
		return Array.isArray(user.barangayIds) ? user.barangayIds : [];
	}

	const cluster = scopedClusterFor(user);
	if (!cluster) return null; // explicitly "all clusters"
	// An unrecognized cluster resolves to NO_CLUSTER, which matches no barangay.
	return barangayIdsInCluster(db, cluster);
};

/**
 * The scoping fields to persist on a user document.
 *
 * Two invariants, both enforced here rather than at each call site:
 *  - Non-encoders are stored unscoped — scoping only means anything for encoders.
 *  - The field for the mode NOT in use is cleared, so a stale cluster (or a stale
 *    barangay list) can never widen access after an admin switches modes.
 *
 * Barangay ids are checked against the collection and unknown ones dropped, so a
 * typo'd or deleted barangay can't sit on the account granting nothing forever.
 */
export const scopeFieldsForUser = async (
	db: Db,
	role: string,
	scopeMode: ScopeMode,
	cluster: string,
	barangayIds: string[]
): Promise<{ cluster: string; scopeMode: ScopeMode; barangayIds: string[] }> => {
	if (role !== ROLES.ENCODER) return { cluster: '', scopeMode: 'CLUSTER', barangayIds: [] };

	if (scopeMode === 'BARANGAYS') {
		// String _ids (Meteor-style) — type the collection so `_id` isn't ObjectId.
		const rows = barangayIds.length
			? await db
					.collection<{ _id: string }>('barangays')
					.find({ _id: { $in: barangayIds } }, { projection: { _id: 1 } })
					.toArray()
			: [];
		return { cluster: '', scopeMode: 'BARANGAYS', barangayIds: rows.map((r) => r._id) };
	}

	return { cluster, scopeMode: 'CLUSTER', barangayIds: [] };
};

/**
 * Whether an encoder may act on a household in `barangayId`. Admins and
 * unscoped encoders always may. Returns false if the barangay is outside the
 * encoder's scope, whichever way that scope is defined.
 */
export const encoderMayAccessBarangay = async (
	db: Db,
	user: SessionUser,
	barangayId: string | null | undefined
): Promise<boolean> => {
	const allowed = await allowedBarangayIdsFor(db, user);
	if (!allowed) return true;
	if (!barangayId) return false;
	return allowed.includes(barangayId);
};
