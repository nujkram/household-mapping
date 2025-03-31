import clientPromise from '$lib/server/mongo';

export const GET = async ({ request }: any) => {
	const db = await clientPromise();
	const householdsCollection = db.collection('households');

	const households = await householdsCollection.find({ isActive: true }).toArray();

	return new Response(
		JSON.stringify({
			status: 'Success',
			response: households
		})
	);
};
