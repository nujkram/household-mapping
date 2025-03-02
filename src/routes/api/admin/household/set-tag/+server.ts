import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { ObjectId } from 'mongodb';

// Define the valid tag values
type HouseholdTag = 'APIN' | 'KONTRA' | 'UNTAGGED';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { householdId, tag } = await request.json();

		if (locals?.user?.role !== 'ADMINISTRATOR') {
			return json({
				status: 401,
				error: 'Unauthorized'
			});
		}

		if (!householdId) {
			return json({
				status: 400,
				error: 'Household ID is required'
			});
		}

		const validTags: HouseholdTag[] = ['APIN', 'KONTRA', 'UNTAGGED'];
		if (tag && !validTags.includes(tag as HouseholdTag)) {
			return json({
				status: 400,
				error: 'Invalid tag value. Must be APIN, KONTRA, or UNTAGGED'
			});
		}

		const db = await clientPromise();
		const collection = db.collection('households');

		const result = await collection.updateOne(
			{ _id: householdId },
			{ $set: { tag: tag || 'UNTAGGED' } }
		);

		if (result.matchedCount === 0) {
			return json({
				status: 404,
				error: 'Household not found'
			});
		}

		return json({
			status: 200,
			message: `Household tagged as ${tag || 'UNTAGGED'} successfully`
		});
	} catch (error) {
		console.error('Error updating household tag:', error);
		return json({
			status: 500,
			error: 'Failed to update household tag'
		});
	}
};
