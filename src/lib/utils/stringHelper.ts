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
