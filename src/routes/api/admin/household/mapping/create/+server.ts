import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { id } from '$lib/common/utils';
import clientPromise, { withTransaction } from '$lib/server/mongo';
import {
	householdMappingCreateSchema,
	householdSurveySchema,
	badRequest
} from '$lib/server/validation';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';
import { syncFamilyLinks } from '$lib/server/familyLinks';
import { resolveGrantAwards } from '$lib/server/grantAwards';
import { canFillHouseholdMapping } from '$lib/utils/roles';
import { parseCoord } from '$lib/utils/geo';

type Doc = { _id: string; [key: string]: unknown };

/**
 * Taggers create a household FROM the Household Mapping sheet: row 1 becomes
 * the head of the family, the other rows its members (new, or linked to an
 * existing household record), plus Services Availed. Everything the sheet
 * doesn't have (phone, voter flag, census survey, pin) starts at its default
 * — the pin at the barangay's coordinates — for an encoder to complete later.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });
	// Backstop for the hook's prefix table (see the ROUTE_ROLES ordering note).
	if (!canFillHouseholdMapping(locals.user.role)) {
		return json({ status: 'Error', error: 'Forbidden' }, { status: 403 });
	}

	const parsed = householdMappingCreateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();

	// A cluster-scoped tagger may only add households in their cluster.
	if (!(await encoderMayAccessBarangay(db, locals.user, data.barangayId))) {
		return json(
			{ status: 'Error', error: 'That barangay is outside your assigned cluster' },
			{ status: 403 }
		);
	}

	// String _ids (Meteor-style) — type the collections to accept them.
	const Household = db.collection<Doc>('households');
	const Barangay = db.collection<Doc>('barangays');

	// The sheet has no location: pin the barangay's coordinates unless given.
	let { latitude, longitude } = data;
	if (!latitude || !longitude) {
		const barangay = await Barangay.findOne(
			{ _id: data.barangayId },
			{ projection: { latitude: 1, longitude: 1 } }
		);
		latitude = barangay?.latitude ? String(barangay.latitude) : '';
		longitude = barangay?.longitude ? String(barangay.longitude) : '';
	}

	// A non-empty household code must be unique (also backed by a partial unique
	// index; this pre-check gives a friendly message before hitting it).
	if (data.householdCode) {
		const duplicate = await Household.findOne(
			{ householdCode: data.householdCode },
			{ projection: { _id: 1 } }
		);
		if (duplicate) {
			return json(
				{ status: 'Error', error: `A household with code ${data.householdCode} already exists.` },
				{ status: 409 }
			);
		}
	}

	// "Services Availed" ticks → grant awards, validated against the catalog.
	const awards = await resolveGrantAwards(db, data.grants, undefined, locals.user._id);
	if (awards.error) return json({ status: 'Error', error: awards.error }, { status: 400 });

	const householdId = id();
	const dependentDetails = data.dependentDetails.map((d) => ({
		...d,
		householdId: d.householdId || householdId,
		fullName: `${d.firstName} ${d.middleName} ${d.lastName}`.replace(/\s+/g, ' ').trim()
	}));

	const now = new Date();
	const household = {
		_id: householdId,
		barangayId: data.barangayId,
		householdCode: data.householdCode,
		firstName: data.firstName,
		middleName: data.middleName,
		lastName: data.lastName,
		fullName: `${data.firstName} ${data.middleName} ${data.lastName}`.replace(/\s+/g, ' ').trim(),
		gender: data.gender,
		dateOfBirth: data.dateOfBirth || null,
		// Not on the sheet — the encoder's to complete.
		phone: '',
		isVoter: false,
		dependents: dependentDetails.length,
		dependentDetails,
		latitude,
		longitude,
		// Numeric mirror of the coordinates for indexed viewport/bounds queries.
		lat: parseCoord(latitude),
		lng: parseCoord(longitude),
		// Census survey at its "not answered" defaults, except the sheet's status ticks.
		...householdSurveySchema.parse({}),
		categories: data.categories,
		remarks: data.remarks,
		otherServicesAvailed: data.otherServicesAvailed,
		grants: awards.grants,
		// Set by syncFamilyLinks when another record links this family as a member.
		parentHouseholdId: '',
		isActive: true,
		createdAt: now,
		updatedAt: now,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	};

	// Insert + family-link resync commit all-or-nothing.
	try {
		await withTransaction(async (session) => {
			await Household.insertOne(household, session ? { session } : {});
			// Members linked to existing records make those families part of this dwelling.
			await syncFamilyLinks(
				db,
				householdId,
				dependentDetails,
				{ latitude, longitude },
				undefined,
				session
			);
		});
	} catch (error) {
		// Unique index race on householdCode (the pre-check can't cover concurrency).
		if ((error as { code?: number })?.code === 11000) {
			return json(
				{ status: 'Error', error: `A household with code ${data.householdCode} already exists.` },
				{ status: 409 }
			);
		}
		throw error;
	}

	return json({
		status: 'Success',
		message: 'Household created from the mapping sheet',
		householdId
	});
};
