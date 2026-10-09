import type { Db } from 'mongodb';
import type { GrantAwardInput, HouseholdGrant } from '$lib/utils/types';

type Resolved =
	| { grants: HouseholdGrant[]; error?: undefined }
	| { grants?: undefined; error: string };

/**
 * Turn the household form's ticked "Services Availed" rows into
 * `households.grants[]` entries — the same shape the Add Grant drawer writes:
 * name/year snapshotted from the catalog, `grantedBy` kept for awards that
 * were already on the record, the current user stamped on new ones.
 *
 * Errors when a grantId is unknown, or inactive and not already awarded (an
 * existing award for a since-deactivated grant is kept, never re-validated).
 */
export const resolveGrantAwards = async (
	db: Db,
	inputs: GrantAwardInput[],
	existing: HouseholdGrant[] | undefined,
	userId: string
): Promise<Resolved> => {
	if (inputs.length === 0) return { grants: [] };

	// String _ids (Meteor-style) — type the collection to accept them.
	const Grant = db.collection<{ _id: string; [key: string]: unknown }>('grants');
	const catalog = await Grant.find(
		{ _id: { $in: inputs.map((g) => g.grantId) } },
		{ projection: { name: 1, year: 1, isActive: 1 } }
	).toArray();
	const byId = new Map(catalog.map((g) => [g._id, g]));
	const priorById = new Map((existing ?? []).map((g) => [g.grantId, g]));

	const grants: HouseholdGrant[] = [];
	for (const input of inputs) {
		const grant = byId.get(input.grantId);
		if (!grant) return { error: 'One of the selected services no longer exists in Grants' };
		const prior = priorById.get(input.grantId);
		if (!grant.isActive && !prior) return { error: `"${grant.name}" is no longer an active grant` };
		grants.push({
			grantId: input.grantId,
			name: String(grant.name),
			year: Number(grant.year),
			// Typed date, like the Add Grant endpoint; unknown date = now (or keep the prior one).
			receivedAt: input.receivedAt
				? new Date(input.receivedAt)
				: prior?.receivedAt
					? new Date(prior.receivedAt)
					: new Date(),
			grantedBy: prior?.grantedBy ?? userId
		});
	}
	return { grants };
};
