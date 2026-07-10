import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';

// Insert in bounded batches so memory stays flat and we never hand the driver a
// single multi-megabyte operation.
const BATCH_SIZE = 1000;

const compoundLastNames = ['DE LOS', 'DE LAS', 'DE LA', 'DELA', 'DEL', 'DE'];

/**
 * Parse a "LASTNAME, FIRSTNAME MIDDLENAME" cell into parts, handling compound
 * last names that appear in the first/middle section (e.g. "SANTOS DE LA CRUZ").
 */
const parseName = (raw: string): { firstName: string; middleName: string; lastName: string } => {
	const fullName = (raw || '').replace(/"/g, '').trim();
	const [lastNamePart = '', firstMiddlePart = ''] = fullName.split(',').map((p) => p.trim());

	const nameParts = firstMiddlePart.split(' ').filter(Boolean);
	let lastName = lastNamePart;
	let firstName = '';
	let middleName = '';

	if (nameParts.length >= 2) {
		// Look for a compound last-name marker; if found, move it and everything
		// after it into the last name. (Previously this used Array.slice(string),
		// which coerced to slice(0) and never worked.)
		for (let i = 0; i < nameParts.length; i++) {
			const rest = nameParts.slice(i).join(' ');
			if (compoundLastNames.some((c) => rest === c || rest.startsWith(`${c} `))) {
				const suffix = nameParts.splice(i).join(' ');
				lastName = `${lastName} ${suffix}`.trim();
				break;
			}
		}
	}

	if (nameParts.length >= 2) {
		firstName = nameParts.slice(0, -1).join(' ');
		middleName = nameParts[nameParts.length - 1];
	} else if (nameParts.length === 1) {
		firstName = nameParts[0];
	}

	return { firstName, middleName, lastName };
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ status: 'Error', error: 'Unauthorized' }, { status: 401 });

	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const barangayId = formData.get('barangayId');
		const barangayName = (formData.get('barangayName') as string) || '';

		if (!(file instanceof File) || typeof barangayId !== 'string' || !barangayId) {
			return json({ status: 'Error', error: 'Missing required fields' }, { status: 400 });
		}

		const db = await clientPromise();
		const Household = db.collection('households');
		const userId = locals.user._id;

		// Reject orphan imports: the barangay must exist.
		const barangay = await db
			.collection('barangays')
			.findOne({ _id: barangayId }, { projection: { _id: 1 } });
		if (!barangay) {
			return json({ status: 'Error', error: 'Selected barangay does not exist' }, { status: 400 });
		}

		// Idempotent re-import: skip rows already present for this barangay
		// (keyed on name + precinct + VIN). Also dedups within the file itself.
		const existing = await Household.find(
			{ barangayId },
			{ projection: { fullName: 1, precinct: 1, vin: 1 } }
		).toArray();
		const dedupeKey = (fullName: string, precinct: string, vin: string) =>
			`${fullName}|${precinct}|${vin}`;
		const seen = new Set(
			existing.map((h: any) => dedupeKey(h.fullName || '', h.precinct || '', h.vin || ''))
		);

		const fileStream = Readable.from(Buffer.from(await file.arrayBuffer()));
		const parser = fileStream.pipe(csv({ headers: false, skipLines: 0 }));

		let batch: Record<string, unknown>[] = [];
		let inserted = 0;
		let skipped = 0;
		let duplicates = 0;
		let failed = 0;

		const flush = async () => {
			if (batch.length === 0) return;
			const current = batch;
			batch = [];
			try {
				const res = await Household.insertMany(current, { ordered: false });
				inserted += res.insertedCount;
			} catch (err) {
				// With ordered:false the driver still inserts the good docs; count them.
				const insertedCount =
					(err as { result?: { insertedCount?: number } })?.result?.insertedCount ?? 0;
				inserted += insertedCount;
				failed += current.length - insertedCount;
				console.error('Batch insert error:', (err as Error)?.message);
			}
		};

		const now = new Date();
		for await (const data of parser as AsyncIterable<Record<string, string>>) {
			const { firstName, middleName, lastName } = parseName(data[2] || '');

			// Skip rows with no name at all.
			if (!firstName && !lastName) {
				skipped++;
				continue;
			}

			const precinct = data[0] || '';
			const vin = data[6] || '';
			const fullName = `${firstName} ${middleName} ${lastName}`
				.replace(/\s+/g, ' ')
				.toUpperCase()
				.trim();

			// Skip already-imported / in-file duplicates.
			const key = dedupeKey(fullName, precinct, vin);
			if (seen.has(key)) {
				duplicates++;
				continue;
			}
			seen.add(key);

			batch.push({
				_id: id(),
				barangayId,
				precinct,
				lastName: lastName.toUpperCase(),
				firstName: firstName.toUpperCase(),
				middleName: middleName.toUpperCase(),
				fullName,
				address: data[3] || '',
				disability: data[4] || '',
				dateOfBirth: null,
				vin,
				isVoter: true,
				// Defaults so imported rows aren't partial docs (match form-created shape).
				tag: 'UNTAGGED',
				dependents: 0,
				dependentDetails: [],
				grants: [],
				parentHouseholdId: '',
				createdAt: now,
				updatedAt: now,
				createdBy: userId,
				updatedBy: userId,
				isActive: true
			});

			if (batch.length >= BATCH_SIZE) await flush();
		}
		await flush();

		if (inserted === 0) {
			const reason =
				duplicates > 0
					? 'All rows were already imported for this barangay.'
					: 'No valid records to insert.';
			return json({ status: 'Error', error: reason, duplicates, skipped }, { status: 400 });
		}

		const notes = [
			skipped ? `${skipped} skipped` : '',
			duplicates ? `${duplicates} already imported` : '',
			failed ? `${failed} failed` : ''
		].filter(Boolean);
		let message = `Successfully uploaded ${inserted} households in ${barangayName}`;
		if (notes.length) message += ` (${notes.join(', ')})`;

		return json({ status: 'Success', message, inserted, skipped, duplicates, failed });
	} catch (error) {
		console.error('Upload error:', error);
		return json({ status: 'Error', error: 'Failed to process upload' }, { status: 500 });
	}
};
