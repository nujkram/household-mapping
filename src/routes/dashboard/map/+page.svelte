<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { MarkerClusterer } from '@googlemaps/markerclusterer';
	import { page } from '$app/stores';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { escapeHtml } from '$lib/utils/stringHelper';
	import { getTagColor, TAG_LEGEND, TAG_VALUES } from '$lib/utils/tagHelper';
	import { canTagHouseholds } from '$lib/utils/roles';
	import type { PageData } from './$types';

	export let data: PageData;

	// Admins always see political tags; encoders only while the app-wide
	// encoderTagging setting is on. Everyone else gets a neutral, tag-free map.
	// Reactive (`$:`, not `const`) so an invalidateAll() that changes the flag
	// re-derives it, matching the other call sites. Note that markers already
	// drawn keep their colors until the page remounts — getMarkerIcon() runs
	// once per marker at creation.
	$: showTags = canTagHouseholds($page.data.user?.role, $page.data.encoderTagging);
	const NEUTRAL_COLOR = '#3B82F6';

	let map: google.maps.Map;
	let infoWindow: google.maps.InfoWindow;
	let clusterer: MarkerClusterer;
	let isLoading = true;
	let loadError = '';
	let fetching = false;
	let capped = false;
	let visibleCount = 0;
	// Monotonic request id — a slower older fetch must not overwrite a newer one.
	let latestSeq = 0;

	// Markers reused across viewport refreshes, keyed by household _id.
	const markersById = new Map<string, google.maps.Marker>();
	// barangayId -> name, for InfoWindow display (households come back with ids).
	const barangayName = new Map<string, string>(
		(data.barangays as any[]).map((b) => [b._id, b.name])
	);

	let searchTerm = '';
	let selectedBarangay = '';
	let selectedTag = '';
	let mapElement: HTMLDivElement;

	let debounceTimer: ReturnType<typeof setTimeout>;
	const scheduleFetch = (delay = 250) => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(fetchInView, delay);
	};

	// If tagging is switched off while a tag filter is active, the <select> is
	// unmounted but `selectedTag` would keep narrowing the fetch invisibly.
	$: if (!showTags && selectedTag) {
		selectedTag = '';
		scheduleFetch(0);
	}

	function getMarkerIcon(tag: string | null): google.maps.Symbol {
		return {
			path: google.maps.SymbolPath.CIRCLE,
			// Tag-based color only for admins; everyone else gets a neutral pin.
			fillColor: showTags ? getTagColor(tag) : NEUTRAL_COLOR,
			fillOpacity: 0.8,
			strokeColor: '#000000',
			strokeWeight: 1,
			scale: 8
		};
	}

	function buildInfoContent(h: any): string {
		const tagLine = showTags ? `Tag: ${escapeHtml(h.tag || 'UNTAGGED')}<br>` : '';
		return `
			<div class="info-window text-black">
				<strong>${escapeHtml(h.fullName || 'Unnamed Household')}</strong><br>
				Barangay: ${escapeHtml(barangayName.get(h.barangayId) || 'Unknown')}<br>
				${tagLine}
				Address: ${escapeHtml(h.address || 'No address')}
			</div>
		`;
	}

	// Fetch only the households inside the current viewport (+ active filters).
	async function fetchInView() {
		if (!map || !clusterer) return;
		const bounds = map.getBounds();
		if (!bounds) return;
		const sw = bounds.getSouthWest();
		const ne = bounds.getNorthEast();

		const params = new URLSearchParams({
			swLat: String(sw.lat()),
			swLng: String(sw.lng()),
			neLat: String(ne.lat()),
			neLng: String(ne.lng())
		});
		if (searchTerm.trim()) params.set('q', searchTerm.trim());
		if (selectedBarangay) params.set('barangay', selectedBarangay);
		if (selectedTag) params.set('tag', selectedTag);

		const seq = ++latestSeq;
		fetching = true;
		try {
			const res = await fetch(`/api/admin/household/map?${params}`);
			const result = await res.json();
			// Drop this response if a newer fetch has since been issued (fast panning).
			if (seq !== latestSeq) return;
			if (!res.ok) throw new Error(result?.error || 'Failed to load households');
			syncMarkers(result.households || []);
			capped = Boolean(result.capped);
			visibleCount = (result.households || []).length;
		} catch (error) {
			if (seq === latestSeq) console.error('Error loading households in view:', error);
		} finally {
			if (seq === latestSeq) fetching = false;
		}
	}

	function syncMarkers(households: any[]) {
		const nextIds = new Set<string>();
		for (const h of households) {
			if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) continue;
			nextIds.add(h._id);
			const existing = markersById.get(h._id);
			if (existing) {
				existing.setIcon(getMarkerIcon(h.tag));
			} else {
				const marker = new google.maps.Marker({
					position: { lat: h.lat, lng: h.lng },
					icon: getMarkerIcon(h.tag)
				});
				marker.addListener('click', () => {
					infoWindow.setContent(buildInfoContent(h));
					infoWindow.open(map, marker);
				});
				markersById.set(h._id, marker);
			}
		}
		for (const [id] of markersById) {
			if (!nextIds.has(id)) markersById.delete(id);
		}
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
				styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
			});

			infoWindow = new google.maps.InfoWindow();
			clusterer = new MarkerClusterer({ map });

			// Refetch whenever the user finishes panning/zooming.
			map.addListener('idle', () => scheduleFetch(250));
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
	{#if data.migrationNeeded}
		<aside class="card variant-filled-warning p-3 mb-4">
			Some households aren't showing on the map yet — the location migration hasn't been run.
			An administrator should run <code class="code">npm run backfill</code> once.
		</aside>
	{/if}

	<div class="mb-4 flex flex-wrap gap-4">
		<label class="sr-only" for="map-search">Search households</label>
		<input
			id="map-search"
			type="text"
			bind:value={searchTerm}
			on:input={() => scheduleFetch(400)}
			placeholder="Search by name..."
			class="input p-2 border rounded"
		/>

		<label class="sr-only" for="map-barangay">Filter by barangay</label>
		<select
			id="map-barangay"
			bind:value={selectedBarangay}
			on:change={() => scheduleFetch(0)}
			class="p-2 border rounded select"
		>
			<option value="">All Barangays</option>
			{#each data.barangays as barangay}
				<option value={barangay._id}>{barangay.name}</option>
			{/each}
		</select>

		{#if showTags}
			<label class="sr-only" for="map-tag">Filter by tag</label>
			<select
				id="map-tag"
				bind:value={selectedTag}
				on:change={() => scheduleFetch(0)}
				class="p-2 border rounded select"
			>
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
		{/if}
	</div>

	{#if !isLoading && !loadError}
		<p class="text-sm opacity-60 mb-2">
			{fetching ? 'Loading…' : `Showing ${visibleCount} households in view`}
			{#if capped}
				<span class="text-warning-600">— too many to show all; zoom in to see the rest.</span>
			{/if}
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
			<div class="absolute inset-0 flex items-center justify-center bg-surface-100/60 rounded-lg">
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
