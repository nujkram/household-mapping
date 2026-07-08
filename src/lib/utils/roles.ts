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

/** Encoders (and admins) tag households and edit details/location/dependents. */
export const canEditHouseholds = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR || role === ROLES.ENCODER;

/** Grant officers (and admins) manage the grant catalog and award grants. */
export const canManageGrants = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR || role === ROLES.GRANT_OFFICER;

export const isAdmin = (role: string | undefined | null): boolean =>
	role === ROLES.ADMINISTRATOR;
