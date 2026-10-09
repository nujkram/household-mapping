/**
 * Seed the grants catalog (/dashboard/grants) with the standard services on
 * the paper Household Mapping form, for one year. Idempotent: an entry with the
 * same name + year is left alone, so it is safe to re-run.
 *
 *   npm run seed-grants                  # current year
 *   npm run seed-grants -- --year 2025
 *   npm run seed-grants -- --dry-run     # report only, no writes
 *
 * Reads DATABASE_URL from the environment (.env), like scripts/backfill.mjs.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { randomInt } from 'node:crypto';
import { MongoClient } from 'mongodb';

// The "SERVICES AVAILED" rows on the paper form (OTHERS is free text on the
// household record, not a catalog entry).
const SERVICES = [
	'AICS',
	'TUPAD',
	'BURIAL',
	'PAG-ASA SCHOLAR',
	'MAIPIF',
	'SOCIAL PENSION',
	'PWD',
	'SOLO PARENT SUBSIDY'
];
// Same alphabet as id() in src/lib/common/utils.ts (Meteor Random.id).
const ID_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const newId = () => Array.from({ length: 17 }, () => ID_CHARS[randomInt(ID_CHARS.length)]).join('');

const { values: args } = parseArgs({
	options: {
		year: { type: 'string' },
		'dry-run': { type: 'boolean', default: false }
	},
	allowPositionals: false
});
const year = Number(args.year ?? new Date().getFullYear());
if (!Number.isInteger(year) || year < 1900 || year > 2100) {
	console.error('--year must be a whole year between 1900 and 2100');
	process.exit(2);
}
const DRY = args['dry-run'];

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

const client = new MongoClient(uri);
try {
	await client.connect();
	const grants = client.db(dbName).collection('grants');
	console.log(`Connected to "${dbName}"${DRY ? ' (dry run)' : ''} — seeding ${year}\n`);

	let inserted = 0;
	let skipped = 0;
	for (const name of SERVICES) {
		const exists = await grants.findOne({ name, year }, { projection: { _id: 1 } });
		if (exists) {
			console.log(`  skip    ${name} (${year}) — already exists`);
			skipped++;
			continue;
		}
		if (!DRY) {
			const now = new Date();
			try {
				// Document shape: src/routes/api/admin/grant/insert/+server.ts
				await grants.insertOne({
					_id: newId(),
					name,
					year,
					releasedDate: `${year}-01-01`,
					isActive: true,
					createdAt: now,
					updatedAt: now,
					createdBy: 'scripts/seed-grants',
					updatedBy: 'scripts/seed-grants'
				});
			} catch (error) {
				if (error?.code === 11000) {
					console.log(`  skip    ${name} (${year}) — already exists`);
					skipped++;
					continue;
				}
				throw error;
			}
		}
		console.log(`  ${DRY ? 'would add' : 'added  '} ${name} (${year})`);
		inserted++;
	}
	console.log(`\n${DRY ? 'Would insert' : 'Inserted'} ${inserted}, skipped ${skipped}.`);
} finally {
	await client.close();
}
