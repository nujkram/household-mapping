import { dev } from '$app/environment';
import dotenv from 'dotenv';
dotenv.config();
import { MongoClient, type Db } from 'mongodb';

const uri = process.env['DATABASE_URL'];

let cachedDb: Db | null = null;
let indexesEnsured = false;

if (!uri) {
	throw new Error('Please DATABASE_URL to your environment');
}

if (dev && !uri?.includes('Staging') && !uri?.includes('Test')) {
	console.info('🚨 You are using Production database in development mode 🚨');
}

if (dev && uri?.includes('Test')) {
	console.info('🚨 You are using Test database in development mode 🚨');
}

/**
 * Create the indexes our query patterns rely on. `createIndex` is idempotent, so
 * this is safe to call on every cold start; it's a no-op once the index exists.
 * The login-token index is the most important — that lookup runs on every
 * request in hooks.server.ts.
 */
const ensureIndexes = async (db: Db): Promise<void> => {
	if (indexesEnsured) return;
	indexesEnsured = true;

	// Each index is created independently so one failure (e.g. a UNIQUE index
	// that can't build because pre-existing duplicates exist) doesn't block the
	// rest. A failed unique index just means uniqueness isn't enforced yet —
	// logged loudly so the dupes can be cleaned up and the app is redeployed.
	const specs: [string, Record<string, 1 | -1>, { unique?: boolean }?][] = [
		['users', { 'services.resume.loginTokens.hashedToken': 1 }],
		['users', { username: 1 }, { unique: true }],
		['households', { barangayId: 1 }],
		['households', { isActive: 1 }],
		['households', { 'dependentDetails.linkedHouseholdId': 1 }],
		['households', { 'grants.grantId': 1 }],
		['households', { parentHouseholdId: 1 }],
		// List sorts (updatedAt / fullName) — avoid full in-memory sorts at scale.
		['households', { isActive: 1, updatedAt: -1 }],
		['households', { isActive: 1, fullName: 1 }],
		['households', { tag: 1 }],
		['grants', { name: 1, year: 1 }, { unique: true }],
		['services', { dateReceived: -1 }],
		// Service lookups + the per-household service totals on the list page.
		['services', { householdId: 1 }],
		['barangays', { isActive: 1, name: 1 }]
	];

	await Promise.all(
		specs.map(([coll, keys, opts]) =>
			db
				.collection(coll)
				.createIndex(keys, opts ?? {})
				.catch((error) => {
					indexesEnsured = false; // allow a retry on the next cold start
					console.error(`Failed to create index on ${coll} ${JSON.stringify(keys)}:`, error?.message);
				})
		)
	);
};

const connectToDatabase = async (): Promise<Db> => {
	if (cachedDb) return cachedDb;

	const client = await MongoClient.connect(uri as string);

	const currentDb = uri?.includes('Staging')
		? 'householdStaging'
		: uri?.includes('Test')
			? 'householdTest'
			: 'householdProduction';

	const db = client.db(currentDb);
	cachedDb = db;
	await ensureIndexes(db);
	return db;
};

const clientPromise = async (): Promise<Db> => await connectToDatabase();

// Export a module-scoped MongoClient promise.
// By doing this in a separate module,
// the client can be shared across functions.
export default clientPromise;
