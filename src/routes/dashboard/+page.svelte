<script lang="ts">
	import { onMount } from 'svelte';
	import type { Barangay } from '$lib/utils/types';
	export let data;
	let { user } = data;

	let mapElement: HTMLElement;
	let map: google.maps.Map;
	let markers: google.maps.Marker[] = [];
	let barangays: Barangay[] = [];

	const initMap = (): void => {
		// Center the map on a default location (you can adjust these coordinates)
		const defaultLocation = { lat: 11.442339253918387, lng: 122.69376754760742 };

		map = new google.maps.Map(mapElement, {
			center: defaultLocation,
			zoom: 12
		});

		// Add markers for each barangay
		for (const barangay of barangays) {
			const lat = parseFloat(barangay.latitude);
			const lng = parseFloat(barangay.longitude);

			const marker = new google.maps.Marker({
				position: { lat, lng },
				map: map,
				title: barangay.name
			});

			// Add info window for each marker
			const infoWindow = new google.maps.InfoWindow({
				content: `
					<div class="p-2 text-black">
						<h3 class="font-bold">${barangay.name}</h3>
						<p>Captain: ${barangay.fullName}</p>
						<p>Contact: ${barangay.phone}</p>
					</div>
				`
			});

			marker.addListener('click', () => {
				infoWindow.open(map, marker);
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

			// Load Google Maps script
			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&callback=initMap`;
			script.async = true;
			script.defer = true;
			document.head.appendChild(script);

			// @ts-ignore
			window.initMap = initMap;
		} catch (error) {
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
