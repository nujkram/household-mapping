import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';

export const GET: RequestHandler = async () => {
	const db = await clientPromise();
	const Users = db.collection('users');

	// Never serialize password hashes or login tokens to the client.
	const response = await Users.find({}, { projection: { services: 0 } })
		.sort({ createdAt: -1 })
		.toArray();

	return json({ status: 'Success', response });
};
