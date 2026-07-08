/**
 * @name Random.id
 * @summary Return a unique identifier, such as `"Jjwjg6gouWLXhMGKW"`, that is
 * likely to be unique in the whole world.
 * @param {Number} [charsCount] Optional length of the identifier in characters
 *   (defaults to 17)
 */
export const id = (charsCount = 17): string => {
	return _randomString(charsCount, UNMISTAKABLE_CHARS);
};

const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const _randomString = (charsCount: number, alphabet: string): string => {
	let result = '';
	for (let i = 0; i < charsCount; i++) {
		result += choice(alphabet);
	}
	return result;
};

/**
 * @name Random.choice
 * @summary Return a random element of the given array or string.
 * @param {Array|String} arrayOrString Array or string to choose from
 */
const choice = (arrayOrString: string | unknown[]) => {
	const index = Math.floor(Math.random() * arrayOrString.length);
	if (typeof arrayOrString === 'string') {
		return arrayOrString.substr(index, 1);
	}
	return arrayOrString[index];
};

/**
 * Compute an age in whole years from a date of birth, accounting for whether
 * this year's birthday has passed yet. Returns '' for missing/invalid input.
 */
export const calculateAge = (dateOfBirth: string | null | undefined): number | '' => {
	if (!dateOfBirth) {
		return '';
	}
	const birthDate = new Date(dateOfBirth);
	if (Number.isNaN(birthDate.getTime())) {
		return '';
	}
	const now = new Date();
	let age = now.getFullYear() - birthDate.getFullYear();
	const monthDiff = now.getMonth() - birthDate.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
		age--;
	}
	return age;
};
