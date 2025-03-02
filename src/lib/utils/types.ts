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
	updatedAt: string;
	barangayName?: string;
};

export type User = {
	_id: string;
	fullName: string;
	email: string;
	role: string;
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
