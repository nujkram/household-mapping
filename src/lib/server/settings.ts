import clientPromise from '$lib/server/mongo';

/**
 * The one settings document. A fixed _id makes the read a primary-key lookup
 * and the write an idempotent upsert — there can never be two of these.
 */
export const SETTINGS_ID = 'app';

export type AppSettings = {
	/**
	 * Encoders may VIEW and SET the political tag (APIN/KONTRA/UNTAGGED).
	 * Administrators may always tag, regardless of this flag; Grant Officers
	 * never tag. One flag gates both viewing and editing — when it is off an
	 * encoder sees no tags at all.
	 */
	encoderTagging: boolean;
};

/**
 * How the app behaves before an admin has ever saved settings: tagging is
 * administrator-only.
 */
const DEFAULTS: AppSettings = { encoderTagging: false };

/**
 * How long a cached copy is trusted.
 *
 * This deploys to Vercel, so several serverless instances run concurrently and
 * each has its OWN module scope. `invalidateSettings()` after a write only
 * clears the cache on the instance that served that POST; every other warm
 * instance keeps its own copy. The TTL — not the invalidation — is what
 * actually bounds fleet-wide staleness.
 *
 * 30s is the balance. The root layout load runs on every page view, so an
 * uncached findOne would add a DB round trip to every navigation. On the other
 * side, a policy flag an admin touches a handful of times a year converging
 * within 30 seconds is indistinguishable from instant, and it self-heals with
 * no cross-instance messaging.
 *
 * Security does not ride on this TTL: the two endpoints that WRITE a tag read
 * with `{ fresh: true }`, so an encoder can never write a tag through a stale
 * copy. The worst a stale copy can do is render a tag button the server then
 * refuses — fail closed, visibly.
 */
const TTL_MS = 30_000;

let cached: AppSettings | null = null;
let cachedAt = 0;
/**
 * The in-flight read, so a burst of concurrent requests on a cold instance
 * issues ONE findOne instead of one per request.
 */
let inFlight: Promise<AppSettings> | null = null;

const readFromDb = async (): Promise<AppSettings> => {
	const db = await clientPromise();
	const doc = await db
		.collection<{ _id: string; encoderTagging?: boolean }>('settings')
		.findOne({ _id: SETTINGS_ID }, { projection: { encoderTagging: 1 } });
	// Missing document (first run), missing field, or a legacy non-boolean all
	// resolve to the safe default.
	return { encoderTagging: doc?.encoderTagging === true };
};

/**
 * The app-wide settings, cached per instance for TTL_MS.
 *
 * Pass `{ fresh: true }` to bypass the cache — used by the endpoints that
 * ENFORCE the flag on a write, and by the admin settings page load so an admin
 * always sees ground truth rather than their own instance's stale copy.
 */
export const getSettings = async (opts: { fresh?: boolean } = {}): Promise<AppSettings> => {
	if (!opts.fresh) {
		if (cached && Date.now() - cachedAt < TTL_MS) return cached;
		if (inFlight) return inFlight;
	}

	const promise = readFromDb()
		.then((settings) => {
			cached = settings;
			cachedAt = Date.now();
			return settings;
		})
		.catch((error) => {
			// A settings read must never take a page down, and must never
			// accidentally GRANT a permission. Fall back to the defaults
			// (tagging admin-only) and let the next request retry — nothing is
			// cached, so this does not stick.
			console.error('Failed to read app settings; using defaults:', error);
			return DEFAULTS;
		});

	// A fresh read is deliberately not cached back, so a burst of tag writes
	// can't keep resetting the TTL window in a way that masks a flip.
	if (!opts.fresh) {
		inFlight = promise;
		promise.finally(() => {
			if (inFlight === promise) inFlight = null;
		});
	}
	return promise;
};

/** Convenience for the permission check. Reads through the cache by default. */
export const encoderTaggingEnabled = async (opts?: { fresh?: boolean }): Promise<boolean> =>
	(await getSettings(opts)).encoderTagging;

/**
 * Drop this instance's cached copy. Called immediately after a settings write
 * so the writing instance is correct on the admin's very next request; other
 * instances converge within TTL_MS.
 */
export const invalidateSettings = (): void => {
	cached = null;
	cachedAt = 0;
	inFlight = null;
};
