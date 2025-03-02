let isLoaded = false;
let loadingPromise: Promise<void> | null = null;

export const loadGoogleMaps = async (apiKey: string, libraries: string[] = []): Promise<void> => {
	if (isLoaded) {
		return;
	}

	// If already loading, return existing promise
	if (loadingPromise) {
		return loadingPromise;
	}

	// Add visualization library if not already included
	if (!libraries.includes('visualization')) {
		libraries.push('visualization');
	}

	loadingPromise = new Promise((resolve, reject) => {
		try {
			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}&v=weekly`;
			script.async = true;
			script.defer = true;

			script.onload = () => {
				isLoaded = true;
				loadingPromise = null;
				resolve();
			};

			script.onerror = () => {
				loadingPromise = null;
				reject(new Error('Failed to load Google Maps API'));
			};

			document.head.appendChild(script);
		} catch (error) {
			loadingPromise = null;
			reject(error);
		}
	});

	return loadingPromise;
};

export const isGoogleMapsLoaded = (): boolean => {
	return isLoaded;
};
