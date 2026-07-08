import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hashPassword } from '$lib/server/auth';
import clientPromise from '$lib/server/mongo';
import { resetPasswordSchema, badRequest } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);
	const data = parsed.data;

	const db = await clientPromise();
	const User = db.collection('users');

	const result = await User.updateOne(
		{ _id: data._id },
		{
			$set: {
				'services.password.bcrypt': await hashPassword(data.password),
				// Invalidate all existing sessions on password reset.
				'services.resume.loginTokens': [],
				updatedBy: locals.user._id,
				updatedAt: new Date()
			}
		}
	);

	if (result.matchedCount === 0) {
		return json({ status: 'Error', error: 'User not found' }, { status: 404 });
	}

	return json({ status: 'Success', message: 'Password reset successfully' });
};
