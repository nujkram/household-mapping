import clientPromise from '$lib/server/mongo';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ request }: any) => {
	const db = await clientPromise();
	const Barangay = db.collection('barangays');

	const pipeline = [
		{
			$match: { isActive: true }
		},
		{
			$lookup: {
				from: 'households',
				localField: '_id',
				foreignField: 'barangayId',
				as: 'households'
			}
		},
		{
			$sort: { name: 1 }
		}
	];

	const response = await Barangay.aggregate(pipeline).toArray();

	if (response) {
		return new Response(
			JSON.stringify({
				status: 'Success',
				response
			})
		);
	}
};
