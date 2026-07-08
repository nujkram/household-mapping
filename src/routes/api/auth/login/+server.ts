import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { verifyPassword, generateSessionToken } from '$lib/server/auth';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { username, password } = await request.json();

	if (!username || !password) {
		throw error(400, 'Username and password are required');
	}

	const db = await clientPromise();
	const Users = db.collection('users');

	const user = await Users.findOne({ username });

	// Verify credentials. Guard against users with no stored bcrypt hash so we
	// return a clean 401 instead of throwing.
	const storedHash = user?.services?.password?.bcrypt;
	if (!user || !storedHash || !(await verifyPassword(password, storedHash))) {
		throw error(401, 'Invalid credentials');
	}

	// Issue a new session token: raw value goes to the client, only its hash is
	// stored. $slice keeps the token list bounded (last 5 active sessions).
	const { token, hashedToken } = generateSessionToken();

	await Users.updateOne(
		{ _id: user._id },
		{
			$push: {
				'services.resume.loginTokens': {
					$each: [{ hashedToken, when: new Date() }],
					$slice: -5
				}
			}
		}
	);

	cookies.set('meteor_login_token', token, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7 // 1 week
	});

	return json({
		user: {
			_id: user._id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			fullName: user.fullName
		}
	});
};
