import clientPromise from '$lib/server/mongo';
import { checkKey } from '$lib/utils/keyHelper';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		let data = await request.json();
		const db = await clientPromise();
		const Household = db.collection('households');

		data = checkKey(data);

		const householdUpdate = {
			$set: {
				updatedAt: new Date(),
				name: data.name,
				lastName: data.lastName,
				middleName: data.middleName,
				firstName: data.firstName,
				fullName: `${data.firstName} ${data.middleName} ${data.lastName}`,
				phone: data.phone,
				dateOfBirth: data.dateOfBirth,
				dependents: data.dependents,
				dependentDetails: data.dependentDetails,
				isVoter: data.isVoter,
				latitude: data.latitude,
				longitude: data.longitude,
				tag: data.tag,
				updatedBy: locals.user._id
			}
		};

		const response = await Household.updateOne({ _id: data._id }, householdUpdate);

		if (response) {
			return new Response(
				JSON.stringify({
					status: 'Success',
					message: 'Data updated successfully',
					response
				})
			);
		}
	} catch (error) {
		console.error('Error updating household:', error);
		return new Response(
			JSON.stringify({
				status: 'Error',
				message: 'Failed to update household'
			}),
			{ status: 500 }
		);
	}
};
