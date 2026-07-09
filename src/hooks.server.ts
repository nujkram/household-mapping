import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import clientPromise from '$lib/server/mongo';
import { hashSessionToken } from '$lib/server/auth';
import { ROLES, type Role } from '$lib/utils/roles';
import { dev } from '$app/environment';

const jsonError = (status: number, message: string): Response =>
	new Response(JSON.stringify({ status, error: message }), {
		status,
		headers: { 'content-type': 'application/json' }
	});

const ALL_ROLES: Role[] = [ROLES.ADMINISTRATOR, ROLES.ENCODER, ROLES.GRANT_OFFICER];
const ADMIN_ONLY: Role[] = [ROLES.ADMINISTRATOR];
const HOUSEHOLD_EDITORS: Role[] = [ROLES.ADMINISTRATOR, ROLES.ENCODER];
const GRANT_MANAGERS: Role[] = [ROLES.ADMINISTRATOR, ROLES.GRANT_OFFICER];

// Route permissions, most specific prefix first — the first match wins.
// Anything under /dashboard or /api/admin not listed here falls back to
// requiring a login with any role.
const ROUTE_ROLES: [prefix: string, roles: Role[]][] = [
	// APIs
	['/api/admin/user', ADMIN_ONLY],
	['/api/admin/upload', ADMIN_ONLY],
	['/api/admin/barangay/insert', ADMIN_ONLY],
	['/api/admin/barangay/update', ADMIN_ONLY],
	['/api/admin/household/grant', GRANT_MANAGERS],
	['/api/admin/household/set-tag', HOUSEHOLD_EDITORS],
	['/api/admin/household/insert', HOUSEHOLD_EDITORS],
	['/api/admin/household/update', HOUSEHOLD_EDITORS],
	['/api/admin/grant', GRANT_MANAGERS],
	['/api/admin/service', GRANT_MANAGERS],
	// Pages
	['/dashboard/users', ADMIN_ONLY],
	['/dashboard/upload', ADMIN_ONLY],
	['/dashboard/barangays', ADMIN_ONLY],
	['/dashboard/grants', GRANT_MANAGERS],
	['/dashboard/map', HOUSEHOLD_EDITORS]
];

const allowedRoles = (pathname: string): Role[] => {
	for (const [prefix, roles] of ROUTE_ROLES) {
		if (pathname.startsWith(prefix)) return roles;
	}
	return ALL_ROLES;
};

export const handle: Handle = async ({ event, resolve }) => {
	const session = event.cookies.get('meteor_login_token');

	event.locals.user = null;

	if (session) {
		const db = await clientPromise();
		const Users = db.collection('users');
		// Look up by the HASH of the cookie value — the raw token never touches the DB.
		// Never load `services` (password hash + tokens) into locals.
		const user = await Users.findOne(
			{ 'services.resume.loginTokens.hashedToken': hashSessionToken(session) },
			{ projection: { services: 0 } }
		);
		if (user) {
			event.locals.user = {
				// This app uses Meteor-style string _ids; the driver types them as ObjectId.
				_id: user._id as unknown as string,
				name: user?.fullName || user?.emails?.[0]?.address,
				email: user?.emails?.[0]?.address,
				firstName: user?.firstName,
				lastName: user?.lastName,
				role: user?.role,
				username: user?.username,
				cluster: user?.cluster ?? ''
			};
		}
	}

	// Centralized route protection: every /dashboard and /api/admin route
	// requires a login, and the ROUTE_ROLES table decides which roles may
	// access which area (Encoder → households, Grant Officer → grants, etc.).
	const { pathname } = event.url;
	const isProtectedApi = pathname.startsWith('/api/admin');
	const isProtectedPage = pathname.startsWith('/dashboard');

	if (isProtectedApi || isProtectedPage) {
		const user = event.locals.user;
		if (!user) {
			if (isProtectedApi) return jsonError(401, 'Unauthorized');
			throw redirect(302, '/auth/login');
		}
		if (!allowedRoles(pathname).includes(user.role as Role)) {
			if (isProtectedApi) return jsonError(403, 'Forbidden');
			throw redirect(302, '/unauthorized');
		}
	}

	return resolve(event);
};

export const handleError: HandleServerError = ({ error }) => {
	console.error('⚡️ Unhandled Error', error);

	// Only leak error details in development. Production gets a generic message
	// so internal stack/DB details never reach clients.
	if (dev) {
		return {
			message: error instanceof Error ? error.message : 'Unknown error',
			code: (error as { code?: string })?.code ?? 'UNKNOWN'
		};
	}

	return { message: 'Internal Server Error', code: 'INTERNAL_ERROR' };
};
