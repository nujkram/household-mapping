import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';

export const GET: RequestHandler = async () => {
	const db = await clientPromise();
	const Barangay = db.collection('barangays');

	// Plain find — no household $lookup. This endpoint feeds dropdowns, the
	// barangays table, and store refreshes after every form submit; embedding
	// every household document made all of those pay for data nobody rendered.
	// (The barangay detail page loads its own households in its page loader.)
	const response = await Barangay.find({ isActive: true }).sort({ name: 1 }).toArray();

	return json({ status: 'Success', response });
};
