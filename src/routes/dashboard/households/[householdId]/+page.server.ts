import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';

export const load: PageServerLoad = async ({ params, locals }) => {
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

	// A cluster-scoped encoder can't open households outside their cluster.
	if (locals.user && !(await encoderMayAccessBarangay(db, locals.user, household.barangayId))) {
		throw error(403, 'This household is outside your assigned cluster');
	}

	// Patient-service records recorded against this household.
	const familyProjection = {
		projection: { _id: 1, fullName: 1, tag: 1, dependents: 1, dependentDetails: 1 }
	};
	const [services, subFamilies, parentHousehold] = await Promise.all([
		db
			.collection('services')
			.find({ householdId: params.householdId })
			.sort({ dateReceived: -1 })
			.toArray(),
		// Families living in this household's dwelling.
		db
			.collection('households')
			.find({ parentHouseholdId: params.householdId, isActive: true }, familyProjection)
			.sort({ fullName: 1 })
			.toArray(),
		// The dwelling this family lives in, if it's a member of another household.
		household.parentHouseholdId
			? db
					.collection('households')
					.findOne({ _id: household.parentHouseholdId }, familyProjection)
			: null
	]);

	return { household, services, subFamilies, parentHousehold };
};
