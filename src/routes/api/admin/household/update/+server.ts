import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise, { withTransaction } from '$lib/server/mongo';
import { householdUpdateSchema, pickSurveyFields, badRequest } from '$lib/server/validation';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';
import { syncFamilyLinks } from '$lib/server/familyLinks';
import { parseCoord } from '$lib/utils/geo';
import { canTagHouseholds } from '$lib/utils/roles';
import { encoderTaggingEnabled } from '$lib/server/settings';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = householdUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	try {
		const db = await clientPromise();
		const Household = db.collection('households');

		const existing = await Household.findOne(
			{ _id: data._id },
			{ projection: { barangayId: 1, parentHouseholdId: 1 } }
		);
		if (!existing) {
			return json({ status: 'Error', error: 'Household not found' }, { status: 404 });
		}

		// A cluster-scoped encoder may only edit households in their cluster —
		// check both the existing record's barangay and the submitted one.
		if (
			!(await encoderMayAccessBarangay(db, locals.user, existing.barangayId)) ||
			!(await encoderMayAccessBarangay(db, locals.user, data.barangayId))
		) {
			return json(
				{ status: 'Error', error: 'This household is outside your assigned cluster' },
				{ status: 403 }
			);
		}

		// A non-empty household code must be unique across OTHER records.
		if (data.householdCode) {
			const dupCode = await Household.findOne(
				{ _id: { $ne: data._id }, householdCode: data.householdCode },
				{ projection: { _id: 1 } }
			);
			if (dupCode) {
				return json(
					{ status: 'Error', error: `A household with code ${data.householdCode} already exists.` },
					{ status: 409 }
				);
			}
		}

		const set: Record<string, unknown> = {
			updatedAt: new Date(),
			householdCode: data.householdCode,
			lastName: data.lastName,
			middleName: data.middleName,
			firstName: data.firstName,
			fullName: `${data.firstName} ${data.middleName} ${data.lastName}`.replace(/\s+/g, ' ').trim(),
			gender: data.gender,
			phone: data.phone,
			dateOfBirth: data.dateOfBirth ?? null,
			dependents: data.dependents,
			dependentDetails: data.dependentDetails,
			isVoter: data.isVoter,
			latitude: data.latitude,
			longitude: data.longitude,
			// Numeric mirror for indexed viewport/bounds queries.
			lat: parseCoord(data.latitude),
			lng: parseCoord(data.longitude),
			// Optional survey fields (validated by the schema)
			...pickSurveyFields(data),
			updatedBy: locals.user._id
		};
		// Admins may always change the tag; encoders only while the app-wide
		// encoderTagging setting is on. For everyone else the field is silently
		// left untouched — a rejected tag must never fail an otherwise-valid
		// household edit. Fresh read: this is an enforcement point, not a render.
		// `data.tag &&` short-circuits first, so a submit carrying no tag costs no
		// settings read.
		if (data.tag && canTagHouseholds(locals.user.role, await encoderTaggingEnabled({ fresh: true })))
			set.tag = data.tag;

		// Optimistic concurrency: only write if updatedAt still matches what the
		// client loaded. Prevents one editor silently clobbering another's save.
		const filter: Record<string, unknown> = { _id: data._id };
		if (data.expectedUpdatedAt) filter.updatedAt = new Date(data.expectedUpdatedAt);

		// The document write and the family-link resync commit all-or-nothing.
		const conflict = await withTransaction(async (session) => {
			const opts = session ? { session } : {};
			const result = await Household.updateOne(filter, { $set: set }, opts);
			if (result.matchedCount === 0) return true; // version mismatch → abort
			await syncFamilyLinks(
				db,
				data._id,
				data.dependentDetails,
				{ latitude: data.latitude, longitude: data.longitude },
				existing.parentHouseholdId as string | undefined,
				session
			);
			return false;
		});

		if (conflict) {
			return json(
				{
					status: 'Error',
					error: 'This household was changed by someone else. Please reload and try again.'
				},
				{ status: 409 }
			);
		}

		return json({ status: 'Success', message: 'Data updated successfully' });
	} catch (error) {
		// Unique index race on householdCode (the pre-check can't cover concurrency).
		if ((error as { code?: number })?.code === 11000) {
			return json(
				{ status: 'Error', error: `A household with code ${data.householdCode} already exists.` },
				{ status: 409 }
			);
		}
		console.error('Error updating household:', error);
		return json({ status: 'Error', error: 'Failed to update household' }, { status: 500 });
	}
};
