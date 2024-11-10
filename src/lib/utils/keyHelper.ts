export const checkKey = (data: any) => {
	for (const key in data) {
		if (
			key === '_id' ||
			key === 'username' ||
			key === 'password' ||
			key === 'createdBy' ||
			key === 'updatedBy' ||
			key === 'image' ||
			key === 'userId' ||
			key === 'barangayId'
		)
			continue;
		if (typeof data[key] === 'string') data[key] = data[key].toUpperCase();
		if (key === 'email') data[key] = data[key].toLowerCase();
	}

	return data;
};
