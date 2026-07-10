import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { serviceInsertSchema, badRequest } from '$lib/server/validation';
import { pesosToCentavos } from '$lib/utils/money';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = serviceInsertSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	const Service = db.collection<{ _id: string; [key: string]: unknown }>('services');

	const now = new Date();
	await Service.insertOne({
		_id: id(),
		householdId: data.householdId,
		patientName: data.patientName,
		categories: data.categories,
		amountCentavos: pesosToCentavos(data.amount),
		dateReceived: data.dateReceived,
		createdAt: now,
		updatedAt: now,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	});

	return json({ status: 'Success', message: 'Service recorded successfully' });
};
