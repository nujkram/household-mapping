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
	longitude: coordinate
});

export const barangayUpdateSchema = barangayInsertSchema.extend({
	_id: z.string().min(1)
});

// --- Household --------------------------------------------------------------

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
	// dependents may also carry latitude/longitude copied from a linked household
	.loose();

const householdBaseSchema = z.object({
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
});

export const householdInsertSchema = householdBaseSchema;

export const householdUpdateSchema = householdBaseSchema.extend({
	_id: z.string().min(1),
	tag: z.enum(['APIN', 'KONTRA', 'UNTAGGED']).optional(),
	// CSV-imported households have no coordinates yet; updating them (e.g. to
	// fix a name or set a tag) must not require a location.
	latitude: z.string().trim().optional().default(''),
	longitude: z.string().trim().optional().default('')
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

// --- User -------------------------------------------------------------------
// `role` is restricted to the known whitelist. Only admins can reach the user
// endpoints (enforced by the central hook guard), and the enum prevents any
// arbitrary role string from being stored.

const roleField = z.enum(['ADMINISTRATOR', 'ENCODER', 'GRANT_OFFICER']);

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
	role: roleField
});

export const userUpdateSchema = z.object({
	_id: z.string().min(1),
	firstName: nameField,
	lastName: nameField,
	phone,
	role: roleField
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
