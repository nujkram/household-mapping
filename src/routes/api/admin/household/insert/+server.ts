import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { householdInsertSchema, pickSurveyFields, badRequest } from '$lib/server/validation';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';
import { syncFamilyLinks } from '$lib/server/familyLinks';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = householdInsertSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();

	// A cluster-scoped encoder may only add households in their cluster.
	if (!(await encoderMayAccessBarangay(db, locals.user, data.barangayId))) {
		return json(
			{ status: 'Error', error: 'That barangay is outside your assigned cluster' },
			{ status: 403 }
		);
	}

	// String _ids (Meteor-style) — type the collection to accept them.
	const Household = db.collection<{ _id: string; [key: string]: unknown }>('households');

	const now = new Date();
	const household = {
		_id: id(),
		barangayId: data.barangayId,
		firstName: data.firstName,
		middleName: data.middleName,
		lastName: data.lastName,
		fullName: `${data.firstName} ${data.middleName} ${data.lastName}`.replace(/\s+/g, ' ').trim(),
		gender: data.gender,
		dateOfBirth: data.dateOfBirth ?? null,
		phone: data.phone,
		isVoter: data.isVoter,
		dependents: data.dependents,
		dependentDetails: data.dependentDetails,
		latitude: data.latitude,
		longitude: data.longitude,
		// Optional survey fields (validated by the schema, '' / false / null = not answered)
		...pickSurveyFields(data),
		// Set by syncFamilyLinks when another record links this family as a member.
		parentHouseholdId: '',
		isActive: true,
		createdAt: now,
		updatedAt: now,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	};

	await Household.insertOne(household);

	// Multi-family dwellings: dependents linked at creation make those families
	// members of this new dwelling.
	await syncFamilyLinks(db, household._id, data.dependentDetails, {
		latitude: data.latitude,
		longitude: data.longitude
	});

	return json({ status: 'Success', message: 'Data inserted successfully' });
};
