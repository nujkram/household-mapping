/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * NOTE: state lives in this process only — it resets on restart and is NOT
 * shared across instances. For a single-instance deployment (the current
 * target) it meaningfully throttles brute-force/DoS. If this ever runs
 * multi-instance, move the counters to a shared store (Redis/Mongo TTL).
 */
type Hit = number[]; // timestamps (ms) within the window
const buckets = new Map<string, Hit>();

// Opportunistic cleanup so the map can't grow without bound.
let lastSweep = 0;
const sweep = (now: number) => {
	if (now - lastSweep < 60_000) return;
	lastSweep = now;
	for (const [key, hits] of buckets) {
		if (hits.length === 0 || hits[hits.length - 1] < now - 3_600_000) buckets.delete(key);
	}
};

/**
 * Record an attempt for `key` and report whether it's now over the limit.
 * @returns { limited, retryAfter } — retryAfter is seconds until a slot frees.
 */
export const rateLimit = (
	key: string,
	max: number,
	windowMs: number,
	now = Date.now()
): { limited: boolean; retryAfter: number } => {
	sweep(now);
	const cutoff = now - windowMs;
	const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
	hits.push(now);
	buckets.set(key, hits);
	if (hits.length > max) {
		const retryAfter = Math.ceil((hits[0] + windowMs - now) / 1000);
		return { limited: true, retryAfter: Math.max(1, retryAfter) };
	}
	return { limited: false, retryAfter: 0 };
};

/** Check whether `key` is already at/over the limit WITHOUT recording a hit. */
export const peekLimited = (key: string, max: number, windowMs: number, now = Date.now()): boolean => {
	const cutoff = now - windowMs;
	const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
	return hits.length >= max;
};

/** Clear a key's counter (e.g. on a successful login). */
export const clearRateLimit = (key: string): void => {
	buckets.delete(key);
};
