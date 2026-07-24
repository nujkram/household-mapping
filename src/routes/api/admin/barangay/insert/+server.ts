import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { barangayInsertSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = barangayInsertSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	// This app uses string _ids (Meteor-style); type the collection so inserts
	// with a string _id typecheck against the driver's ObjectId default.
	const Barangay = db.collection<{ _id: string; [key: string]: unknown }>('barangays');

	const now = new Date();
	const barangay = {
		_id: id(),
		name: data.name,
		firstName: data.firstName,
		middleName: data.middleName,
		lastName: data.lastName,
		fullName: `${data.firstName} ${data.middleName} ${data.lastName}`.replace(/\s+/g, ' ').trim(),
		phone: data.phone,
		latitude: data.latitude,
		longitude: data.longitude,
		cluster: data.cluster,
		regionCode: data.regionCode,
		provinceCode: data.provinceCode,
		cityMunicipalityCode: data.cityMunicipalityCode,
		barangayCode: data.barangayCode,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	};

	await Barangay.insertOne(barangay);
	return json({ status: 'Success', message: 'Data inserted successfully' });
};
