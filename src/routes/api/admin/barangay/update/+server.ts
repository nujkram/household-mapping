import clientPromise from '$lib/server/mongo';
import { checkKey } from '$lib/utils/keyHelper';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request, locals }: any) => {
	let data = await request.json();
	const db = await clientPromise();
	const Barangay = db.collection('barangays');

	data = checkKey(data);

	const barangayUpdate = {
		$set: {
			updatedAt: new Date(),
			name: data.name,
			lastName: data.lastName,
			middleName: data.middleName,
			firstName: data.firstName,
			fullName: `${data.firstName} ${data.middleName} ${data.lastName}`,
			phone: data.phone,
			latitude: data.latitude,
			longitude: data.longitude,
			updatedBy: locals.user._id
		}
	};

	const response = await Barangay.updateOne({ _id: data._id }, barangayUpdate);

	if (response) {
		return new Response(
			JSON.stringify({
				status: 'Success',
				message: 'Data updated successfully',
				response
			})
		);
	}
};
