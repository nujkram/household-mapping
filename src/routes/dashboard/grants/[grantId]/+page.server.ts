import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';
import { fetchGrantRecipients } from '$lib/server/grantReport';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const db = await clientPromise();

	const grant = await db.collection('grants').findOne({ _id: params.grantId });
	if (!grant) {
		throw error(404, 'Grant not found');
	}

	const q = url.searchParams.get('q')?.trim() ?? '';
	const barangay = url.searchParams.get('barangay') ?? '';
	const cluster = url.searchParams.get('cluster') ?? '';

	const [recipients, barangays] = await Promise.all([
		fetchGrantRecipients(db, params.grantId, { q, barangay, cluster }),
		db
			.collection('barangays')
			.find({ isActive: true }, { projection: { _id: 1, name: 1 } })
			.sort({ name: 1 })
			.toArray()
	]);

	return {
		grant,
		recipients,
		barangays,
		q,
		barangay,
		cluster,
		generatedBy: locals.user?.name || locals.user?.username || ''
	};
};
