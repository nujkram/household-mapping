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
	/** Explicit cluster override; '' = derive from the fixed name-based config. */
	cluster?: string;
	/** PSGC (Philippine Standard Geographic Code) — 10-digit codes per level. */
	regionCode?: string;
	provinceCode?: string;
	cityMunicipalityCode?: string;
	barangayCode?: string;
	households?: Household[];
};

export type Household = {
	_id: string;
	barangayId: string;
	/** Human-readable household code, format `<barangayCode>-<number>` (optional). */
	householdCode?: string;
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
	/**
	 * Server-maintained: set when this family's head appears as a linked
	 * dependent in another household record — i.e. this family lives in that
	 * household's dwelling. '' = this record is its own dwelling.
	 */
	parentHouseholdId?: string;
	/** Computed by the households list loader: families living in this dwelling. */
	subFamilyCount?: number;
	/** Computed by the households list loader: patient-service count + total. */
	serviceCount?: number;
	serviceTotal?: number;
	// Optional census-style survey fields (see $lib/utils/householdOptions.ts)
	dateOfVisit?: string;
	sitio?: string;
	ethnicity?: string;
	socioeconomicStatus?: string;
	relationshipToHead?: string;
	relationshipOther?: string;
	civilStatus?: string;
	educationalAttainment?: string;
	philhealth?: string;
	philhealthMembershipType?: string;
	categories?: string[];
	occupationEmployment?: boolean;
	occupationFarming?: boolean;
	occupationFishing?: boolean;
	occupationVending?: boolean;
	occupationToda?: boolean;
	occupationOther?: string;
	averageIncome?: number | null;
	housingType?: string;
	housingMaterials?: string;
	landOwnership?: string;
	religion?: string;
	lengthOfStay?: string;
	interviewedBy?: string;
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
	/** For encoders: the cluster id they're scoped to (empty = all). */
	cluster?: string;
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

/** A patient-service registry entry (managed by grant officers/admins). */
export type Service = {
	_id: string;
	householdId?: string;
	patientName: string;
	categories: string[];
	/** Canonical amount in integer centavos. */
	amountCentavos?: number;
	/** Legacy float peso amount (pre-centavos records). */
	amount?: number;
	dateReceived: string;
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
} & Partial<import('$lib/utils/householdOptions').HouseholdSurvey>;
