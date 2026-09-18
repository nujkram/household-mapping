import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import clientPromise from '$lib/server/mongo';
import { settingsUpdateSchema, badRequest } from '$lib/server/validation';
import { getSettings, invalidateSettings, SETTINGS_ID } from '$lib/server/settings';
import { isAdmin } from '$lib/utils/roles';

export const GET: RequestHandler = async ({ locals }) => {
	// Defence in depth: the hook table already restricts this route to admins.
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });
	if (!isAdmin(locals.user.role))
		return json({ status: 'Error', error: 'Forbidden' }, { status: 403 });

	return json({ status: 'Success', settings: await getSettings({ fresh: true }) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });
	if (!isAdmin(locals.user.role))
		return json({ status: 'Error', error: 'Forbidden' }, { status: 403 });

	const parsed = settingsUpdateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return badRequest(parsed.error);

	try {
		const now = new Date();
		const db = await clientPromise();
		// Upsert on the fixed _id: creates the singleton on first save, updates it
		// forever after. No id() — the unique _id index makes a second settings
		// document structurally impossible.
		await db.collection<{ _id: string; [key: string]: unknown }>('settings').updateOne(
			{ _id: SETTINGS_ID },
			{
				$set: {
					encoderTagging: parsed.data.encoderTagging,
					updatedAt: now,
					updatedBy: locals.user._id
				},
				$setOnInsert: { createdAt: now, createdBy: locals.user._id }
			},
			{ upsert: true }
		);

		// Correct immediately on THIS instance; other serverless instances
		// converge within the settings TTL.
		invalidateSettings();

		return json({
			status: 'Success',
			message: `Encoder tagging ${parsed.data.encoderTagging ? 'enabled' : 'disabled'}`
		});
	} catch (error) {
		console.error('Error saving app settings:', error);
		return json({ status: 'Error', error: 'Failed to save settings' }, { status: 500 });
	}
};
