import clientPromise from '$lib/server/mongo';

export const ssr = false;

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const { userId } = params;
	const db = await clientPromise();
	const User = db.collection('users');

	const pipeline = [
		{
			$match: { _id: userId }
		},
		{
			$lookup: {
				from: 'users',
				localField: 'createdBy',
				foreignField: '_id',
				as: 'createdBy'
			}
		},
		{
			$unwind: {
				path: '$createdBy',
				preserveNullAndEmptyArrays: true
			}
		},
		{
			// Strip password hashes / login tokens from both the user and the
			// joined createdBy document before sending to the client.
			$project: {
				services: 0,
				'createdBy.services': 0
			}
		}
	];

	const [userDetail] = await User.aggregate(pipeline).toArray();

	return { userDetail };
}
