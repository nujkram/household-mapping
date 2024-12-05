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
	age: number;
	phone: string;
	dependents: number;
	latitude: string;
	longitude: string;
};

export type User = {
	_id: string;
	fullName: string;
	email: string;
	role: string;
};
