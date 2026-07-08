import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// Cost factor for password hashing. 12 is a sane 2026 baseline; bcrypt encodes
// the cost in the hash itself, so existing lower-cost hashes still verify.
const BCRYPT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
	return bcrypt.compare(password, hash);
};

/**
 * Hash a session token for storage/lookup. We store ONLY the hash in the DB and
 * send the raw token in the cookie, so a database read (or a leaky endpoint)
 * never yields a usable session cookie. SHA-256 is used (not bcrypt) because the
 * hash must be deterministic to look the token up on every request.
 */
export const hashSessionToken = (token: string): string => {
	return crypto.createHash('sha256').update(token).digest('base64');
};

/** Generate a fresh session token: the raw value for the cookie + its stored hash. */
export const generateSessionToken = (): { token: string; hashedToken: string } => {
	const token = crypto.randomBytes(32).toString('hex');
	return { token, hashedToken: hashSessionToken(token) };
};
