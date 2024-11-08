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

	const { barangayId } = params;
	const db = await clientPromise();
	const Barangay = db.collection('barangays');

	const pipeline = [
		{
			$match: { _id: barangayId }
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
		}
	];

	const [barangayDetail] = await Barangay.aggregate(pipeline).toArray();

	return { barangayDetail };
};
