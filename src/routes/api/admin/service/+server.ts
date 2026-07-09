import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';

export const GET: RequestHandler = async () => {
	const db = await clientPromise();
	const Service = db.collection('services');
	const response = await Service.find({}).sort({ dateReceived: -1 }).toArray();
	return json({ status: 'Success', response });
};
