import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { householdInsertSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = householdInsertSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
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
		isActive: true,
		createdAt: now,
		updatedAt: now,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	};

	await Household.insertOne(household);
	return json({ status: 'Success', message: 'Data inserted successfully' });
};
