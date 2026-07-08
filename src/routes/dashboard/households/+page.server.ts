import type { PageServerLoad } from './$types';
import clientPromise from '$lib/server/mongo';

const DEFAULT_LIMIT = 20;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const load: PageServerLoad = async ({ url }) => {
	// Filter/sort/pagination state lives in the URL so it survives reloads,
	// back/forward, and can be shared as a link.
	const q = url.searchParams.get('q')?.trim() ?? '';
	const barangay = url.searchParams.get('barangay') ?? '';
	const tag = url.searchParams.get('tag') ?? '';
	const sort = url.searchParams.get('sort') === 'fullName' ? 'fullName' : 'updatedAt';
	const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
	const page = Math.max(0, Number(url.searchParams.get('page')) || 0);
	const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT));

	try {
		const db = await clientPromise();
		const householdsCollection = db.collection('households');
		const barangaysCollection = db.collection('barangays');

		// Build the query from the active filters — the DB does the filtering,
		// sorting and pagination instead of shipping the whole collection.
		const clauses: Record<string, unknown>[] = [{ isActive: true }];
		if (q) {
			const pattern = escapeRegex(q);
			clauses.push({
				$or: [
					{ fullName: { $regex: pattern, $options: 'i' } },
					{ phone: { $regex: pattern, $options: 'i' } }
				]
			});
		}
		if (barangay) clauses.push({ barangayId: barangay });
		if (tag === 'UNTAGGED') {
			// Treat missing/empty tags as UNTAGGED (legacy + CSV-imported rows).
			clauses.push({ $or: [{ tag: 'UNTAGGED' }, { tag: { $in: [null, ''] } }] });
		} else if (tag) {
			clauses.push({ tag });
		}
		const query = clauses.length > 1 ? { $and: clauses } : clauses[0];

		const [barangays, households, total] = await Promise.all([
			barangaysCollection
				.find(
					{ isActive: true },
					// latitude/longitude are needed by the Create/Update drawer maps.
					{ projection: { _id: 1, name: 1, latitude: 1, longitude: 1 } }
				)
				.sort({ name: 1 })
				.toArray(),
			// No projection: the Update drawer edits the full document, so partial
			// rows here would wipe fields on save.
			householdsCollection
				.find(query)
				.sort({ [sort]: dir })
				.skip(page * limit)
				.limit(limit)
				.toArray(),
			householdsCollection.countDocuments(query)
		]);

		const barangayMap = new Map(
			barangays.map((b: any) => [b._id, b.name] as [string, string])
		);

		return {
			households: households.map((h: any) => ({
				...h,
				barangayName: barangayMap.get(h.barangayId) || 'Unknown Barangay'
			})),
			barangays,
			total,
			page,
			limit,
			q,
			barangay,
			tag,
			sort,
			dir: dir === 1 ? 'asc' : 'desc'
		};
	} catch (error) {
		console.error('Error loading households:', error);
		return {
			households: [],
			barangays: [],
			total: 0,
			page: 0,
			limit,
			q,
			barangay,
			tag,
			sort,
			dir: 'desc'
		};
	}
};
