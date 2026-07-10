/**
 * One definition of "valid coordinate" for the whole app. Coordinates are stored
 * as strings; this parses them the same way the map does, so the "located" count
 * and the plotted markers can never disagree.
 */

/** Matches a plain numeric string like "12.34", " -5 ", "0". Rejects '', 'NaN', 'abc'. */
export const NUMERIC_STRING = '^\\s*-?\\d+(\\.\\d+)?\\s*$';

export const parseCoord = (v: unknown): number | null => {
	if (typeof v === 'number') return Number.isFinite(v) ? v : null;
	if (typeof v !== 'string' || v.trim() === '') return null;
	const n = Number(v.trim());
	return Number.isFinite(n) ? n : null;
};

export const hasValidCoords = (lat: unknown, lng: unknown): boolean =>
	parseCoord(lat) !== null && parseCoord(lng) !== null;
