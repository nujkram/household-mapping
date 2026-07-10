import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { userUpdateSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = userUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	// Prevent locking yourself out.
	if (data._id === locals.user._id && data.isActive === false) {
		return json(
			{ status: 'Error', error: 'You cannot deactivate your own account.' },
			{ status: 400 }
		);
	}

	const db = await clientPromise();
	const User = db.collection('users');

	const result = await User.updateOne(
		{ _id: data._id },
		{
			$set: {
				updatedAt: new Date(),
				fullName: `${data.firstName} ${data.lastName}`,
				firstName: data.firstName,
				lastName: data.lastName,
				phone: data.phone,
				// Admin-controlled; deactivating cuts login + existing sessions.
				isActive: data.isActive,
				// Validated against the role whitelist by userUpdateSchema.
				role: data.role,
				// Cluster scoping only applies to encoders.
				cluster: data.role === 'ENCODER' ? data.cluster : '',
				updatedBy: locals.user._id
			}
		}
	);

	if (result.matchedCount === 0) {
		return json({ status: 'Error', error: 'User not found' }, { status: 404 });
	}

	return json({ status: 'Success', message: 'Data updated successfully' });
};
