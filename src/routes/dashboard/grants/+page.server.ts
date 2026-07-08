import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

export const load: PageServerLoad = async () => {
	try {
		const db = await clientPromise();
		const Grant = db.collection('grants');

		// Grants with how many households received each one.
		const grants = await Grant.aggregate([
			{ $sort: { year: -1, name: 1 } },
			{
				$lookup: {
					from: 'households',
					let: { gid: '$_id' },
					pipeline: [
						{ $match: { $expr: { $in: ['$$gid', { $ifNull: ['$grants.grantId', []] }] } } },
						{ $count: 'count' }
					],
					as: 'recipientCount'
				}
			},
			{
				$addFields: {
					recipients: { $ifNull: [{ $arrayElemAt: ['$recipientCount.count', 0] }, 0] }
				}
			},
			{ $project: { recipientCount: 0 } }
		]).toArray();

		return { grants };
	} catch (error) {
		console.error('Error loading grants:', error);
		return { grants: [] };
	}
};
