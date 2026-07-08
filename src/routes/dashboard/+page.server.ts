import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Barangay, SessionUser } from '$lib/utils/types';
import { ROLES } from '$lib/utils/roles';
import clientPromise from '$lib/server/mongo';

type HouseholdDocument = {
	latitude: string;
	longitude: string;
	tag: string;
};

type HouseholdCoordinate = {
	lat: number;
	lng: number;
	tag: string;
};

export const ssr = false;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const role = locals.user.role;
	const db = await clientPromise();
	const Household = db.collection('households');

	// Tag counts are cheap and useful to every role.
	const tagGroups = (await Household.aggregate([
		{
			$group: {
				_id: { $ifNull: ['$tag', 'UNTAGGED'] },
				count: { $sum: 1 }
			}
		}
	]).toArray()) as { _id: string; count: number }[];

	const tagCounts = { APIN: 0, KONTRA: 0, UNTAGGED: 0 };
	for (const group of tagGroups) {
		if (group._id === 'APIN' || group._id === 'KONTRA') {
			tagCounts[group._id] = group.count;
		} else {
			// Any empty-string / legacy tag value folds into UNTAGGED.
			tagCounts.UNTAGGED += group.count;
		}
	}

	// Encoders and Grant Officers get a light, task-focused landing — skip the
	// heavy map data entirely.
	if (role !== ROLES.ADMINISTRATOR) {
		let activeGrants = 0;
		if (role === ROLES.GRANT_OFFICER) {
			activeGrants = await db.collection('grants').countDocuments({ isActive: true });
		}
		return {
			user: locals.user as SessionUser,
			tagCounts,
			activeGrants,
			barangays: [] as Barangay[],
			households: [] as HouseholdCoordinate[]
		};
	}

	// Administrator: full overview with the household map.
	const Barangay = db.collection('barangays');
	const [barangays, householdsWithCoords] = await Promise.all([
		Barangay.find().toArray(),
		Household.find(
			{ latitude: { $exists: true }, longitude: { $exists: true } },
			{ projection: { latitude: 1, longitude: 1, tag: 1 } }
		).toArray() as unknown as Promise<HouseholdDocument[]>
	]);

	const householdCoordinates = householdsWithCoords
		.map(
			(h: HouseholdDocument): HouseholdCoordinate => ({
				lat: Number(h.latitude),
				lng: Number(h.longitude),
				tag: h.tag
			})
		)
		.filter((h: HouseholdCoordinate) => !Number.isNaN(h.lat) && !Number.isNaN(h.lng));

	return {
		user: locals.user as SessionUser,
		barangays: barangays as unknown as Barangay[],
		households: householdCoordinates,
		tagCounts,
		activeGrants: 0
	};
};
