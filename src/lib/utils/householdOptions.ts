/**
 * Option lists for the optional household survey fields (PH household
 * profiling style). Codes are stored in the DB; labels are for display.
 * Shared by the forms, the detail page, and the server validation schema.
 */

export type Option = { value: string; label: string };

export const SOCIOECONOMIC_OPTIONS: Option[] = [
	{ value: '4PS', label: '4Ps' },
	{ value: 'NON_4PS', label: 'Non-4Ps' }
];

export const RELATIONSHIP_OPTIONS: Option[] = [
	{ value: '1', label: 'Head' },
	{ value: '2', label: 'Spouse' },
	{ value: '3', label: 'Child' },
	{ value: '4', label: 'Others (specify)' }
];

export const CIVIL_STATUS_OPTIONS: Option[] = [
	{ value: 'SINGLE', label: 'Single' },
	{ value: 'MARRIED', label: 'Married' },
	{ value: 'WIDOWED', label: 'Widowed' },
	{ value: 'SEPARATED', label: 'Separated' },
	{ value: 'LIVE_IN', label: 'Live-in' }
];

export const EDUCATIONAL_OPTIONS: Option[] = [
	{ value: 'N', label: 'None' },
	{ value: 'K', label: 'Kinder' },
	{ value: 'ES', label: 'Elementary Student' },
	{ value: 'EU', label: 'Elementary Undergraduate' },
	{ value: 'EG', label: 'Elementary Graduate' },
	{ value: 'HS', label: 'High School Student' },
	{ value: 'HU', label: 'High School Undergraduate' },
	{ value: 'HG', label: 'High School Graduate' },
	{ value: 'V', label: 'Vocational' },
	{ value: 'CS', label: 'College Student' },
	{ value: 'CU', label: 'College Undergraduate' },
	{ value: 'CG', label: 'College Graduate' }
];

export const YES_NO_OPTIONS: Option[] = [
	{ value: 'YES', label: 'Yes' },
	{ value: 'NO', label: 'No' }
];

export const MEMBERSHIP_TYPE_OPTIONS: Option[] = [
	{ value: 'ME', label: 'Member' },
	{ value: 'D', label: 'Dependent' }
];

export const CATEGORY_OPTIONS: Option[] = [
	{ value: 'SC', label: 'Senior Citizen' },
	{ value: 'PWD', label: 'Person with Disability' },
	{ value: 'Y', label: 'Youth' },
	{ value: 'SP', label: 'Single Parent' },
	{ value: 'PW', label: 'Pregnant Woman' }
];

export const HOUSING_TYPE_OPTIONS: Option[] = [
	{ value: 'O', label: 'Owned' },
	{ value: 'R', label: 'Rented' }
];

export const HOUSING_MATERIALS_OPTIONS: Option[] = [
	{ value: 'CONCRETE', label: 'Concrete' },
	{ value: 'SEMI_CONCRETE', label: 'Semi-Concrete' },
	{ value: 'WOOD', label: 'Wood' },
	{ value: 'LIGHT_MATERIALS', label: 'Light Materials' }
];

export const LAND_OWNERSHIP_OPTIONS: Option[] = [
	{ value: 'O', label: 'Owned' },
	{ value: 'N', label: 'None' },
	{ value: 'T', label: 'Tenanted / Rent Free' }
];

/** Display label for a stored code; falls back to the raw value. */
export const labelFor = (options: Option[], value: string | null | undefined): string => {
	if (!value) return '';
	return options.find((o) => o.value === value)?.label ?? value;
};

/** Fresh survey object with every optional field at its empty default. */
export const emptySurvey = () => ({
	dateOfVisit: '',
	sitio: '',
	ethnicity: '',
	socioeconomicStatus: '',
	relationshipToHead: '',
	relationshipOther: '',
	civilStatus: '',
	educationalAttainment: '',
	philhealth: '',
	philhealthMembershipType: '',
	categories: [] as string[],
	occupationEmployment: false,
	occupationFarming: false,
	occupationFishing: false,
	occupationVending: false,
	occupationToda: false,
	occupationOther: '',
	averageIncome: null as number | null,
	housingType: '',
	housingMaterials: '',
	landOwnership: '',
	religion: '',
	lengthOfStay: '',
	interviewedBy: ''
});

export type HouseholdSurvey = ReturnType<typeof emptySurvey>;

/** Survey values from an existing household record, defaulted where missing. */
export const surveyFrom = (household: Record<string, unknown>): HouseholdSurvey => {
	const empty = emptySurvey();
	const out: Record<string, unknown> = { ...empty };
	for (const key of Object.keys(empty)) {
		const v = household?.[key];
		if (v !== undefined && v !== null) out[key] = v;
	}
	// Date inputs need yyyy-MM-dd.
	if (typeof out.dateOfVisit === 'string' && out.dateOfVisit.length > 10) {
		out.dateOfVisit = out.dateOfVisit.slice(0, 10);
	}
	return out as HouseholdSurvey;
};
