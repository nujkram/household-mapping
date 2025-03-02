<script lang="ts">
	import { onMount } from 'svelte';
	import type { Barangay, User } from '$lib/utils/types';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { showToast } from '$lib/utils/toastHelper';
	import { getToastStore } from '@skeletonlabs/skeleton';

	type HouseholdCoordinate = {
		lat: number;
		lng: number;
		tag: string;
	};

	type PageData = {
		user: User;
		barangays: Barangay[];
		households: HouseholdCoordinate[];
	};

	export let data: PageData;
	const { user, barangays, households, tagCounts } = data;

	let mapElement: HTMLElement;
	let map: google.maps.Map;
	let heatmap: google.maps.visualization.HeatmapLayer;
	let isLoading = true;

	// toast settings
	const toastStore = getToastStore();

	const initMap = (): void => {
		if (!barangays || barangays.length === 0) {
			console.warn('No barangays data available');
			return;
		}

		const defaultLocation = { lat: 11.442339253918387, lng: 122.69376754760742 };

		map = new google.maps.Map(mapElement, {
			center: defaultLocation,
			zoom: 12,
			mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
		});

		// Create heatmap layer
		const heatmapData = households.map((h: HouseholdCoordinate) => ({
			location: new google.maps.LatLng(h.lat, h.lng),
			weight: h.tag === 'APIN' ? 1 : 0.5 // Higher weight for APIN
		}));

		heatmap = new google.maps.visualization.HeatmapLayer({
			data: heatmapData,
			map: map,
			radius: 30,
			opacity: 0.7,
			gradient: [
				'rgba(0, 255, 255, 0)',
				'rgba(0, 255, 255, 1)',
				'rgba(0, 191, 255, 1)',
				'rgba(0, 127, 255, 1)',
				'rgba(0, 63, 255, 1)',
				'rgba(0, 0, 255, 1)',
				'rgba(0, 0, 223, 1)',
				'rgba(0, 0, 191, 1)',
				'rgba(0, 0, 159, 1)',
				'rgba(0, 0, 127, 1)',
				'rgba(63, 0, 91, 1)',
				'rgba(127, 0, 63, 1)',
				'rgba(191, 0, 31, 1)',
				'rgba(255, 0, 0, 1)'
			]
		});

		// Add markers for barangays
		for (const barangay of barangays) {
			const lat = Number.parseFloat(barangay.latitude);
			const lng = Number.parseFloat(barangay.longitude);

			if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
				const marker = new google.maps.Marker({
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
			}
		}

		isLoading = false;
	};

	onMount(async () => {
		try {
			const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
			if (!apiKey) {
				showToast(toastStore, 'Google Maps API key is missing', false);
				return;
			}

			await loadGoogleMaps(apiKey, ['marker', 'visualization', 'advanced-markers']);
			initMap();
		} catch (error) {
			showToast(toastStore, 'Error loading map', false);
			console.error('Error loading map:', error);
		}
	});
</script>

<div class="container mx-auto p-4">
	<div class="card p-4">
		<div class="flex gap-2">
			<div class="card p-4 variant-filled-success w-2/12">
				<h1 class="card-title text-white">APIN</h1>
				<p class="card-text text-white">{tagCounts.APIN}</p>
			</div>
			<div class="card p-4 variant-filled-primary w-2/12">
				<h1 class="card-title text-white">KONTRA</h1>
				<p class="card-text text-white">{tagCounts.KONTRA}</p>
			</div>
			<div class="card p-4 variant-filled-error w-2/12">
				<h1 class="card-title text-white">UNTAGGED</h1>
				<p class="card-text text-white">{tagCounts.UNTAGGED}</p>
			</div>
		</div>
		<header class="card-header">
			<h1 class="h3">Barangay Map Overview</h1>
		</header>
		<section class="p-4">
			<div class="border border-gray-300 rounded-lg overflow-hidden relative">
				<div bind:this={mapElement} class="h-[600px] w-full"></div>
				{#if isLoading}
					<div class="absolute inset-0 bg-surface-100/50 flex items-center justify-center">
						<div class="loading loading-spinner loading-lg"></div>
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>
