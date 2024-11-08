import { error } from '@sveltejs/kit';
import clientPromise from '$lib/server/mongo';
import { hashPassword } from '$lib/common/utils';

export const POST = async ({ request, cookies }) => {
	const { username, password } = await request.json();

	const db = await clientPromise();
	const Users = db.collection('users');

	const user = await Users.findOne({ username });

	if (!user) {
		throw error(401, 'Invalid credentials');
	}

	// Generate a new login token
	const loginToken = crypto.randomUUID();
	const hashedToken = await hashPassword(loginToken);

	// Update user's login tokens
	await Users.updateOne(
		{ _id: user._id },
		{
			$push: {
				'services.resume.loginTokens': {
					hashedToken,
					when: new Date()
				}
			}
		}
	);

	// Set the cookie
	cookies.set('meteor_login_token', hashedToken, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7 // 1 week
	});

	return new Response(
		JSON.stringify({
			user: {
				_id: user._id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				role: user.role,
				fullName: user.fullName
			}
		})
	);
};
