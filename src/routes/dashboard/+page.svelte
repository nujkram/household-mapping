<script lang="ts">
	import { onMount } from 'svelte';
	import type { Barangay } from '$lib/utils/types';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { showToast } from '$lib/utils/toastHelper';
	import { getToastStore } from '@skeletonlabs/skeleton';
	export let data;
	let { user } = data;

	let mapElement: HTMLElement;
	let map: google.maps.Map;
	let markers: google.maps.Marker[] = [];
	let barangays: Barangay[] = [];

	// toast settings
	const toastStore = getToastStore();

	const initMap = (): void => {
		const defaultLocation = { lat: 11.442339253918387, lng: 122.69376754760742 };

		map = new google.maps.Map(mapElement, {
			center: defaultLocation,
			zoom: 12,
			mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
		});

		// Add markers for each barangay
		for (const barangay of barangays) {
			const lat = parseFloat(barangay.latitude);
			const lng = parseFloat(barangay.longitude);

			const marker = new google.maps.marker.AdvancedMarkerElement({
				position: { lat, lng },
				map,
				title: barangay.name
			});

			const infoWindow = new google.maps.InfoWindow({
				content: `<div class="w-[200px]"><h3 class="text-gray-800">${barangay.name}</h3>
				<p class="text-gray-600">${barangay.fullName}</p>
				<p class="text-gray-600">${barangay.phone}</p>
				</div>`
			});

			marker.addListener('click', () => {
				infoWindow.open({
					anchor: marker,
					map
				});
			});

			markers.push(marker);
		}
	};

	onMount(async () => {
		try {
			// Fetch barangays data
			const response = await fetch('/api/admin/barangay');
			const result = await response.json();
			barangays = result.response;

			const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
			if (!apiKey) {
				showToast(toastStore, 'Google Maps API key is missing', false);
				return;
			}

			await loadGoogleMaps(apiKey, ['marker', 'advanced-markers']);
			initMap();
		} catch (error) {
			showToast(toastStore, 'Error loading map', false);
			console.error('Error loading map:', error);
		}
	});
</script>

<div class="container mx-auto p-4">
	<div class="card p-4">
		<header class="card-header">
			<h1 class="h3">Barangay Map Overview</h1>
		</header>
		<section class="p-4">
			<div class="border border-gray-300 rounded-lg overflow-hidden">
				<div bind:this={mapElement} class="h-[600px] w-full"></div>
			</div>
		</section>
	</div>
</div>
