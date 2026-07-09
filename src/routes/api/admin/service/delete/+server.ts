import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { z } from 'zod';
import { badRequest } from '$lib/server/validation';

const schema = z.object({ _id: z.string().min(1) });

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = schema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);

	const db = await clientPromise();
	const result = await db.collection('services').deleteOne({ _id: parsed.data._id });

	if (result.deletedCount === 0) {
		return json({ status: 'Error', error: 'Service not found' }, { status: 404 });
	}

	return json({ status: 'Success', message: 'Service deleted' });
};
