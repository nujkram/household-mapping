/**
 * Philippine Standard Geographic Code (PSGC) reference for this deployment.
 *
 * The app currently covers a single municipality — Sigma, Capiz (Region VI).
 * PSGC codes are 10 digits and hierarchical: the first 2 digits identify the
 * region, the first 5 the province, the first 7 the city/municipality, and all
 * 10 the barangay. Values are the official PSA classification codes.
 *
 * Source: PSA Philippine Standard Geographic Code (mirrored via psgc.cloud).
 */

export type PsgcEntry = { code: string; name: string };

export const PSGC_REGION: PsgcEntry = { code: '0600000000', name: 'Region VI (Western Visayas)' };
export const PSGC_PROVINCE: PsgcEntry = { code: '0601900000', name: 'Capiz' };
export const PSGC_MUNICIPALITY: PsgcEntry = { code: '0601916000', name: 'Sigma' };

/** Official barangays of Sigma (PSA spelling), sorted by name. */
export const SIGMA_BARANGAYS: PsgcEntry[] = [
	{ code: '0601916001', name: 'Acbo' },
	{ code: '0601916002', name: 'Amaga' },
	{ code: '0601916003', name: 'Balucuan' },
	{ code: '0601916004', name: 'Bangonbangon' },
	{ code: '0601916005', name: 'Capuyhan' },
	{ code: '0601916006', name: 'Cogon' },
	{ code: '0601916007', name: 'Dayhagon' },
	{ code: '0601916008', name: 'Guintas' },
	{ code: '0601916009', name: 'Malapad Cogon' },
	{ code: '0601916010', name: 'Mangoso' },
	{ code: '0601916011', name: 'Mansacul' },
	{ code: '0601916012', name: 'Matangcong' },
	{ code: '0601916013', name: 'Matinabus' },
	{ code: '0601916014', name: 'Mianay' },
	{ code: '0601916015', name: 'Oyong' },
	{ code: '0601916016', name: 'Pagbunitan' },
	{ code: '0601916017', name: 'Parian' },
	{ code: '0601916018', name: 'Pinamalatican' },
	{ code: '0601916019', name: 'Poblacion Norte' },
	{ code: '0601916020', name: 'Poblacion Sur' },
	{ code: '0601916021', name: 'Tawog' }
];

/**
 * Legacy in-app spellings -> official PSGC name. Lets us match existing records
 * (and the cluster config) to the official register despite the older spelling.
 * Keys are UPPERCASE (stored barangay names are upper-cased).
 */
export const BARANGAY_NAME_ALIASES: Record<string, string> = {
	ACABO: 'Acbo',
	BALUCAN: 'Balucuan',
	BANGOBANGON: 'Bangonbangon'
};

const norm = (s: string | null | undefined): string => (s || '').trim().toUpperCase();

// Normalized name (official + legacy alias) -> entry.
const NAME_TO_ENTRY = new Map<string, PsgcEntry>();
for (const b of SIGMA_BARANGAYS) NAME_TO_ENTRY.set(norm(b.name), b);
for (const [alias, official] of Object.entries(BARANGAY_NAME_ALIASES)) {
	const entry = NAME_TO_ENTRY.get(norm(official));
	if (entry) NAME_TO_ENTRY.set(norm(alias), entry);
}

/** Dropdown options: value = 10-digit barangay code, label = official name. */
export const PSGC_BARANGAY_OPTIONS = SIGMA_BARANGAYS.map((b) => ({ value: b.code, label: b.name }));

export type PsgcCodes = {
	regionCode: string;
	provinceCode: string;
	cityMunicipalityCode: string;
	barangayCode: string;
};

const EMPTY_CODES: PsgcCodes = {
	regionCode: '',
	provinceCode: '',
	cityMunicipalityCode: '',
	barangayCode: ''
};

/**
 * Decompose a 10-digit barangay code into its four PSGC levels. Parent codes are
 * the barangay code's prefixes, zero-padded back to 10 digits — so this stays
 * correct even if another municipality is added later.
 */
export const psgcCodesFromBarangayCode = (code: string | null | undefined): PsgcCodes => {
	const c = (code || '').trim();
	if (!/^\d{10}$/.test(c)) return { ...EMPTY_CODES };
	return {
		regionCode: c.slice(0, 2).padEnd(10, '0'),
		provinceCode: c.slice(0, 5).padEnd(10, '0'),
		cityMunicipalityCode: c.slice(0, 7).padEnd(10, '0'),
		barangayCode: c
	};
};

/** Official PSGC entry for a barangay name (accepts legacy spellings). */
export const psgcEntryForName = (name: string | null | undefined): PsgcEntry | null =>
	NAME_TO_ENTRY.get(norm(name)) ?? null;

/** The four PSGC codes for a barangay name, or empty codes if unknown. */
export const psgcCodesForName = (name: string | null | undefined): PsgcCodes => {
	const entry = psgcEntryForName(name);
	return entry ? psgcCodesFromBarangayCode(entry.code) : { ...EMPTY_CODES };
};

/** Official PSGC name for a barangay name (maps legacy spelling to official). */
export const officialBarangayName = (name: string | null | undefined): string =>
	psgcEntryForName(name)?.name ?? (name || '');
