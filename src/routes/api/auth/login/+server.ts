import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { verifyPassword, generateSessionToken } from '$lib/server/auth';
import { rateLimit, peekLimited, clearRateLimit } from '$lib/server/rateLimit';
import { dev } from '$app/environment';

// Per-IP: throttles brute force AND the unauthenticated bcrypt CPU cost.
const IP_MAX = 30;
const IP_WINDOW = 10 * 60 * 1000; // 10 min
// Per-username: locks a targeted account after repeated failures.
const USER_MAX = 5;
const USER_WINDOW = 15 * 60 * 1000; // 15 min

const tooMany = (retryAfter: number) =>
	json(
		{ status: 'Error', error: 'Too many attempts. Please wait a bit and try again.' },
		{ status: 429, headers: { 'Retry-After': String(retryAfter) } }
	);

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();

	// 1. Per-IP throttle (records every attempt).
	const ipLimit = rateLimit(`login-ip:${ip}`, IP_MAX, IP_WINDOW);
	if (ipLimit.limited) return tooMany(ipLimit.retryAfter);

	const { username, password } = await request.json();
	if (!username || !password) {
		throw error(400, 'Username and password are required');
	}

	// 2. Per-username lockout — checked BEFORE bcrypt so a targeted account can't
	//    be used for guessing or to pin CPU.
	const userKey = `login-fail:${username}`;
	if (peekLimited(userKey, USER_MAX, USER_WINDOW)) {
		return tooMany(Math.ceil(USER_WINDOW / 1000));
	}

	const db = await clientPromise();
	const Users = db.collection('users');
	const user = await Users.findOne({ username });

	const storedHash = user?.services?.password?.bcrypt;
	if (!user || !storedHash || !(await verifyPassword(password, storedHash))) {
		rateLimit(userKey, USER_MAX, USER_WINDOW); // record the failed attempt
		throw error(401, 'Invalid credentials');
	}

	// 3. Deactivated accounts cannot sign in (checked AFTER the password so it
	//    doesn't aid username enumeration). Existing sessions are also cut off by
	//    the hooks session lookup.
	if (user.isActive === false) {
		throw error(403, 'This account is disabled. Please contact an administrator.');
	}

	// Success — clear the failure counters for this user.
	clearRateLimit(userKey);

	// Issue a new session token: raw value to the client, only its hash stored.
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
