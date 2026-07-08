<script lang="ts">
	import { onMount } from 'svelte';
	import type { Barangay, SessionUser } from '$lib/utils/types';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { showToast } from '$lib/utils/toastHelper';
	import { getToastStore } from '@skeletonlabs/skeleton';
	import { escapeHtml } from '$lib/utils/stringHelper';
	import { getTagColor } from '$lib/utils/tagHelper';
	import { ROLES } from '$lib/utils/roles';

	type HouseholdCoordinate = {
		lat: number;
		lng: number;
		tag: string;
	};

	type PageData = {
		user: SessionUser;
		barangays: Barangay[];
		households: HouseholdCoordinate[];
		tagCounts: { APIN: number; KONTRA: number; UNTAGGED: number };
		activeGrants: number;
	};

	export let data: PageData;
	const { user, barangays, households, tagCounts, activeGrants } = data;

	const isAdminView = user.role === ROLES.ADMINISTRATOR;
	const isEncoderView = user.role === ROLES.ENCODER;
	const isGrantOfficerView = user.role === ROLES.GRANT_OFFICER;
	const totalHouseholds = tagCounts.APIN + tagCounts.KONTRA + tagCounts.UNTAGGED;

	let mapElement: HTMLElement;
	let map: google.maps.Map;
	let infoWindow: google.maps.InfoWindow;
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

		// One shared InfoWindow reused across all barangay markers.
		infoWindow = new google.maps.InfoWindow();

		// Plot each household as a weighted circle marker, colored by tag.
		for (const h of households) {
			if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) {
				continue;
			}

			new google.maps.Marker({
				position: { lat: h.lat, lng: h.lng },
				map,
				icon: {
					path: google.maps.SymbolPath.CIRCLE,
					fillColor: getTagColor(h.tag),
					fillOpacity: 0.4,
					strokeColor: getTagColor(h.tag),
					strokeOpacity: 0.6,
					strokeWeight: 1,
					// Higher weight (larger circle) for APIN
					scale: h.tag?.toUpperCase() === 'APIN' ? 12 : 8
				}
			});
		}

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

				const content = `<div class="w-[200px]"><h3 class="text-gray-800">${escapeHtml(barangay.name)}</h3>
					<p class="text-gray-600">${escapeHtml(barangay.fullName)}</p>
					<p class="text-gray-600">${escapeHtml(barangay.phone)}</p>
					</div>`;

				marker.addListener('click', () => {
					infoWindow.setContent(content);
					infoWindow.open({ anchor: marker, map });
				});
			}
		}

		isLoading = false;
	};

	onMount(async () => {
		// Only the admin overview renders the map.
		if (!isAdminView) return;

		try {
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
	{#if isAdminView}
		<div class="card p-4">
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:max-w-xl">
				<div class="card p-4 variant-filled-success">
					<h1 class="card-title text-white">APIN</h1>
					<p class="card-text text-white">{tagCounts.APIN}</p>
				</div>
				<div class="card p-4 variant-filled-error">
					<h1 class="card-title text-white">KONTRA</h1>
					<p class="card-text text-white">{tagCounts.KONTRA}</p>
				</div>
				<div class="card p-4 variant-filled-surface">
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
	{:else}
		<!-- Simple, task-focused landing for Encoders and Grant Officers -->
		<div class="card p-6 space-y-6">
			<header>
				<h1 class="h2">Welcome, {user.firstName || user.name}!</h1>
				<p class="opacity-70 mt-1">
					{#if isEncoderView}
						Your job: keep household records correct and tagged.
					{:else}
						Your job: award grants to the right households.
					{/if}
				</p>
			</header>

			{#if isEncoderView && tagCounts.UNTAGGED > 0}
				<p class="opacity-70">
					{tagCounts.UNTAGGED} of {totalHouseholds} households still need a tag.
				</p>
			{/if}

			<!-- Big task buttons -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#if isEncoderView}
					<a href="/dashboard/households" class="card p-8 variant-filled-primary text-center hover:brightness-110">
						<p class="text-4xl mb-2">🏠</p>
						<p class="text-xl font-bold text-white">Households</p>
						<p class="text-white/80 mt-1">Tag, edit details, location & dependents</p>
					</a>
					<a href="/dashboard/map" class="card p-8 variant-filled-secondary text-center hover:brightness-110">
						<p class="text-4xl mb-2">🗺️</p>
						<p class="text-xl font-bold text-white">Map</p>
						<p class="text-white/80 mt-1">See every household on the map</p>
					</a>
				{:else}
					<a href="/dashboard/households" class="card p-8 variant-filled-primary text-center hover:brightness-110">
						<p class="text-4xl mb-2">🏠</p>
						<p class="text-xl font-bold text-white">Award Grants</p>
						<p class="text-white/80 mt-1">Find a household and press “+ Grant”</p>
					</a>
					<a href="/dashboard/grants" class="card p-8 variant-filled-secondary text-center hover:brightness-110">
						<p class="text-4xl mb-2">💰</p>
						<p class="text-xl font-bold text-white">Grants</p>
						<p class="text-white/80 mt-1">
							{activeGrants} active grant{activeGrants === 1 ? '' : 's'} — create or manage them
						</p>
					</a>
				{/if}
			</div>

			<!-- How-to, in plain words -->
			<div class="card p-4 variant-soft">
				<h2 class="h4 mb-2">How to do your tasks</h2>
				<ol class="list-decimal list-inside space-y-1 opacity-80">
					{#if isEncoderView}
						<li>Press <strong>Households</strong> above.</li>
						<li>Find a family using the search box.</li>
						<li>Press the colored tag button to set APIN, KONTRA, or UNTAGGED.</li>
						<li>Press <strong>Update</strong> to fix names, location, or dependents.</li>
					{:else}
						<li>Press <strong>Award Grants</strong> above.</li>
						<li>Find a family using the search box.</li>
						<li>Press <strong>+ Grant</strong> and choose the grant to give.</li>
						<li>To add a new grant program, go to <strong>Grants</strong>.</li>
					{/if}
				</ol>
			</div>
		</div>
	{/if}
</div>
