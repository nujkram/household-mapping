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
 * 3. barangays PSGC codes             — regionCode/provinceCode/
 *    cityMunicipalityCode/barangayCode from the official Sigma, Capiz register,
 *    matched by name (incl. legacy spellings), plus rename to official spelling.
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

	// 3. barangays PSGC codes + official spelling -----------------------------
	// Kept in sync with src/lib/utils/psgc.ts (this script can't import TS).
	const PSGC = { region: '0600000000', province: '0601900000', municipality: '0601916000' };
	const SIGMA_BARANGAYS = [
		['Acbo', '0601916001'],
		['Amaga', '0601916002'],
		['Balucuan', '0601916003'],
		['Bangonbangon', '0601916004'],
		['Capuyhan', '0601916005'],
		['Cogon', '0601916006'],
		['Dayhagon', '0601916007'],
		['Guintas', '0601916008'],
		['Malapad Cogon', '0601916009'],
		['Mangoso', '0601916010'],
		['Mansacul', '0601916011'],
		['Matangcong', '0601916012'],
		['Matinabus', '0601916013'],
		['Mianay', '0601916014'],
		['Oyong', '0601916015'],
		['Pagbunitan', '0601916016'],
		['Parian', '0601916017'],
		['Pinamalatican', '0601916018'],
		['Poblacion Norte', '0601916019'],
		['Poblacion Sur', '0601916020'],
		['Tawog', '0601916021']
	];
	// Legacy in-app spelling -> official name.
	const ALIASES = { ACABO: 'Acbo', BALUCAN: 'Balucuan', BANGOBANGON: 'Bangonbangon' };
	const normName = (s) => (s || '').trim().toUpperCase();
	const byName = new Map();
	for (const [name, code] of SIGMA_BARANGAYS) byName.set(normName(name), { name, code });
	for (const [alias, official] of Object.entries(ALIASES)) {
		const e = byName.get(normName(official));
		if (e) byName.set(normName(alias), e);
	}

	const barangays = db.collection('barangays');
	let bUpdated = 0;
	let bSkipped = 0;
	let bUnmatched = 0;
	for await (const b of barangays.find({})) {
		const match = byName.get(normName(b.name));
		if (!match) {
			bUnmatched++;
			continue;
		}
		// Store the official name upper-cased (matches the app's name convention).
		const officialName = match.name.toUpperCase();
		const set = {
			name: officialName,
			barangayCode: match.code,
			regionCode: PSGC.region,
			provinceCode: PSGC.province,
			cityMunicipalityCode: PSGC.municipality
		};
		const needs =
			b.name !== officialName ||
			b.barangayCode !== match.code ||
			b.regionCode !== PSGC.region ||
			b.provinceCode !== PSGC.province ||
			b.cityMunicipalityCode !== PSGC.municipality;
		if (!needs) {
			bSkipped++;
			continue;
		}
		if (!DRY) await barangays.updateOne({ _id: b._id }, { $set: set });
		bUpdated++;
	}
	console.log(
		`barangays: ${bUpdated} given PSGC codes / official spelling, ${bSkipped} already current, ${bUnmatched} unmatched (not in the Sigma register)`
	);

	console.log(`\nDone${DRY ? ' (dry run — no writes made)' : ''}.`);
} catch (err) {
	console.error('Backfill failed:', err);
	process.exitCode = 1;
} finally {
	await client.close();
}
