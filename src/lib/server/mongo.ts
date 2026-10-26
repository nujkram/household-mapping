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
	const specs: [
		string,
		Record<string, 1 | -1>,
		{ unique?: boolean; partialFilterExpression?: Record<string, unknown> }?
	][] = [
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
		// Human-readable household code is unique WHEN SET. Partial filter skips the
		// empty-string legacy rows, so the unique index builds over existing data.
		[
			'households',
			{ householdCode: 1 },
			{ unique: true, partialFilterExpression: { householdCode: { $gt: '' } } }
		],
		['grants', { name: 1, year: 1 }, { unique: true }],
		['services', { dateReceived: -1 }],
		// Service lookups + the per-household service totals on the list page.
		['services', { householdId: 1 }],
		['barangays', { isActive: 1, name: 1 }]
	];

	await Promise.all(
		specs.map(async ([coll, keys, opts]) => {
			try {
				if (opts?.unique) await upgradeToUnique(db, coll, keys, opts.partialFilterExpression);
				await db.collection(coll).createIndex(keys, opts ?? {});
			} catch (error) {
				indexesEnsured = false; // allow a retry on the next cold start
				console.error(
					`Failed to create index on ${coll} ${JSON.stringify(keys)}:`,
					(error as Error)?.message
				);
			}
		})
	);
};

/**
 * Migration: an index that was first created WITHOUT `unique` can't be upgraded
 * in place — MongoDB auto-names both versions the same (e.g. `name_1_year_1`)
 * and rejects the new one with "An existing index has the same name". When we
 * find that older non-unique index, drop it so `createIndex` can rebuild it as
 * unique. Before dropping, check for documents that would violate uniqueness:
 * if any exist we keep the old index (queries stay fast) and log the offending
 * values so they can be cleaned up, then the next cold start retries.
 */
const upgradeToUnique = async (
	db: Db,
	coll: string,
	keys: Record<string, 1 | -1>,
	partialFilterExpression?: Record<string, unknown>
): Promise<void> => {
	const collection = db.collection(coll);
	const existing = await collection
		.listIndexes()
		.toArray()
		.catch((error) => {
			// Collection doesn't exist yet — nothing to migrate.
			if ((error as { code?: number })?.code === 26) return [];
			throw error;
		});

	const wantedKey = JSON.stringify(keys);
	const stale = existing.find((ix) => JSON.stringify(ix.key) === wantedKey && !ix.unique);
	if (!stale) return;

	// Group the same way the unique index would compare values (missing → null).
	const groupId = Object.fromEntries(
		Object.keys(keys).map((k) => [k.replace(/\./g, '_'), `$${k}`])
	);
	const dupes = await collection
		.aggregate([
			...(partialFilterExpression ? [{ $match: partialFilterExpression }] : []),
			{ $group: { _id: groupId, count: { $sum: 1 } } },
			{ $match: { count: { $gt: 1 } } },
			{ $limit: 10 }
		])
		.toArray();

	if (dupes.length) {
		throw new Error(
			`cannot make index "${stale.name}" unique; duplicate values exist: ` +
				dupes.map((d) => `${JSON.stringify(d._id)} ×${d.count}`).join(', ')
		);
	}

	await collection.dropIndex(stale.name).catch((error) => {
		// Another instance starting at the same time already dropped it — fine.
		if ((error as { code?: number })?.code !== 27) throw error;
	});
	console.info(`Dropped non-unique index ${coll}.${stale.name}; rebuilding it as unique.`);
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
