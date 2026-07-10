import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';

// Used by the dependent-linking search in the household Create/Update forms.
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	try {
		const { barangayId } = params;
		const db = await clientPromise();

		// A cluster-scoped encoder may only list barangays inside their cluster.
		if (!(await encoderMayAccessBarangay(db, locals.user, barangayId))) {
			return json(
				{ status: 'Error', error: 'That barangay is outside your assigned cluster' },
				{ status: 403 }
			);
		}

		// Only the fields the dependent-linking picker uses — not full PII.
		const response = await db
			.collection('households')
			.find(
				{ barangayId, isActive: true },
				{
					projection: {
						_id: 1,
						firstName: 1,
						middleName: 1,
						lastName: 1,
						fullName: 1,
						dateOfBirth: 1,
						gender: 1,
						isVoter: 1,
						latitude: 1,
						longitude: 1
					}
				}
			)
			.toArray();

		return json({ status: 'Success', response });
	} catch (error) {
		console.error('Error fetching households:', error);
		return json({ status: 'Error', message: 'Failed to fetch households' }, { status: 500 });
	}
};
