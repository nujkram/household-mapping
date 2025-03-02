<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	export let data: PageData;

	let map: google.maps.Map;
	let markers: google.maps.Marker[] = [];
	let searchTerm = '';
	let selectedBarangay = '';
	let selectedTag = '';
	let mapElement: HTMLDivElement;

	let filteredHouseholds = data.households;

	$: {
		filteredHouseholds = data.households.filter((household) => {
			const matchesSearch =
				searchTerm === '' ||
				(household.name && household.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
				(household.barangayName &&
					household.barangayName.toLowerCase().includes(searchTerm.toLowerCase()));

			const matchesBarangay = selectedBarangay === '' || household.barangayId === selectedBarangay;

			const matchesTag = selectedTag === '' || household.tag === selectedTag;

			return matchesSearch && matchesBarangay && matchesTag;
		});

		if (map) {
			updateMarkers();
		}
	}

	function getMarkerIcon(tag: string | null): google.maps.Symbol {
		let fillColor: string;
		switch (tag?.toUpperCase()) {
			case 'APIN':
				fillColor = '#4CAF50'; // green
				break;
			case 'KONTRA':
				fillColor = '#2196F3'; // blue
				break;
			default:
				fillColor = '#9E9E9E'; // gray
		}

		return {
			path: google.maps.SymbolPath.CIRCLE,
			fillColor: fillColor,
			fillOpacity: 0.8,
			strokeColor: '#000000',
			strokeWeight: 1,
			scale: 8
		};
	}

	function updateMarkers() {
		// Clear existing markers
		for (const marker of markers) {
			marker.setMap(null);
		}
		markers = [];

		console.log('Filtered households:', filteredHouseholds);

		for (const household of filteredHouseholds) {
			console.log('Processing household:', {
				latitude: household.latitude,
				longitude: household.longitude,
				parsed: {
					lat: Number.parseFloat(household.latitude),
					lng: Number.parseFloat(household.longitude)
				}
			});
			// Validate that coordinates are valid numbers
			const lat = Number.parseFloat(household.latitude);
			const lng = Number.parseFloat(household.longitude);

			if (
				!Number.isNaN(lat) &&
				!Number.isNaN(lng) &&
				Number.isFinite(lat) &&
				Number.isFinite(lng)
			) {
				const marker = new google.maps.Marker({
					position: { lat, lng },
					map: map,
					icon: getMarkerIcon(household.tag)
				});

				const infoWindow = new google.maps.InfoWindow({
					content: `
						<div class="info-window text-black">
							<strong>${household.fullName || 'Unnamed Household'}</strong><br>
							Barangay: ${household.barangayName}<br>
							Tag: ${household.tag || 'UNTAGGED'}<br>
							Address: ${household.address || 'No address'}
						</div>
					`
				});

				marker.addListener('click', () => {
					infoWindow.open(map, marker);
				});

				markers.push(marker);
			}
		}
	}

	onMount(() => {
		if (browser) {
			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
			script.async = true;
			script.defer = true;

			script.onload = () => {
				// Initialize map
				map = new google.maps.Map(mapElement, {
					center: { lat: 11.442339253918387, lng: 122.69376754760742 },
					zoom: 12,
					styles: [
						{
							featureType: 'poi',
							elementType: 'labels',
							stylers: [{ visibility: 'off' }]
						}
					]
				});

				// Add initial markers
				updateMarkers();
			};

			document.head.appendChild(script);
		}
	});
</script>

<svelte:head>
	<title>Household Map</title>
</svelte:head>

<div class="container mx-auto p-4">
	<div class="mb-4 flex gap-4">
		<input
			type="text"
			bind:value={searchTerm}
			placeholder="Search by name..."
			class="input p-2 border rounded"
		/>

		<select bind:value={selectedBarangay} class="p-2 border rounded select">
			<option value="">All Barangays</option>
			{#each data.barangays as barangay}
				<option value={barangay._id}>{barangay.name}</option>
			{/each}
		</select>

		<select bind:value={selectedTag} class="p-2 border rounded select">
			<option value="">All Tags</option>
			<option value="APIN">APIN</option>
			<option value="KONTRA">KONTRA</option>
			<option value="UNTAGGED">UNTAGGED</option>
		</select>

		<div class="flex items-center gap-4 ml-auto">
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-green-500"></div>
				<span>APIN</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-blue-500"></div>
				<span>KONTRA</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-gray-500"></div>
				<span>UNTAGGED</span>
			</div>
		</div>
	</div>

	<div bind:this={mapElement} class="h-[600px] w-full rounded-lg shadow-lg"></div>
</div>

<style>
	.info-window {
		padding: 8px;
		max-width: 200px;
	}
</style>
