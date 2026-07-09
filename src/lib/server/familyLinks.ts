import type { Db } from 'mongodb';

type DependentLike = { linkedHouseholdId?: string | null };

/**
 * Keep the family↔dwelling relation consistent after a household record is
 * saved. A dependent linked to their own household record means that family
 * lives in THIS household's dwelling, so:
 *
 *  1. every linked record gets `parentHouseholdId = hostId` (and inherits the
 *     dwelling's coordinates so the map stays honest),
 *  2. records that used to point here but are no longer linked are released,
 *
 * Derived entirely from the existing dependent links — nothing new to encode.
 */
export const syncFamilyLinks = async (
	db: Db,
	hostId: string,
	dependentDetails: DependentLike[] | undefined,
	coords?: { latitude?: string; longitude?: string },
	/** The host's own parent — excluded to prevent a direct A↔B cycle. */
	hostParentId?: string | null
): Promise<void> => {
	const Household = db.collection('households');

	const linkedIds = [
		...new Set(
			(dependentDetails ?? [])
				.map((d) => d.linkedHouseholdId)
				.filter((id): id is string => Boolean(id))
		)
	].filter((id) => id !== hostId && id !== hostParentId);

	if (linkedIds.length > 0) {
		const set: Record<string, unknown> = { parentHouseholdId: hostId };
		// Co-resident families share the dwelling's pin.
		if (coords?.latitude && coords?.longitude) {
			set.latitude = coords.latitude;
			set.longitude = coords.longitude;
		}
		await Household.updateMany({ _id: { $in: linkedIds } }, { $set: set });
	}

	// Release records that are no longer linked as members of this dwelling.
	await Household.updateMany(
		{ parentHouseholdId: hostId, _id: { $nin: linkedIds } },
		{ $set: { parentHouseholdId: '' } }
	);
};
