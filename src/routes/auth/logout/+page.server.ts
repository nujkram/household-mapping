import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';
import { hashSessionToken } from '$lib/server/auth';
import { dev } from '$app/environment';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const session = cookies.get('meteor_login_token');

	// Revoke the token server-side so a captured cookie is useless after logout.
	if (session && locals.user) {
		const db = await clientPromise();
		await db.collection('users').updateOne(
			{ _id: locals.user._id },
			{ $pull: { 'services.resume.loginTokens': { hashedToken: hashSessionToken(session) } } }
		);
	}

	// Clear the cookie with attributes matching how it was set, so browsers
	// reliably remove it.
	cookies.set('meteor_login_token', '', {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 0,
		expires: new Date(0)
	});

	locals.user = null;

	// Redirect server-side to the login page — no client-only hack, works
	// for every role and without JavaScript.
	throw redirect(303, '/auth/login');
};
