/**
 * One-off, idempotent backfill migration. Safe to run multiple times.
 *
 *   node scripts/backfill.mjs            # apply
 *   node scripts/backfill.mjs --dry-run  # report only, no writes
 *
 * 1. households.lat / households.lng  — numeric mirror of the string
 *    latitude/longitude, so the viewport map's bounds query is indexable.
 * 2. services.amountCentavos          — integer centavos derived from any
 *    legacy float `amount` (pesos), so money totals are exact.
 *
 * Reads DATABASE_URL from the environment (.env), mirroring src/lib/server/mongo.ts.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.DATABASE_URL;
if (!uri) {
	console.error('DATABASE_URL is not set.');
	process.exit(1);
}
const dbName = uri.includes('Staging')
	? 'householdStaging'
	: uri.includes('Test')
		? 'householdTest'
		: 'householdProduction';

const DRY = process.argv.includes('--dry-run');

const parseCoord = (v) => {
	if (typeof v === 'number') return Number.isFinite(v) ? v : null;
	if (typeof v !== 'string' || v.trim() === '') return null;
	const n = Number(v.trim());
	return Number.isFinite(n) ? n : null;
};

const client = new MongoClient(uri);

try {
	await client.connect();
	const db = client.db(dbName);
	console.log(`Connected to "${dbName}"${DRY ? ' (dry run)' : ''}\n`);

	// 1. households numeric coordinates ---------------------------------------
	const households = db.collection('households');
	const cursor = households.find(
		{ $or: [{ lat: { $exists: false } }, { lat: null }] },
		{ projection: { latitude: 1, longitude: 1 } }
	);

	let hhUpdated = 0;
	let hhSkipped = 0;
	let ops = [];
	for await (const h of cursor) {
		const lat = parseCoord(h.latitude);
		const lng = parseCoord(h.longitude);
		if (lat === null || lng === null) {
			hhSkipped++;
			continue;
		}
		ops.push({ updateOne: { filter: { _id: h._id }, update: { $set: { lat, lng } } } });
		if (ops.length >= 1000) {
			if (!DRY) await households.bulkWrite(ops, { ordered: false });
			hhUpdated += ops.length;
			ops = [];
		}
	}
	if (ops.length) {
		if (!DRY) await households.bulkWrite(ops, { ordered: false });
		hhUpdated += ops.length;
	}
	console.log(`households: ${hhUpdated} given numeric coords, ${hhSkipped} skipped (no valid coords)`);

	// 2. services amountCentavos ---------------------------------------------
	const services = db.collection('services');
	const legacy = { amountCentavos: { $exists: false }, amount: { $type: 'number' } };
	const toConvert = await services.countDocuments(legacy);
	if (!DRY && toConvert > 0) {
		await services.updateMany(legacy, [
			{ $set: { amountCentavos: { $round: [{ $multiply: ['$amount', 100] }, 0] } } }
		]);
	}
	console.log(`services: ${toConvert} legacy float amounts converted to centavos`);

	console.log(`\nDone${DRY ? ' (dry run — no writes made)' : ''}.`);
} catch (err) {
	console.error('Backfill failed:', err);
	process.exitCode = 1;
} finally {
	await client.close();
}
