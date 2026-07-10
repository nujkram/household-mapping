/**
 * Money helpers. Amounts that get summed (service amounts) are stored as integer
 * CENTAVOS to avoid float drift in aggregation. Peso input from forms is
 * comma-tolerant and rejects junk (returns null rather than storing NaN).
 */

/** Parse a peso value from a form (number or "12,000.50" string). Null if invalid/blank. */
export const parsePesoInput = (v: unknown): number | null => {
	if (v === '' || v === null || v === undefined) return null;
	const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
	return Number.isFinite(n) ? n : null;
};

/** Pesos → integer centavos (rounded). Null passes through. */
export const pesosToCentavos = (pesos: number | null | undefined): number | null =>
	pesos === null || pesos === undefined ? null : Math.round(pesos * 100);

/** Integer centavos → pesos number. */
export const centavosToPesos = (c: number | null | undefined): number | null =>
	c === null || c === undefined ? null : c / 100;

/**
 * Read a service's amount as centavos, tolerating legacy records that stored a
 * float peso `amount` before the centavos migration.
 */
export const serviceCentavos = (svc: {
	amountCentavos?: number | null;
	amount?: number | null;
}): number => {
	if (typeof svc.amountCentavos === 'number' && Number.isFinite(svc.amountCentavos)) {
		return svc.amountCentavos;
	}
	if (typeof svc.amount === 'number' && Number.isFinite(svc.amount)) {
		return Math.round(svc.amount * 100);
	}
	return 0;
};

/** Format integer centavos as "₱1,234.50". */
export const formatCentavos = (c: number | null | undefined): string => {
	if (c === null || c === undefined || !Number.isFinite(c)) return '—';
	return `₱${(c / 100).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}`;
};
