/**
 * yyyy-MM-dd for <input type="date">. Strings already in that shape pass
 * through untouched (no timezone round-trip); Date values use their LOCAL
 * calendar day, so a record stamped this morning stays "today".
 */
export const toDateInputValue = (value: string | Date | null | undefined): string => {
	if (!value) return '';
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
