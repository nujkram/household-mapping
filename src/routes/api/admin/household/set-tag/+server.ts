import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { canTagHouseholds } from '$lib/utils/roles';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';
import { encoderTaggingEnabled } from '$lib/server/settings';

// Define the valid tag values
type HouseholdTag = 'APIN' | 'KONTRA' | 'UNTAGGED';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { householdId, tag } = await request.json();

		// Real HTTP status codes so callers' `response.ok` checks work.
		//
		// The hook guard now admits ENCODERs to this route, so THIS check is the
		// only thing enforcing the app-wide switch. Read it FRESH — never from the
		// TTL cache — so an encoder can't slip a write through in the window after
		// an admin turns tagging off. Admins bypass the flag entirely.
		//
		// `!user ||` short-circuits ahead of the read, so an anonymous request
		// never costs a findOne.
		const user = locals.user;
		if (!user || !canTagHouseholds(user.role, await encoderTaggingEnabled({ fresh: true }))) {
			return json({ error: 'Household tagging is not enabled for your role' }, { status: 403 });
		}

		if (!householdId) {
			return json({ error: 'Household ID is required' }, { status: 400 });
		}

		const validTags: HouseholdTag[] = ['APIN', 'KONTRA', 'UNTAGGED'];
		if (tag && !validTags.includes(tag as HouseholdTag)) {
			return json(
				{ error: 'Invalid tag value. Must be APIN, KONTRA, or UNTAGGED' },
				{ status: 400 }
			);
		}

		const db = await clientPromise();
		const collection = db.collection('households');

		// A cluster-scoped encoder may only tag households inside their cluster.
		const target = await collection.findOne(
			{ _id: householdId },
			{ projection: { barangayId: 1 } }
		);
		if (!target) {
			return json({ error: 'Household not found' }, { status: 404 });
		}
		if (!(await encoderMayAccessBarangay(db, user, target.barangayId))) {
			return json({ error: 'This household is outside your assigned cluster' }, { status: 403 });
		}

		const result = await collection.updateOne(
			{ _id: householdId },
			{ $set: { tag: tag || 'UNTAGGED', updatedAt: new Date(), updatedBy: user._id } }
		);

		if (result.matchedCount === 0) {
			return json({ error: 'Household not found' }, { status: 404 });
		}

		return json({
			message: `Household tagged as ${tag || 'UNTAGGED'} successfully`
		});
	} catch (error) {
		console.error('Error updating household tag:', error);
		return json({ error: 'Failed to update household tag' }, { status: 500 });
	}
};
