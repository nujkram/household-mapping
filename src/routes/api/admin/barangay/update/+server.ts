import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { barangayUpdateSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = barangayUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	const Barangay = db.collection('barangays');

	const result = await Barangay.updateOne(
		{ _id: data._id },
		{
			$set: {
				updatedAt: new Date(),
				name: data.name,
				lastName: data.lastName,
				middleName: data.middleName,
				firstName: data.firstName,
				fullName: `${data.firstName} ${data.middleName} ${data.lastName}`
					.replace(/\s+/g, ' ')
					.trim(),
				phone: data.phone,
				latitude: data.latitude,
				longitude: data.longitude,
				updatedBy: locals.user._id
			}
		}
	);

	if (result.matchedCount === 0) {
		return json({ status: 'Error', error: 'Barangay not found' }, { status: 404 });
	}

	return json({ status: 'Success', message: 'Data updated successfully' });
};
