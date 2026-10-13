export const ROLES = {
	ADMINISTRATOR: 'ADMINISTRATOR',
	ENCODER: 'ENCODER',
	GRANT_OFFICER: 'GRANT_OFFICER',
	TAGGER: 'TAGGER'
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
	ADMINISTRATOR: 'Administrator',
	ENCODER: 'Encoder',
	GRANT_OFFICER: 'Grant Officer',
	TAGGER: 'Tagger'
};

/** Encoders (and admins) edit household details/location/dependents. */
export const canEditHouseholds = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR || role === ROLES.ENCODER;

/**
 * Who may view and set the political tag (APIN/KONTRA/UNTAGGED).
 *
 * Administrators always may. Encoders may only while the app-wide
 * `encoderTagging` setting is on, and Taggers only while `taggerTagging` is
 * on. Grant Officers never may.
 *
 * Both flags default to false and are compared with `=== true`, so a caller
 * that forgets an argument — or passes an untyped value out of `$page.data` —
 * fails CLOSED (that role loses tagging) rather than open.
 */
export const canTagHouseholds = (
	role: string | undefined | null,
	encoderTagging: boolean | undefined | null = false,
	taggerTagging: boolean | undefined | null = false
): boolean => {
	if (role === ROLES.ADMINISTRATOR) return true;
	if (role === ROLES.ENCODER) return encoderTagging === true;
	if (role === ROLES.TAGGER) return taggerTagging === true;
	return false;
};

/** Grant officers (and admins) manage the grant catalog and award grants. */
export const canManageGrants = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR || role === ROLES.GRANT_OFFICER;

export const isAdmin = (role: string | undefined | null): boolean => role === ROLES.ADMINISTRATOR;

/** Taggers fill in the paper Household Mapping sheet (members + services availed) for existing households. */
export const canFillHouseholdMapping = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR || role === ROLES.TAGGER;

/** Roles whose users can be geographically scoped (by cluster or by assigned barangays): encoders and taggers. */
export const isScopedRole = (role: string | undefined | null): boolean =>
	role === ROLES.ENCODER || role === ROLES.TAGGER;
