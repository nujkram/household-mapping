import type { Option } from '$lib/utils/householdOptions';

/** Service beneficiary categories (check all that apply). */
export const SERVICE_CATEGORY_OPTIONS: Option[] = [
	{ value: 'REGULAR', label: 'Regular' },
	{ value: 'PWD', label: 'PWD' },
	{ value: 'SENIOR', label: 'Senior Citizen' },
	{ value: '4PS', label: '4Ps' },
	{ value: 'ANIMAL_BITE', label: 'Animal Bite' }
];

export const SERVICE_CATEGORY_VALUES = SERVICE_CATEGORY_OPTIONS.map((o) => o.value);

/** Labels for stored category codes. */
export const serviceCategoryLabels = (codes: string[] | undefined): string =>
	(codes || [])
		.map((c) => SERVICE_CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c)
		.join(', ');
