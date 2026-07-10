import type { Db, ClientSession } from 'mongodb';
import { parseCoord } from '$lib/utils/geo';

type DependentLike = { linkedHouseholdId?: string | null };

/**
 * Keep the family↔dwelling relation consistent after a household record is
 * saved. A dependent linked to their own household record means that family
 * lives in THIS household's dwelling. Derived entirely from the dependent
 * links; enforces a single invariant: a family belongs to at most one dwelling.
 *
 *  1. cycle guard — a linked family that is an ANCESTOR of the host (A→B→…→host)
 *     is skipped, so no cycle of any length can form.
 *  2. steal-reconcile — a linked family currently listed by ANOTHER dwelling is
 *     removed from that dwelling's roster, so it never has two parents.
 *  3. link — set parentHouseholdId = host and share the dwelling's coordinates.
 *  4. release — families no longer linked here are detached.
 */
export const syncFamilyLinks = async (
	db: Db,
	hostId: string,
	dependentDetails: DependentLike[] | undefined,
	coords?: { latitude?: string; longitude?: string },
	/** The host's own parent, used to seed the ancestor walk. */
	hostParentId?: string | null,
	/** When set, all writes run inside this transaction. */
	session?: ClientSession
): Promise<void> => {
	const Household = db.collection('households');
	const opts = session ? { session } : {};

	let linkedIds = [
		...new Set(
			(dependentDetails ?? [])
				.map((d) => d.linkedHouseholdId)
				.filter((id): id is string => Boolean(id))
		)
	].filter((id) => id !== hostId);

	// 1. Cycle guard: collect the host's ancestor chain and drop any candidate in
	//    it. parentHouseholdId is a single scalar, so the chain is linear; the
	//    visited set + bound also protect against pre-existing corrupt cycles.
	if (linkedIds.length > 0) {
		const ancestors = new Set<string>();
		let cur: string | null | undefined = hostParentId;
		let guard = 0;
		while (cur && !ancestors.has(cur) && guard++ < 100) {
			ancestors.add(cur);
			const parent = await Household.findOne(
				{ _id: cur },
				{ projection: { parentHouseholdId: 1 }, ...opts }
			);
			cur = (parent?.parentHouseholdId as string) || null;
		}
		linkedIds = linkedIds.filter((id) => !ancestors.has(id));
	}

	if (linkedIds.length > 0) {
		// 2. Steal-reconcile: detach these families from any OTHER dwelling's
		//    roster so a person can't be listed under two households.
		await Household.updateMany(
			{ _id: { $ne: hostId }, 'dependentDetails.linkedHouseholdId': { $in: linkedIds } },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ $pull: { dependentDetails: { linkedHouseholdId: { $in: linkedIds } } } } as any,
			opts
		);

		// 3. Link + share the dwelling pin.
		const set: Record<string, unknown> = { parentHouseholdId: hostId };
		if (coords?.latitude && coords?.longitude) {
			set.latitude = coords.latitude;
			set.longitude = coords.longitude;
			set.lat = parseCoord(coords.latitude);
			set.lng = parseCoord(coords.longitude);
		}
		await Household.updateMany({ _id: { $in: linkedIds } }, { $set: set }, opts);
	}

	// 4. Release records no longer linked as members of this dwelling.
	await Household.updateMany(
		{ parentHouseholdId: hostId, _id: { $nin: linkedIds } },
		{ $set: { parentHouseholdId: '' } },
		opts
	);
};
