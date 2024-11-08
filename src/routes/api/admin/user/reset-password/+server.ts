import { hashPassword } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request, locals }: any) => {
	const data = await request.json();
	const db = await clientPromise();
	const User = db.collection('users');

	const userUpdate = {
		$set: {
			services: {
				password: {
					bcrypt: await hashPassword(data.password)
				},
				resume: {
					loginTokens: []
				}
			},
			updatedBy: locals.user._id,
			updatedAt: new Date()
		}
	};

	const response = await User.updateOne({ _id: data._id }, userUpdate);

	if (response) {
		return new Response(
			JSON.stringify({
				status: 'Success',
				message: 'Password reset successfully',
				response
			})
		);
	}
};
