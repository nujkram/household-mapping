export const ROLES = {
	ADMINISTRATOR: 'ADMINISTRATOR',
	ENCODER: 'ENCODER',
	GRANT_OFFICER: 'GRANT_OFFICER'
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
	ADMINISTRATOR: 'Administrator',
	ENCODER: 'Encoder',
	GRANT_OFFICER: 'Grant Officer'
};

/** Encoders (and admins) edit household details/location/dependents. */
export const canEditHouseholds = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR || role === ROLES.ENCODER;

/**
 * Who may view and set the political tag (APIN/KONTRA/UNTAGGED).
 *
 * Administrators always may. Encoders may only while the app-wide
 * `encoderTagging` setting is on. Grant Officers never may.
 *
 * `encoderTagging` defaults to false and is compared with `=== true`, so a
 * caller that forgets the second argument — or passes an untyped value out of
 * `$page.data` — fails CLOSED (encoders lose tagging) rather than open.
 */
export const canTagHouseholds = (
	role: string | undefined | null,
	encoderTagging: boolean | undefined | null = false
): boolean => {
	if (role === ROLES.ADMINISTRATOR) return true;
	return role === ROLES.ENCODER && encoderTagging === true;
};

/** Grant officers (and admins) manage the grant catalog and award grants. */
export const canManageGrants = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR || role === ROLES.GRANT_OFFICER;

export const isAdmin = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR;
