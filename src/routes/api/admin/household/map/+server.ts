import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { allowedBarangayIdsFor } from '$lib/server/clusterAccess';

// Hard cap so a zoomed-out viewport can't ship the whole collection.
const CAP = 2000;
const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const num = (v: string | null): number | null => {
	if (v === null || v.trim() === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
};

// Households within the current map viewport, filtered + cluster-scoped + capped.
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const swLat = num(url.searchParams.get('swLat'));
	const swLng = num(url.searchParams.get('swLng'));
	const neLat = num(url.searchParams.get('neLat'));
	const neLng = num(url.searchParams.get('neLng'));
	if (swLat === null || swLng === null || neLat === null || neLng === null) {
		return json({ status: 'Error', error: 'Invalid bounds' }, { status: 400 });
	}

	const db = await clientPromise();

	const clauses: Record<string, unknown>[] = [
		{ isActive: true },
		{ lat: { $gte: swLat, $lte: neLat } },
		{ lng: { $gte: swLng, $lte: neLng } }
	];

	// Encoder scope (cluster or assigned barangays) — same enforcement as the
	// list/detail pages. An empty allow-list matches nothing, as intended.
	const allowed = await allowedBarangayIdsFor(db, locals.user);
	if (allowed) {
		clauses.push({ barangayId: { $in: allowed } });
	}

	// Optional filters mirrored from the map UI.
	const q = url.searchParams.get('q')?.trim();
	if (q) clauses.push({ fullName: { $regex: escapeRegex(q), $options: 'i' } });
	const barangay = url.searchParams.get('barangay');
	if (barangay) clauses.push({ barangayId: barangay });
	const tag = url.searchParams.get('tag');
	if (tag === 'UNTAGGED') clauses.push({ $or: [{ tag: 'UNTAGGED' }, { tag: { $in: [null, ''] } }] });
	else if (tag) clauses.push({ tag });

	const households = await db
		.collection('households')
		.find(
			{ $and: clauses },
			{
				projection: {
					_id: 1,
					fullName: 1,
					barangayId: 1,
					tag: 1,
					lat: 1,
					lng: 1,
					address: 1
				}
			}
		)
		.limit(CAP + 1)
		.toArray();

	const capped = households.length > CAP;
	return json({ status: 'Success', households: households.slice(0, CAP), capped, cap: CAP });
};
