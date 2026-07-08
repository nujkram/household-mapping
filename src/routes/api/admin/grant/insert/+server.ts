import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { grantInsertSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = grantInsertSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	const Grant = db.collection<{ _id: string; [key: string]: unknown }>('grants');

	// The same grant name in the same year is almost certainly a double entry.
	const duplicate = await Grant.findOne(
		{ name: data.name, year: data.year },
		{ projection: { _id: 1 } }
	);
	if (duplicate) {
		return json(
			{ status: 'Error', error: `A grant named "${data.name}" already exists for ${data.year}` },
			{ status: 409 }
		);
	}

	const now = new Date();
	await Grant.insertOne({
		_id: id(),
		name: data.name,
		year: data.year,
		releasedDate: data.releasedDate,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	});

	return json({ status: 'Success', message: 'Grant created successfully' });
};
