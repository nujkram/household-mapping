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
	try {
		await Promise.all([
			db.collection('users').createIndex({ 'services.resume.loginTokens.hashedToken': 1 }),
			db.collection('users').createIndex({ username: 1 }),
			db.collection('households').createIndex({ barangayId: 1 }),
			db.collection('households').createIndex({ isActive: 1 }),
			db.collection('households').createIndex({ 'dependentDetails.linkedHouseholdId': 1 }),
			db.collection('households').createIndex({ 'grants.grantId': 1 }),
			db.collection('households').createIndex({ parentHouseholdId: 1 }),
			db.collection('grants').createIndex({ name: 1, year: 1 }),
			db.collection('services').createIndex({ dateReceived: -1 }),
			db.collection('barangays').createIndex({ isActive: 1, name: 1 })
		]);
	} catch (error) {
		// Don't take the app down if index creation fails (e.g. read-only user).
		indexesEnsured = false;
		console.error('Failed to ensure MongoDB indexes:', error);
	}
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
