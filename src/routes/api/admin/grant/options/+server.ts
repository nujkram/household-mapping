import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';

/**
 * Active grants for the household form's "Services Availed" picker. Readable by
 * every role (the hook allows it), unlike the full catalog endpoint — it carries
 * no recipient counts, just what's needed to tick a service.
 */
export const GET: RequestHandler = async () => {
	const db = await clientPromise();
	const response = await db
		.collection('grants')
		.find({ isActive: true }, { projection: { _id: 1, name: 1, year: 1, isActive: 1 } })
		.sort({ year: -1, name: 1 })
		.toArray();

	return json({ status: 'Success', response });
};
