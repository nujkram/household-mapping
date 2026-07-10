import { json } from '@sveltejs/kit';
import { z } from 'zod';

// --- Reusable field helpers -------------------------------------------------

/** Required name: trimmed and upper-cased (matches the app's storage convention). */
const nameField = z.string().trim().min(1, 'is required').toUpperCase();
/** Optional name: defaults to '' when omitted, upper-cased otherwise. */
const optionalNameField = z.string().trim().toUpperCase().optional().default('');
const coordinate = z.string().trim().min(1, 'is required');
const phone = z.string().trim().optional().default('');

// --- Barangay ---------------------------------------------------------------

export const barangayInsertSchema = z.object({
	name: nameField,
	firstName: nameField,
	middleName: optionalNameField,
	lastName: nameField,
	phone,
	latitude: coordinate,
	longitude: coordinate,
	// '' = derive from the fixed name-based config.
	cluster: z.enum(['CLUSTER_1', 'CLUSTER_2', 'CLUSTER_3']).or(z.literal('')).optional().default('')
});

export const barangayUpdateSchema = barangayInsertSchema.extend({
	_id: z.string().min(1)
});

// --- Household --------------------------------------------------------------

/** Reusable optional select: a known code or '' (not answered). */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
	z
		.enum(values as unknown as [string, ...string[]])
		.or(z.literal(''))
		.optional()
		.default('');

const optionalText = z.string().trim().optional().default('');
const optionalUpperText = z.string().trim().toUpperCase().optional().default('');

