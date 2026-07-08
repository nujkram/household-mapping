import clientPromise from '$lib/server/mongo';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const ssr = false;

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	if (locals.user.role !== 'ADMINISTRATOR') {
		throw redirect(302, '/unauthorized');
	}

	const { householdId } = params;
	const db = await clientPromise();
	const Household = db.collection('households');

	const pipeline = [
		{
			$match: { _id: householdId }
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
			// Never ship the joined user's password hash / login tokens.
			$project: {
				'createdBy.services': 0,
				'createdBy.emails': 0
			}
		}
	];

	const [householdDetail] = await Household.aggregate(pipeline).toArray();

	return { householdDetail };
};
