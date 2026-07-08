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
	const Household = db.collection('households');

	const result = await Household.updateOne(
		{ _id: householdId },
		{
			$pull: { grants: { grantId } },
			$set: { updatedAt: new Date(), updatedBy: locals.user._id }
		}
	);

	if (result.matchedCount === 0) {
		return json({ status: 'Error', error: 'Household not found' }, { status: 404 });
	}
	if (result.modifiedCount === 0) {
		return json(
			{ status: 'Error', error: 'This household does not have that grant' },
			{ status: 404 }
		);
	}

	return json({ status: 'Success', message: 'Grant removed successfully' });
};
