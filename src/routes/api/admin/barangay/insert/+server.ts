import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { checkKey } from '$lib/utils/keyHelper';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request, locals }: any) => {
	let data = await request.json();
	const db = await clientPromise();
	const Barangay = db.collection('barangays');

	data = checkKey(data);

	data._id = id();
	data.fullName = `${data.firstName} ${data.middleName} ${data.lastName}`;
	data.createdAt = new Date();
	data.updatedAt = new Date();
	data.createdBy = locals.user._id;
	data.updatedBy = locals.user._id;
	data.isActive = true;

	const response = await Barangay.insertOne(data);
	if (response) {
		return new Response(
			JSON.stringify({
				status: 'Success',
				message: 'Data inserted successfully',
				response
			})
		);
	}
};
