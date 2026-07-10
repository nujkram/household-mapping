import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';

export const GET: RequestHandler = async () => {
	const db = await clientPromise();
	const Barangay = db.collection('barangays');

	// Plain find — no household $lookup. This endpoint feeds dropdowns, the
	// barangays table, and store refreshes after every form submit.
	// `$ne: false` (not `=== true`) so barangays seeded/imported without an
	// explicit isActive field still appear — only deactivated ones are hidden.
	const response = await Barangay.find({ isActive: { $ne: false } }).sort({ name: 1 }).toArray();

	return json({ status: 'Success', response });
};
