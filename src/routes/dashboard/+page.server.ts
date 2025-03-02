import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Barangay, User } from '$lib/utils/types';
import clientPromise from '$lib/server/mongo';

type LoadResult = {
	user: User;
	barangays: Barangay[];
	households: { lat: number; lng: number; tag: string }[];
	tagCounts: {
		APIN: number;
		KONTRA: number;
		UNTAGGED: number;
	};
};

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

export const load: PageServerLoad = async ({
	locals
}: Parameters<PageServerLoad>[0]): Promise<LoadResult> => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	// Add authorization check for ADMINISTRATOR role
	if (locals.user.role !== 'ADMINISTRATOR') {
		throw redirect(302, '/unauthorized');
	}

	const db = await clientPromise();
	const Barangay = db.collection('barangays');
	const Household = db.collection('households');

	// Separate queries for coordinates and tag counts
	const [barangays, householdsWithCoords, allHouseholds] = await Promise.all([
		Barangay.find().toArray(),
		Household.find(
			{ latitude: { $exists: true }, longitude: { $exists: true } },
			{ projection: { latitude: 1, longitude: 1, tag: 1 } }
		).toArray() as Promise<HouseholdDocument[]>,
		Household.find({}, { projection: { tag: 1 } }).toArray()
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

	// Calculate tag counts from all households, not just those with coordinates
	const tagCounts = {
		APIN: allHouseholds.filter((h: { tag?: string }) => h.tag === 'APIN').length,
		KONTRA: allHouseholds.filter((h: { tag?: string }) => h.tag === 'KONTRA').length,
		UNTAGGED: allHouseholds.filter((h: { tag?: string }) => !h.tag || h.tag === 'UNTAGGED').length
	};

	return {
		user: locals.user as User,
		barangays,
		households: householdCoordinates,
		tagCounts
	};
};
