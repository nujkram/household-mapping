/**
 * Fixed barangay clusters (political/geographic groupings). Membership is by
 * barangay NAME, matched case-insensitively (stored names are uppercase). To
 * change membership, edit this file — nothing else.
 */

import { BARANGAY_NAME_ALIASES } from './psgc';

export type Cluster = {
	id: string;
	label: string;
	barangays: string[];
};

export const CLUSTERS: Cluster[] = [
	{
		id: 'CLUSTER_1',
		label: 'Cluster 1',
		barangays: ['Amaga', 'Parian', 'Pagbunitan', 'Malapad Cogon', 'Dayhagon', 'Mianay']
	},
	{
		id: 'CLUSTER_2',
		label: 'Cluster 2',
		barangays: [
			'Bangonbangon',
			'Acbo',
			'Poblacion Norte',
			'Poblacion Sur',
			'Capuyhan',
			'Matangcong',
			'Oyong',
			'Cogon'
		]
	},
	{
		id: 'CLUSTER_3',
		label: 'Cluster 3',
		barangays: [
			'Mangoso',
			'Guintas',
			'Tawog',
			'Mansacul',
			'Matinabus',
			'Pinamalatican',
			'Balucuan'
		]
	}
];

const norm = (s: string | null | undefined): string => (s || '').trim().toUpperCase();

// name -> clusterId lookup, built once.
const NAME_TO_CLUSTER = new Map<string, string>();
for (const c of CLUSTERS) {
	for (const b of c.barangays) NAME_TO_CLUSTER.set(norm(b), c.id);
}
// Tolerate legacy spellings so resolution still works before the rename
// backfill runs (e.g. a stored "ACABO" resolves like the official "Acbo").
for (const [alias, official] of Object.entries(BARANGAY_NAME_ALIASES)) {
	const cid = NAME_TO_CLUSTER.get(norm(official));
	if (cid) NAME_TO_CLUSTER.set(norm(alias), cid);
}

export const CLUSTER_OPTIONS = CLUSTERS.map((c) => ({ value: c.id, label: c.label }));

/**
 * How an encoder's access is scoped:
 *  - CLUSTER   → the cluster on their account (empty cluster = no restriction)
 *  - BARANGAYS → an explicit list of barangay ids on their account
 *
 * The two are mutually exclusive: whichever mode is not selected has its field
 * cleared on save, so stale data can never widen access later.
 */
export const SCOPE_MODES = ['CLUSTER', 'BARANGAYS'] as const;
export type ScopeMode = (typeof SCOPE_MODES)[number];

/** Normalize any stored value to a known mode; legacy accounts default to CLUSTER. */
export const normalizeScopeMode = (mode: string | null | undefined): ScopeMode =>
	mode === 'BARANGAYS' ? 'BARANGAYS' : 'CLUSTER';

/** Cluster id a barangay name belongs to, or null if unassigned. */
export const clusterIdForBarangay = (name: string | null | undefined): string | null =>
	NAME_TO_CLUSTER.get(norm(name)) ?? null;

/** Human label for a cluster id. */
export const clusterLabel = (id: string | null | undefined): string =>
	CLUSTERS.find((c) => c.id === id)?.label ?? '';

/** Uppercased barangay names in a cluster (for name-based matching). */
export const barangayNamesInCluster = (id: string | null | undefined): string[] =>
	CLUSTERS.find((c) => c.id === id)?.barangays.map(norm) ?? [];

export const isClusterId = (id: string | null | undefined): boolean =>
	CLUSTERS.some((c) => c.id === id);

/**
 * The cluster for a barangay record: an explicitly stored `cluster` field wins;
 * otherwise fall back to the fixed name-based config. This lets admins override
 * per-barangay while un-edited barangays stay correctly clustered.
 */
export const resolveClusterId = (
	barangay: { cluster?: string | null; name?: string | null } | null | undefined
): string | null => {
	if (barangay?.cluster && isClusterId(barangay.cluster)) return barangay.cluster;
	return clusterIdForBarangay(barangay?.name);
};
