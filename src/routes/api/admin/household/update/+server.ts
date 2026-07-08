import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { householdUpdateSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = householdUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	try {
		const db = await clientPromise();
		const Household = db.collection('households');

		// Propagate the new coordinates to every household that links this one as a
		// dependent — in a single updateMany with array filters (was an N+1 loop).
		await Household.updateMany(
			{ 'dependentDetails.linkedHouseholdId': data._id },
			{
				$set: {
					'dependentDetails.$[elem].latitude': data.latitude,
					'dependentDetails.$[elem].longitude': data.longitude
				}
			},
			{ arrayFilters: [{ 'elem.linkedHouseholdId': data._id }] }
		);

		const set: Record<string, unknown> = {
			updatedAt: new Date(),
			lastName: data.lastName,
			middleName: data.middleName,
			firstName: data.firstName,
			fullName: `${data.firstName} ${data.middleName} ${data.lastName}`.replace(/\s+/g, ' ').trim(),
			gender: data.gender,
			phone: data.phone,
			dateOfBirth: data.dateOfBirth ?? null,
			dependents: data.dependents,
			dependentDetails: data.dependentDetails,
			isVoter: data.isVoter,
			latitude: data.latitude,
			longitude: data.longitude,
			updatedBy: locals.user._id
		};
		if (data.tag) set.tag = data.tag;

		const result = await Household.updateOne({ _id: data._id }, { $set: set });

		if (result.matchedCount === 0) {
			return json({ status: 'Error', error: 'Household not found' }, { status: 404 });
		}

		return json({ status: 'Success', message: 'Data updated successfully' });
	} catch (error) {
		console.error('Error updating household:', error);
		return json({ status: 'Error', error: 'Failed to update household' }, { status: 500 });
	}
};
