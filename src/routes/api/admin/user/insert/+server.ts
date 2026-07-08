import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { id } from '$lib/common/utils';
import { hashPassword } from '$lib/server/auth';
import clientPromise from '$lib/server/mongo';
import { userInsertSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = userInsertSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	// String _ids (Meteor-style) — type the collection to accept them.
	const User = db.collection<{ _id: string; [key: string]: unknown }>('users');

	// Reject duplicate usernames up front with a clean message.
	if (await User.findOne({ username: data.username }, { projection: { _id: 1 } })) {
		return json({ status: 'Error', error: 'Username already exists' }, { status: 409 });
	}

	const now = new Date();
	const user = {
		_id: id(),
		createdAt: now,
		updatedAt: now,
		services: {
			password: { bcrypt: await hashPassword(data.password) },
			resume: { loginTokens: [] }
		},
		emails: [{ address: data.email, verified: true }],
		fullName: `${data.firstName} ${data.lastName}`,
		firstName: data.firstName,
		lastName: data.lastName,
		username: data.username,
		email: data.email,
		phone: data.phone,
		isActive: true,
		isFake: false,
		// Validated against the role whitelist by userInsertSchema.
		role: data.role,
		createdBy: locals.user._id,
		updatedBy: locals.user._id
	};

	await User.insertOne(user);
	return json({ status: 'Success', message: 'Data inserted successfully' });
};
