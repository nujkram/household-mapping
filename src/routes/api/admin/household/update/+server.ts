import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { householdUpdateSchema, pickSurveyFields, badRequest } from '$lib/server/validation';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';
import { syncFamilyLinks } from '$lib/server/familyLinks';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = householdUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	try {
		const db = await clientPromise();
		const Household = db.collection('households');

		// A cluster-scoped encoder may only edit households in their cluster —
		// check both the existing record's barangay and the submitted one.
		const existing = await Household.findOne(
			{ _id: data._id },
			{ projection: { barangayId: 1, parentHouseholdId: 1 } }
		);
		if (
			!(await encoderMayAccessBarangay(db, locals.user, existing?.barangayId)) ||
			!(await encoderMayAccessBarangay(db, locals.user, data.barangayId))
		) {
			return json(
				{ status: 'Error', error: 'This household is outside your assigned cluster' },
				{ status: 403 }
			);
		}

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
			// Optional survey fields (validated by the schema)
			...pickSurveyFields(data),
			updatedBy: locals.user._id
		};
		if (data.tag) set.tag = data.tag;

		const result = await Household.updateOne({ _id: data._id }, { $set: set });

		if (result.matchedCount === 0) {
			return json({ status: 'Error', error: 'Household not found' }, { status: 404 });
		}

		// Multi-family dwellings: keep the family↔dwelling relation in sync with
		// the dependent links (and share this dwelling's pin with sub-families).
		await syncFamilyLinks(
			db,
			data._id,
			data.dependentDetails,
			{ latitude: data.latitude, longitude: data.longitude },
			existing?.parentHouseholdId
		);

		return json({ status: 'Success', message: 'Data updated successfully' });
	} catch (error) {
		console.error('Error updating household:', error);
		return json({ status: 'Error', error: 'Failed to update household' }, { status: 500 });
	}
};
