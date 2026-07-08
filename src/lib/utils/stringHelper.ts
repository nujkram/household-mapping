const formatLabel = (label: string) => {
	return (
		label.charAt(0).toUpperCase() +
		label
			.slice(1)
			.split('')
			.map((char, index) => (index > 0 && char === char.toUpperCase() ? ' ' + char : char))
			.join('')
	);
};

export default formatLabel;

export const formatUsername = (fullName: string) => {
	return fullName
		.split(' ')
		.map((name) => name.charAt(0).toLowerCase())
		.join('');
};

/**
 * Escape a value for safe interpolation into an HTML string (e.g. Google Maps
 * InfoWindow content). Prevents stored user data such as household names from
 * injecting markup/script.
 */
export const escapeHtml = (value: unknown): string => {
	if (value === null || value === undefined) return '';
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};
