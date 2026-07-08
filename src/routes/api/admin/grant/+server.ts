import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';

export const GET: RequestHandler = async ({ url }) => {
	const db = await clientPromise();
	const Grant = db.collection('grants');

	// ?active=1 → only grants that can still be awarded (for pickers).
	const activeOnly = url.searchParams.get('active') === '1';
	const match = activeOnly ? { isActive: true } : {};

	// Each grant carries how many households have received it.
	const response = await Grant.aggregate([
		{ $match: match },
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

	return json({ status: 'Success', response });
};
