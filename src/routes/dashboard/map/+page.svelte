<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { MarkerClusterer } from '@googlemaps/markerclusterer';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { escapeHtml } from '$lib/utils/stringHelper';
	import { getTagColor, TAG_LEGEND, TAG_VALUES } from '$lib/utils/tagHelper';
	import type { PageData } from './$types';

	export let data: PageData;

	let map: google.maps.Map;
	let infoWindow: google.maps.InfoWindow;
	let clusterer: MarkerClusterer;
	let isLoading = true;
	let loadError = '';
	// Markers are keyed by household _id so we can reuse them across filter
	// changes instead of destroying and recreating every marker each keystroke.
	const markersById = new Map<string, google.maps.Marker>();

	let searchTerm = '';
	let selectedBarangay = '';
	let selectedTag = '';
	let mapElement: HTMLDivElement;

	// Debounced copy of the search term so we don't re-run the marker diff on
	// every single keystroke.
	let debouncedSearch = '';
	let debounceTimer: ReturnType<typeof setTimeout>;
	$: {
		clearTimeout(debounceTimer);
		const next = searchTerm;
		debounceTimer = setTimeout(() => (debouncedSearch = next), 250);
	}

	$: filteredHouseholds = data.households.filter((household: any) => {
		const term = debouncedSearch.toLowerCase();
		const matchesSearch =
			term === '' ||
			household.name?.toLowerCase().includes(term) ||
			household.barangayName?.toLowerCase().includes(term);
		const matchesBarangay = selectedBarangay === '' || household.barangayId === selectedBarangay;
		const matchesTag = selectedTag === '' || (household.tag || 'UNTAGGED') === selectedTag;
		return matchesSearch && matchesBarangay && matchesTag;
	});

	// Re-sync markers whenever the filtered set changes and the map is ready.
	$: if (map && clusterer) syncMarkers(filteredHouseholds);

	function getMarkerIcon(tag: string | null): google.maps.Symbol {
		return {
			path: google.maps.SymbolPath.CIRCLE,
			fillColor: getTagColor(tag),
			fillOpacity: 0.8,
			strokeColor: '#000000',
			strokeWeight: 1,
			scale: 8
		};
	}

	function buildInfoContent(household: any): string {
		return `
			<div class="info-window text-black">
				<strong>${escapeHtml(household.fullName || 'Unnamed Household')}</strong><br>
				Barangay: ${escapeHtml(household.barangayName)}<br>
				Tag: ${escapeHtml(household.tag || 'UNTAGGED')}<br>
				Address: ${escapeHtml(household.address || 'No address')}
			</div>
		`;
	}

	function syncMarkers(households: any[]) {
		const nextIds = new Set<string>();

		for (const household of households) {
			const lat = Number.parseFloat(household.latitude);
			const lng = Number.parseFloat(household.longitude);
			if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

			nextIds.add(household._id);
			const existing = markersById.get(household._id);

			if (existing) {
				// Reuse: only update what may have changed.
				existing.setIcon(getMarkerIcon(household.tag));
			} else {
				// No `map` here — the clusterer owns marker attachment.
				const marker = new google.maps.Marker({
					position: { lat, lng },
					icon: getMarkerIcon(household.tag)
				});
				marker.addListener('click', () => {
					infoWindow.setContent(buildInfoContent(household));
					infoWindow.open(map, marker);
				});
				markersById.set(household._id, marker);
			}
		}

		// Drop markers no longer in the filtered set.
		for (const [id] of markersById) {
			if (!nextIds.has(id)) {
				markersById.delete(id);
			}
		}

		// Hand the current set to the clusterer — it groups nearby markers into
		// cluster bubbles so thousands of households stay fast and readable.
		clusterer.clearMarkers(true);
		clusterer.addMarkers([...markersById.values()]);
	}

	onMount(async () => {
		try {
			const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
			if (!apiKey) {
				loadError = 'Google Maps API key is missing';
				console.error(loadError);
				return;
			}

			await loadGoogleMaps(apiKey);

			map = new google.maps.Map(mapElement, {
				center: { lat: 11.442339253918387, lng: 122.69376754760742 },
				zoom: 12,
				styles: [
					{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
				]
			});

			// One shared InfoWindow reused for every marker.
			infoWindow = new google.maps.InfoWindow();
			clusterer = new MarkerClusterer({ map });

			syncMarkers(filteredHouseholds);
		} catch (error) {
			loadError = 'Failed to load the map. Please try reloading the page.';
			console.error('Error loading map:', error);
		} finally {
			isLoading = false;
		}
	});

	onDestroy(() => {
		clearTimeout(debounceTimer);
		clusterer?.clearMarkers();
		markersById.clear();
	});
</script>

<svelte:head>
	<title>Household Map</title>
</svelte:head>

<div class="container mx-auto p-4">
	<div class="mb-4 flex flex-wrap gap-4">
		<label class="sr-only" for="map-search">Search households</label>
		<input
			id="map-search"
			type="text"
			bind:value={searchTerm}
			placeholder="Search by name..."
			class="input p-2 border rounded"
		/>

		<label class="sr-only" for="map-barangay">Filter by barangay</label>
		<select id="map-barangay" bind:value={selectedBarangay} class="p-2 border rounded select">
			<option value="">All Barangays</option>
			{#each data.barangays as barangay}
				<option value={barangay._id}>{barangay.name}</option>
			{/each}
		</select>

		<label class="sr-only" for="map-tag">Filter by tag</label>
		<select id="map-tag" bind:value={selectedTag} class="p-2 border rounded select">
			<option value="">All Tags</option>
			{#each TAG_VALUES as tag}
				<option value={tag}>{tag}</option>
			{/each}
		</select>

		<div class="flex flex-wrap items-center gap-4 ml-auto">
			{#each TAG_LEGEND as { label, swatchClass }}
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 rounded-full {swatchClass}"></div>
					<span>{label}</span>
				</div>
			{/each}
		</div>
	</div>

	{#if !isLoading && !loadError}
		<p class="text-sm opacity-60 mb-2">
			Showing {filteredHouseholds.length} of {data.households.length} households
		</p>
	{/if}

	<div class="relative">
		<div bind:this={mapElement} class="h-[600px] w-full rounded-lg shadow-lg"></div>
		{#if isLoading}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-100/60 rounded-lg"
			>
				<div class="placeholder-circle animate-pulse w-16"></div>
				<p class="opacity-70">Loading map…</p>
			</div>
		{:else if loadError}
			<div
				class="absolute inset-0 flex items-center justify-center bg-surface-100/60 rounded-lg"
			>
				<p class="text-error-500">{loadError}</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.info-window {
		padding: 8px;
		max-width: 200px;
	}
</style>
