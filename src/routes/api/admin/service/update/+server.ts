import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { serviceUpdateSchema, badRequest } from '$lib/server/validation';
import { pesosToCentavos } from '$lib/utils/money';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = serviceUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	const Service = db.collection('services');

	const result = await Service.updateOne(
		{ _id: data._id },
		{
			$set: {
				patientName: data.patientName,
				categories: data.categories,
				// Stored as integer centavos; readers ignore any legacy float `amount`.
				amountCentavos: pesosToCentavos(data.amount),
				dateReceived: data.dateReceived,
				updatedAt: new Date(),
				updatedBy: locals.user._id
			}
		}
	);

	if (result.matchedCount === 0) {
		return json({ status: 'Error', error: 'Service not found' }, { status: 404 });
	}

	return json({ status: 'Success', message: 'Service updated successfully' });
};
