export type Barangay = {
	_id: string;
	name: string;
	lastName: string;
	middleName: string;
	firstName: string;
	fullName: string;
	phone: string;
	latitude: string;
	longitude: string;
	households?: Household[];
};

export type Household = {
	_id: string;
	barangayId: string;
	lastName: string;
	middleName: string;
	firstName: string;
	fullName: string;
	gender: string;
	dateOfBirth: string;
	age?: number;
	phone: string;
	dependents: number;
	dependentDetails: Dependents[];
	isVoter: boolean;
	latitude: string;
	longitude: string;
	tag?: 'APIN' | 'KONTRA' | 'UNTAGGED';
	grants?: HouseholdGrant[];
	updatedAt: string;
	barangayName?: string;
};

export type User = {
	_id: string;
	fullName: string;
	email: string;
	role: string;
};

/** The trimmed user shape attached to `locals.user` by hooks.server.ts. */
export type SessionUser = {
	_id: string;
	name: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	username: string;
};

export type Grant = {
	_id: string;
	name: string;
	year: number;
	releasedDate: string;
	isActive: boolean;
	recipients?: number;
	createdAt?: string;
	updatedAt?: string;
};

/** A grant awarded to a household: a reference plus a display snapshot. */
export type HouseholdGrant = {
	grantId: string;
	name: string;
	year: number;
	receivedAt: string;
	grantedBy?: string;
};

export type Dependents = {
	_id: string;
	householdId: string;
	linkedHouseholdId?: string;
	firstName: string;
	middleName: string;
	lastName: string;
	fullName: string;
	dateOfBirth: string;
	age?: number;
	gender: string;
	isVoter: boolean;
};
