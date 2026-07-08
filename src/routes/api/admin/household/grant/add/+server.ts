import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { householdGrantSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = householdGrantSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const { householdId, grantId } = parsed.data;

	const db = await clientPromise();
	const Grant = db.collection('grants');
	const Household = db.collection('households');

	const grant = await Grant.findOne({ _id: grantId });
	if (!grant) {
		return json({ status: 'Error', error: 'Grant not found' }, { status: 404 });
	}
	if (!grant.isActive) {
		return json({ status: 'Error', error: 'This grant is no longer active' }, { status: 400 });
	}

	// One award per grant per household — reject double-granting. The guard is in
	// the update filter itself so concurrent requests can't slip a duplicate in.
	const result = await Household.updateOne(
		{ _id: householdId, 'grants.grantId': { $ne: grantId } },
		{
			$push: {
				grants: {
					grantId: grant._id,
					name: grant.name,
					year: grant.year,
					receivedAt: new Date(),
					grantedBy: locals.user._id
				}
			},
			$set: { updatedAt: new Date(), updatedBy: locals.user._id }
		}
	);

	if (result.matchedCount === 0) {
		// Distinguish "no such household" from "already granted".
		const exists = await Household.findOne({ _id: householdId }, { projection: { _id: 1 } });
		if (!exists) {
			return json({ status: 'Error', error: 'Household not found' }, { status: 404 });
		}
		return json(
			{ status: 'Error', error: 'This household has already received this grant' },
			{ status: 409 }
		);
	}

	return json({ status: 'Success', message: `${grant.name} granted successfully` });
};
