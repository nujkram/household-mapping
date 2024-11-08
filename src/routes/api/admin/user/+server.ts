import clientPromise from '$lib/server/mongo';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ request }: any) => {
	const db = await clientPromise();
	const Users = db.collection('users');

	const response = await Users.find({}).sort({ createdAt: -1 }).toArray();

	if (response) {
		return new Response(
			JSON.stringify({
				status: 'Success',
				response
			})
		);
	}
};
