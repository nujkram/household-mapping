import clientPromise from '$lib/server/mongo';
import { checkKey } from '$lib/utils/keyHelper';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request, locals }: any) => {
	let data = await request.json();
	const db = await clientPromise();
	const User = db.collection('users');

	data = checkKey(data);

	const userUpdate = {
		$set: {
			updatedAt: new Date(),
			fullName: `${data.firstName} ${data.lastName}`,
			firstName: data.firstName,
			lastName: data.lastName,
			isActive: true,
			role: data.role,
			updatedBy: locals.user._id
		}
	};

	const response = await User.updateOne({ _id: data._id }, userUpdate);

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