// Optional census-style survey fields on a household. Every field defaults to
// "not answered" so partial submissions are always valid.
export const householdSurveySchema = z.object({
	dateOfVisit: optionalText,
	sitio: optionalUpperText,
	ethnicity: optionalUpperText,
	socioeconomicStatus: optionalEnum(['4PS', 'NON_4PS'] as const),
	relationshipToHead: optionalEnum(['1', '2', '3', '4'] as const),
	relationshipOther: optionalUpperText,
	civilStatus: optionalEnum(['SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'LIVE_IN'] as const),
	educationalAttainment: optionalEnum([
		'N',
		'K',
		'ES',
		'EU',
		'EG',
		'HS',
		'HU',
		'HG',
		'V',
		'CS',
		'CU',
		'CG'
	] as const),
	philhealth: optionalEnum(['YES', 'NO'] as const),
	philhealthMembershipType: optionalEnum(['ME', 'D'] as const),
	categories: z.array(z.enum(['SC', 'PWD', 'Y', 'SP', 'PW'])).optional().default([]),
	occupationEmployment: z.boolean().optional().default(false),
	occupationFarming: z.boolean().optional().default(false),
	occupationFishing: z.boolean().optional().default(false),
	occupationVending: z.boolean().optional().default(false),
	occupationToda: z.boolean().optional().default(false),
	occupationOther: optionalUpperText,
	// Comma-tolerant; junk/NaN becomes null instead of poisoning aggregations.
	averageIncome: z.preprocess((v) => {
		if (v === '' || v === null || v === undefined) return null;
		const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
		return Number.isFinite(n) ? n : null;
	}, z.number().nonnegative('must be 0 or more').nullable()),
	housingType: optionalEnum(['O', 'R'] as const),
	housingMaterials: optionalEnum(['CONCRETE', 'SEMI_CONCRETE', 'WOOD', 'LIGHT_MATERIALS'] as const),
	landOwnership: optionalEnum(['O', 'N', 'T'] as const),
	religion: optionalUpperText,
	lengthOfStay: optionalText,
	interviewedBy: optionalUpperText
});

export const SURVEY_KEYS = Object.keys(householdSurveySchema.shape);

/** Pull just the survey fields out of a parsed household payload. */
export const pickSurveyFields = (data: Record<string, unknown>): Record<string, unknown> =>
	Object.fromEntries(SURVEY_KEYS.map((k) => [k, data[k]]));

// Dependents carry the same optional survey fields as the head of household.
const dependentSchema = z
	.object({
		_id: z.string(),
		householdId: z.string().optional().default(''),
		linkedHouseholdId: z.string().optional(),
		firstName: optionalNameField,
		middleName: optionalNameField,
		lastName: optionalNameField,
		fullName: z.string().optional().default(''),
		dateOfBirth: z.string().nullable().optional(),
		gender: z.string().optional().default('MALE'),
		isVoter: z.boolean().optional().default(false)
	})
	.extend(householdSurveySchema.shape)
	// dependents may also carry latitude/longitude copied from a linked household
	.loose();

const householdBaseSchema = z
	.object({
		barangayId: z.string().min(1),
		firstName: nameField,
		middleName: optionalNameField,
		lastName: nameField,
		gender: z.string().trim().optional().default('MALE'),
		dateOfBirth: z.string().nullable().optional(),
		phone,
		isVoter: z.coerce.boolean().optional().default(false),
		dependents: z.coerce.number().int().min(0).optional().default(0),
		dependentDetails: z.array(dependentSchema).optional().default([]),
		latitude: coordinate,
		longitude: coordinate
	})
	.extend(householdSurveySchema.shape);

export const householdInsertSchema = householdBaseSchema;

export const householdUpdateSchema = householdBaseSchema.extend({
	_id: z.string().min(1),
	tag: z.enum(['APIN', 'KONTRA', 'UNTAGGED']).optional(),
	// CSV-imported households have no coordinates yet; updating them (e.g. to
	// fix a name or set a tag) must not require a location.
	latitude: z.string().trim().optional().default(''),
	longitude: z.string().trim().optional().default(''),
	// Optimistic concurrency: the updatedAt the client loaded. If it no longer
	// matches, the record was changed by someone else since — reject with 409.
	expectedUpdatedAt: z.string().optional()
});

// --- Grant ------------------------------------------------------------------

export const grantInsertSchema = z.object({
	name: nameField,
	year: z.coerce
		.number()
		.int('must be a whole year')
		.min(1900, 'must be 1900 or later')
		.max(2100, 'must be 2100 or earlier'),
	releasedDate: z
		.string()
		.trim()
		.min(1, 'is required')
		.refine((v) => !Number.isNaN(new Date(v).getTime()), 'must be a valid date')
});

export const grantUpdateSchema = grantInsertSchema.extend({
	_id: z.string().min(1),
	isActive: z.boolean().optional()
});

export const householdGrantSchema = z.object({
	householdId: z.string().min(1),
	grantId: z.string().min(1)
});

// --- Service (patient-service registry) -------------------------------------

export const serviceInsertSchema = z.object({
	// Services are recorded from a household; keep the link for its history view.
	householdId: z.string().optional().default(''),
	patientName: nameField,
	categories: z
		.array(z.enum(['REGULAR', 'PWD', 'SENIOR', '4PS', 'ANIMAL_BITE']))
		.optional()
		.default([]),
	// Peso amount in (comma-tolerant); endpoints store it as integer centavos.
	// Blank/junk becomes undefined → rejected as required (never stored as NaN).
	amount: z.preprocess((v) => {
		if (v === '' || v === null || v === undefined) return undefined;
		const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
		return Number.isFinite(n) ? n : undefined;
	}, z.number().nonnegative('must be 0 or more')),
	dateReceived: z
		.string()
		.trim()
		.min(1, 'is required')
		.refine((v) => !Number.isNaN(new Date(v).getTime()), 'must be a valid date')
});

export const serviceUpdateSchema = serviceInsertSchema.extend({
	_id: z.string().min(1)
});

// --- User -------------------------------------------------------------------
// `role` is restricted to the known whitelist. Only admins can reach the user
// endpoints (enforced by the central hook guard), and the enum prevents any
// arbitrary role string from being stored.

const roleField = z.enum(['ADMINISTRATOR', 'ENCODER', 'GRANT_OFFICER']);
// Optional cluster assignment (meaningful for encoders); '' = all clusters.
const clusterField = z.enum(['CLUSTER_1', 'CLUSTER_2', 'CLUSTER_3']).or(z.literal('')).optional().default('');

export const userInsertSchema = z.object({
	username: z.string().trim().min(1),
	firstName: nameField,
	lastName: nameField,
	// SHA-256 hex produced client-side; bcrypted server-side.
	password: z.string().min(1),
	email: z
		.string()
		.trim()
		.toLowerCase()
		.min(3)
		.refine((v) => v.includes('@'), 'must be a valid email'),
	phone,
	role: roleField,
	cluster: clusterField
});

export const userUpdateSchema = z.object({
	_id: z.string().min(1),
	firstName: nameField,
	lastName: nameField,
	phone,
	role: roleField,
	cluster: clusterField,
	// Whether the account can log in. Defaults to active if omitted.
	isActive: z.coerce.boolean().optional().default(true)
});

export const resetPasswordSchema = z.object({
	_id: z.string().min(1),
	password: z.string().min(1)
});

// --- Helper -----------------------------------------------------------------

/** Turn a ZodError into a 400 JSON response with a readable message. */
export const badRequest = (error: z.ZodError): Response => {
	const message =
		error.issues
			.map((i) => `${i.path.join('.') || 'body'} ${i.message}`)
			.join('; ') || 'Invalid input';
	return json({ status: 'Error', error: message }, { status: 400 });
};
