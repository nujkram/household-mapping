import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise, { withTransaction } from '$lib/server/mongo';
import { householdMappingSchema, badRequest } from '$lib/server/validation';
import { encoderMayAccessBarangay } from '$lib/server/clusterAccess';
import { syncFamilyLinks } from '$lib/server/familyLinks';
import { resolveGrantAwards } from '$lib/server/grantAwards';
import { canFillHouseholdMapping } from '$lib/utils/roles';
import type { HouseholdGrant } from '$lib/utils/types';

// The sheet's STATUS column covers only these survey category codes; the
// others (Youth / Single Parent / Pregnant Woman) are the encoder's and must
// survive a tagger save untouched.
const STATUS_CODES = new Set(['PWD', 'SC']);
const mergeStatusCategories = (stored: unknown, submitted: string[]): string[] => {
	// No stored array (new or legacy row) → trust the client's round-trip.
	if (!Array.isArray(stored)) return submitted;
	return [
		...stored.filter((c): c is string => typeof c === 'string' && !STATUS_CODES.has(c)),
		...submitted.filter((c) => STATUS_CODES.has(c))
	];
};

/**
 * Taggers' Household Mapping sheet for an EXISTING household: the members
 * table (row 1 = head) and the Services Availed checklist. Writes only those
 * fields — everything else on the record stays the encoder's/admin's.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });
	// Backstop for the hook's prefix table (see the ROUTE_ROLES ordering note).
	if (!canFillHouseholdMapping(locals.user.role)) {
		return json({ status: 'Error', error: 'Forbidden' }, { status: 403 });
	}

	const parsed = householdMappingSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	try {
		const db = await clientPromise();
		const Household = db.collection('households');

		const existing = await Household.findOne(
			{ _id: data._id },
			{
				projection: {
					barangayId: 1,
					parentHouseholdId: 1,
					grants: 1,
					latitude: 1,
					longitude: 1,
					categories: 1,
					dependentDetails: 1
				}
			}
		);
		if (!existing) {
			return json({ status: 'Error', error: 'Household not found' }, { status: 404 });
		}

		// A cluster-scoped tagger may only fill in households in their cluster.
		if (!(await encoderMayAccessBarangay(db, locals.user, existing.barangayId))) {
			return json(
				{ status: 'Error', error: 'This household is outside your assigned cluster' },
				{ status: 403 }
			);
		}

		// "Services Availed" ticks → grant awards. The list replaces the record's
		// awards (an untick = NO on the sheet); awards that stay keep their original
		// grantedBy / receivedAt.
		const awards = await resolveGrantAwards(
			db,
			data.grants,
			existing.grants as HouseholdGrant[] | undefined,
			locals.user._id
		);
		if (awards.error) return json({ status: 'Error', error: awards.error }, { status: 400 });

		// Members: the full objects round-trip (survey keys the encoder entered are
		// untouched); only the sheet's columns change. fullName is authoritative here.
		const priorMembers = new Map(
			((existing.dependentDetails ?? []) as { _id: string; categories?: unknown }[]).map((d) => [
				d._id,
				d
			])
		);
		const dependentDetails = data.dependentDetails.map((d) => ({
			...d,
			householdId: d.householdId || data._id,
			fullName: `${d.firstName} ${d.middleName} ${d.lastName}`.replace(/\s+/g, ' ').trim(),
			categories: mergeStatusCategories(priorMembers.get(d._id)?.categories, d.categories)
		}));

		// Only the sheet's fields. Names, phone, voter flag, barangay, code, pin, tag
		// and the census survey stay exactly as the encoder/admin left them.
		const set = {
			gender: data.gender,
			dateOfBirth: data.dateOfBirth || null,
			categories: mergeStatusCategories(existing.categories, data.categories),
			remarks: data.remarks,
			dependentDetails,
			dependents: dependentDetails.length,
			grants: awards.grants,
			otherServicesAvailed: data.otherServicesAvailed,
			updatedAt: new Date(),
			updatedBy: locals.user._id
		};

		// Optimistic concurrency: only write if updatedAt still matches what the
		// tagger loaded, so a concurrent encoder / grant-officer save isn't clobbered.
		const filter: Record<string, unknown> = { _id: data._id };
		if (data.expectedUpdatedAt) filter.updatedAt = new Date(data.expectedUpdatedAt);

		// The write and the family-link resync commit all-or-nothing.
		const conflict = await withTransaction(async (session) => {
			const opts = session ? { session } : {};
			const result = await Household.updateOne(filter, { $set: set }, opts);
			if (result.matchedCount === 0) return true; // version mismatch → abort
			// Linked members ↔ parentHouseholdId stay consistent (as in the encoder update).
			await syncFamilyLinks(
				db,
				data._id,
				dependentDetails,
				{ latitude: existing.latitude, longitude: existing.longitude },
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

		return json({ status: 'Success', message: 'Household mapping saved' });
	} catch (error) {
		console.error('Error saving household mapping:', error);
		return json({ status: 'Error', error: 'Failed to save household mapping' }, { status: 500 });
	}
};
