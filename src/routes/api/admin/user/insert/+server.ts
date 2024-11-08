import { id, hashPassword } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { checkKey } from '$lib/utils/keyHelper';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request, locals }: any) => {
	let data = await request.json();
	const db = await clientPromise();
	const User = db.collection('users');

	data = checkKey(data);

	const user = {
		_id: id(),
		createdAt: new Date(),
		updatedAt: new Date(),
		services: {
			password: {
				bcrypt: await hashPassword(data.password)
			},
			resume: {
				loginTokens: []
			}
		},
		emails: [
			{
				address: data.email,
				verified: true
			}
		],
		fullName: `${data.firstName} ${data.lastName}`,
		firstName: data.firstName,
		lastName: data.lastName,
		username: data.username,
		email: data.email,
		isActive: true,
		isFake: false,
		role: data.role,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	};

	const response = await User.insertOne(user);
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
