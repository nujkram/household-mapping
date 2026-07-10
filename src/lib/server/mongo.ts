import { dev } from '$app/environment';
import dotenv from 'dotenv';
dotenv.config();
import { MongoClient, type Db, type ClientSession } from 'mongodb';

const uri = process.env['DATABASE_URL'];

let cachedDb: Db | null = null;
let cachedClient: MongoClient | null = null;
let indexesEnsured = false;
let txnUnsupported = false; // set once if the deployment can't do transactions

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
		// Numeric coordinate mirror for indexed viewport/bounds queries.
		['households', { lat: 1, lng: 1 }],
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
	cachedClient = client;

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

const isTxnUnsupported = (err: unknown): boolean => {
	const e = err as { code?: number; codeName?: string; message?: string };
	// Standalone mongod (no replica set) rejects transactions with these signals.
	return (
		e?.code === 20 ||
		e?.codeName === 'IllegalOperation' ||
		/Transaction numbers are only allowed|replica set|Transactions are not supported/i.test(
			e?.message ?? ''
		)
	);
};

/**
 * Run `fn` inside a MongoDB transaction so multi-document writes commit
 * all-or-nothing. Falls back to running WITHOUT a session on deployments that
 * don't support transactions (a standalone mongod, e.g. some local dev) — there
 * the writes are sequential/non-atomic, matching the previous behavior. Atlas
 * and any replica set get the real guarantee.
 */
export const withTransaction = async <T>(
	fn: (session: ClientSession | undefined) => Promise<T>
): Promise<T> => {
	await connectToDatabase();
	if (txnUnsupported || !cachedClient) return fn(undefined);

	const session = cachedClient.startSession();
	try {
		let result!: T;
		await session.withTransaction(async () => {
			result = await fn(session);
		});
		return result;
	} catch (err) {
		if (isTxnUnsupported(err)) {
			txnUnsupported = true;
			console.warn('MongoDB transactions unsupported here; running non-atomically.');
			return fn(undefined);
		}
		throw err;
	} finally {
		await session.endSession();
	}
};

// Export a module-scoped MongoClient promise.
// By doing this in a separate module,
// the client can be shared across functions.
export default clientPromise;
