import clientPromise from '$lib/server/mongo';

export const GET = async ({ params }: any) => {
	try {
		const { barangayId } = params;
		const db = await clientPromise();
		const Household = db.collection('households');

		const response = await Household.find({
			barangayId,
			isActive: true
		}).toArray();

		return new Response(
			JSON.stringify({
				status: 'Success',
				response
			})
		);
	} catch (error) {
		return new Response(
			JSON.stringify({
				status: 'Error',
				message: 'Failed to fetch households'
			}),
			{ status: 500 }
		);
	}
};
