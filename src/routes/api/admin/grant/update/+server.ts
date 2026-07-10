import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise, { withTransaction } from '$lib/server/mongo';
import { grantUpdateSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = grantUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	const Grant = db.collection('grants');
	const Household = db.collection('households');

	// Duplicate name+year check against OTHER grants.
	const duplicate = await Grant.findOne(
		{ name: data.name, year: data.year, _id: { $ne: data._id } },
		{ projection: { _id: 1 } }
	);
	if (duplicate) {
		return json(
			{ status: 'Error', error: `A grant named "${data.name}" already exists for ${data.year}` },
			{ status: 409 }
		);
	}

	const set: Record<string, unknown> = {
		name: data.name,
		year: data.year,
		releasedDate: data.releasedDate,
		updatedAt: new Date(),
		updatedBy: locals.user._id
	};
	if (typeof data.isActive === 'boolean') set.isActive = data.isActive;

	// The grant edit and the propagation of its new name/year into every
	// household's awarded-grant snapshot commit all-or-nothing — so a record
	// never shows a stale name because propagation half-failed.
	const notFound = await withTransaction(async (session) => {
		const opts = session ? { session } : {};
		const result = await Grant.updateOne({ _id: data._id }, { $set: set }, opts);
		if (result.matchedCount === 0) return true;

		await Household.updateMany(
			{ 'grants.grantId': data._id },
			{
				$set: {
					'grants.$[elem].name': data.name,
					'grants.$[elem].year': data.year
				}
			},
			{ arrayFilters: [{ 'elem.grantId': data._id }], ...opts }
		);
		return false;
	});

	if (notFound) {
		return json({ status: 'Error', error: 'Grant not found' }, { status: 404 });
	}

	return json({ status: 'Success', message: 'Grant updated successfully' });
};
