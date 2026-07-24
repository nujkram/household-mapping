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

	// Always include `marker` — AdvancedMarkerElement is used across the app, and
	// this loader is a singleton (the first caller's libraries win), so a caller
	// that forgets it would otherwise break marker creation everywhere.
	const libs = Array.from(new Set(['marker', ...libraries]));

	loadingPromise = new Promise((resolve, reject) => {
		try {
			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libs.join(',')}&v=weekly`;
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
