/**
 * Create a login account from the command line (no admin session needed).
 *
 *   npm run create-user -- --username enc1 --first Juan --last Cruz \
 *     --email enc1@example.com [--role ENCODER] [--cluster CLUSTER_1] \
 *     [--password 'S3cret!'] [--phone 0917...] [--dry-run]
 *
 * Mirrors Users > Add and /api/admin/user/insert: same validation rules, same
 * document shape, same hashing. The browser SHA-256-hexes the password and the
 * server bcrypts that hex, so this script does both steps.
 *
 * Omit --password to have one generated and printed ONCE (or set
 * CREATE_USER_PASSWORD). Note that --password lands in your shell history.
 *
 * Reads DATABASE_URL from the environment (.env), like scripts/backfill.mjs.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { createHash, randomInt } from 'node:crypto';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

// Keep in sync with src/lib/utils/roles.ts and src/lib/utils/clusters.ts
// (this script can't import TypeScript).
const ROLES = ['ADMINISTRATOR', 'ENCODER', 'GRANT_OFFICER', 'TAGGER'];
// Roles that can be restricted to one barangay cluster.
const CLUSTER_ROLES = ['ENCODER', 'TAGGER'];
const CLUSTERS = ['CLUSTER_1', 'CLUSTER_2', 'CLUSTER_3'];
// src/lib/server/auth.ts
const BCRYPT_ROUNDS = 12;
// Same alphabet as id() in src/lib/common/utils.ts (Meteor Random.id).
const ID_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';

const USAGE = `Usage:
  npm run create-user -- --username <name> --first <first> --last <last> --email <email>
                         [--role ENCODER|TAGGER|ADMINISTRATOR|GRANT_OFFICER] [--cluster CLUSTER_1|CLUSTER_2|CLUSTER_3]
                         [--password <pw>] [--phone <phone>] [--dry-run]

  --role      defaults to ENCODER
  --cluster   encoders/taggers only; omit for access to all clusters
  --password  omit to generate one (printed once); or set CREATE_USER_PASSWORD
  --dry-run   validate and print the document without writing`;

const fail = (message, code = 2) => {
	console.error(message);
	process.exit(code);
};

const randomFrom = (alphabet, length) =>
	Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');

let args;
try {
	({ values: args } = parseArgs({
		options: {
			username: { type: 'string' },
			password: { type: 'string' },
			first: { type: 'string' },
			last: { type: 'string' },
			email: { type: 'string' },
			phone: { type: 'string', default: '' },
			role: { type: 'string', default: 'ENCODER' },
			cluster: { type: 'string', default: '' },
			'dry-run': { type: 'boolean', default: false },
			help: { type: 'boolean', default: false }
		},
		allowPositionals: false
	}));
} catch (error) {
	fail(`${error.message}\n\n${USAGE}`);
}

if (args.help) {
	console.log(USAGE);
	process.exit(0);
}

// --- Validation (mirrors userInsertSchema in src/lib/server/validation.ts) ---
const username = (args.username ?? '').trim();
const firstName = (args.first ?? '').trim().toUpperCase();
const lastName = (args.last ?? '').trim().toUpperCase();
const email = (args.email ?? '').trim().toLowerCase();
const phone = (args.phone ?? '').trim();
const role = (args.role ?? 'ENCODER').trim().toUpperCase();
const cluster = (args.cluster ?? '').trim().toUpperCase();

const problems = [];
if (!username) problems.push('--username is required');
if (!firstName) problems.push('--first is required');
if (!lastName) problems.push('--last is required');
if (email.length < 3 || !email.includes('@')) problems.push('--email must be a valid email');
if (!ROLES.includes(role)) problems.push(`--role must be one of ${ROLES.join(', ')}`);
if (cluster && !CLUSTERS.includes(cluster)) {
	problems.push(`--cluster must be one of ${CLUSTERS.join(', ')}`);
}
if (cluster && !CLUSTER_ROLES.includes(role)) {
	problems.push('--cluster only applies to ENCODER or TAGGER accounts');
}
if (problems.length) fail(`${problems.join('\n')}\n\n${USAGE}`);

let password = args.password ?? process.env.CREATE_USER_PASSWORD ?? '';
let generated = false;
if (!password) {
	password = randomFrom(PASSWORD_CHARS, 14);
	generated = true;
} else if (password.length < 8) {
	fail('--password must be at least 8 characters');
}

const uri = process.env.DATABASE_URL;
if (!uri) fail('DATABASE_URL is not set.', 1);
const dbName = uri.includes('Staging')
	? 'householdStaging'
	: uri.includes('Test')
		? 'householdTest'
		: 'householdProduction';

// Browser: SHA256(password) → hex. Server: bcrypt(that hex). Login compares the same way.
const sha256Hex = createHash('sha256').update(password, 'utf8').digest('hex');
const bcryptHash = await bcrypt.hash(sha256Hex, BCRYPT_ROUNDS);

// Document shape: src/routes/api/admin/user/insert/+server.ts
const now = new Date();
const user = {
	_id: randomFrom(ID_CHARS, 17),
	createdAt: now,
	updatedAt: now,
	services: {
		password: { bcrypt: bcryptHash },
		resume: { loginTokens: [] }
	},
	emails: [{ address: email, verified: true }],
	fullName: `${firstName} ${lastName}`,
	firstName,
	lastName,
	username,
	email,
	phone,
	isActive: true,
	isFake: false,
	role,
	// Geographic scoping only applies to encoders and taggers. This script only
	// sets cluster mode; assign explicit barangays via Users > Update instead.
	cluster: CLUSTER_ROLES.includes(role) ? cluster : '',
	scopeMode: 'CLUSTER',
	barangayIds: [],
	createdBy: 'scripts/create-user',
	updatedBy: 'scripts/create-user'
};

const dryRun = args['dry-run'];
console.log(`Target database: "${dbName}"${dryRun ? ' (dry run)' : ''}`);

if (dryRun) {
	console.log(JSON.stringify({ ...user, services: '[redacted]' }, null, 2));
	if (generated) console.log(`\nGenerated password (NOT saved — dry run): ${password}`);
	process.exit(0);
}

const client = new MongoClient(uri);
try {
	await client.connect();
	// The app's ensureIndexes() keeps users.username unique; the pre-check gives
	// a friendly message and the 11000 catch covers the race.
	const users = client.db(dbName).collection('users');

	if (await users.findOne({ username }, { projection: { _id: 1 } })) {
		console.error(`Username "${username}" already exists.`);
		process.exitCode = 1;
	} else {
		try {
			await users.insertOne(user);
			console.log('Created user:');
			console.log(`  _id:      ${user._id}`);
			console.log(`  username: ${user.username}`);
			console.log(`  name:     ${user.fullName}`);
			console.log(`  email:    ${user.email}`);
			console.log(`  role:     ${user.role}${user.cluster ? ` (${user.cluster})` : ''}`);
			if (generated) {
				console.log('\nGenerated password (shown once — change it via Users > Reset Password):');
				console.log(`  ${password}`);
			}
		} catch (error) {
			if (error?.code === 11000) {
				console.error(`Username "${username}" already exists.`);
				process.exitCode = 1;
			} else {
				throw error;
			}
		}
	}
} finally {
	await client.close();
}
