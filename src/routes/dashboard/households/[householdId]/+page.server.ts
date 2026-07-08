import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

export const load: PageServerLoad = async ({ params }) => {
	const db = await clientPromise();
	const Household = db.collection('households');

	const pipeline = [
		{ $match: { _id: params.householdId } },
		{
			$lookup: {
				from: 'barangays',
				localField: 'barangayId',
				foreignField: '_id',
				as: 'barangay'
			}
		},
		{ $unwind: { path: '$barangay', preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: 'users',
				localField: 'createdBy',
				foreignField: '_id',
				as: 'createdByUser'
			}
		},
		{ $unwind: { path: '$createdByUser', preserveNullAndEmptyArrays: true } },
		{
			// Only the fields the page shows from the joined docs — and never
			// password hashes/login tokens from the user.
			$project: {
				'createdByUser.services': 0,
				'createdByUser.emails': 0
			}
		}
	];

	const [household] = await Household.aggregate(pipeline).toArray();

	if (!household) {
		throw error(404, 'Household not found');
	}

	return { household };
};
