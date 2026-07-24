<script lang="ts">
	import { onMount } from 'svelte';
	import type { Barangay, SessionUser } from '$lib/utils/types';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { showToast } from '$lib/utils/toastHelper';
	import { getToastStore } from '@skeletonlabs/skeleton';
	import { escapeHtml } from '$lib/utils/stringHelper';
	import { getTagColor, getTagConfig } from '$lib/utils/tagHelper';
	import { ROLES } from '$lib/utils/roles';
	import StatCard from '$lib/components/charts/StatCard.svelte';
	import HStackChart from '$lib/components/charts/HStackChart.svelte';
	import TrendChart from '$lib/components/charts/TrendChart.svelte';

	type HouseholdCoordinate = {
		lat: number;
		lng: number;
		tag: string;
	};

	type Analytics = {
		totalHouseholds: number;
		subFamilies: number;
		voters: number;
		located: number;
		reached: number;
		awardsTotal: number;
		activeGrants: number;
		totalGrants: number;
		topBarangays: {
			name: string;
			APIN: number;
			KONTRA: number;
			UNTAGGED: number;
			total: number;
		}[];
		byCluster: { name: string; APIN: number; KONTRA: number; UNTAGGED: number }[];
		awardsByMonth: { month: string; label: string; count: number }[];
	};

	type PageData = {
		user: SessionUser;
		barangays: Barangay[];
		households: HouseholdCoordinate[];
		tagCounts: { APIN: number; KONTRA: number; UNTAGGED: number };
		activeGrants: number;
		analytics: Analytics | null;
	};

	export let data: PageData;
	const { user, barangays, households, tagCounts, activeGrants, analytics } = data;

	const isAdminView = user.role === ROLES.ADMINISTRATOR;
	const isEncoderView = user.role === ROLES.ENCODER;
	const isGrantOfficerView = user.role === ROLES.GRANT_OFFICER;

	// Chart series: fixed order, colors follow the entity (validated variants).
	const tagSeries = (['APIN', 'KONTRA', 'UNTAGGED'] as const).map((t) => ({
		key: t,
		label: getTagConfig(t).label,
		color: getTagConfig(t).chartColor
	}));

	const pct = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);
	const pctLabel = (part: number, whole: number): string => `${Math.round(pct(part, whole))}%`;

	const taggedCount = tagCounts.APIN + tagCounts.KONTRA;

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
	{#if isAdminView && analytics}
		<div class="space-y-4">
			<!-- KPI tiles -->
			<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
				<StatCard
					label="Families"
					value={analytics.totalHouseholds.toLocaleString()}
					sub={analytics.subFamilies > 0
						? `in ${(analytics.totalHouseholds - analytics.subFamilies).toLocaleString()} household dwellings`
						: ''}
				/>
				<StatCard
					label="Tagging progress"
					value={pctLabel(taggedCount, analytics.totalHouseholds)}
					sub="{taggedCount.toLocaleString()} tagged, {tagCounts.UNTAGGED.toLocaleString()} to go"
					meterPct={pct(taggedCount, analytics.totalHouseholds)}
					accent={getTagConfig('APIN').chartColor}
				/>
				<StatCard
					label="Registered voters"
					value={analytics.voters.toLocaleString()}
					sub="{pctLabel(analytics.voters, analytics.totalHouseholds)} of households"
				/>
				<StatCard
					label="Mapped locations"
					value={pctLabel(analytics.located, analytics.totalHouseholds)}
					sub="{analytics.located.toLocaleString()} pinned on the map"
					meterPct={pct(analytics.located, analytics.totalHouseholds)}
					accent="#3B82F6"
				/>
				<StatCard
					label="Grants"
					value={analytics.activeGrants}
					sub="active of {analytics.totalGrants} total"
				/>
				<StatCard
					label="Grant reach"
					value={pctLabel(analytics.reached, analytics.totalHouseholds)}
					sub="{analytics.reached.toLocaleString()} households · {analytics.awardsTotal.toLocaleString()} awards"
					meterPct={pct(analytics.reached, analytics.totalHouseholds)}
					accent="#3B82F6"
				/>
			</div>

			<!-- Charts -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<HStackChart
					title="Tag distribution"
					series={tagSeries}
					rows={[
						{
							label: 'All households',
							values: {
								APIN: tagCounts.APIN,
								KONTRA: tagCounts.KONTRA,
								UNTAGGED: tagCounts.UNTAGGED
							}
						}
					]}
				/>
				<TrendChart
					title="Grant awards per month"
					points={analytics.awardsByMonth}
					color="#3B82F6"
					unit="awards"
				/>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<HStackChart
					title="Households by cluster"
					series={tagSeries}
					rows={analytics.byCluster.map((c) => ({
						label: c.name,
						values: { APIN: c.APIN, KONTRA: c.KONTRA, UNTAGGED: c.UNTAGGED }
					}))}
				/>
				<HStackChart
					title="Households by barangay (top 10)"
					series={tagSeries}
					rows={analytics.topBarangays.map((b) => ({
						label: b.name,
						values: { APIN: b.APIN, KONTRA: b.KONTRA, UNTAGGED: b.UNTAGGED }
					}))}
				/>
			</div>

			<!-- Map -->
			<div class="card p-4">
				<header class="card-header p-0 pb-3">
					<h1 class="h4">Barangay Map Overview</h1>
				</header>
				<div class="border border-gray-300 rounded-lg overflow-hidden relative">
					<div bind:this={mapElement} class="h-[600px] w-full"></div>
					{#if isLoading}
						<div class="absolute inset-0 bg-surface-100/50 flex items-center justify-center">
							<div class="loading loading-spinner loading-lg"></div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<!-- Simple, task-focused landing for Encoders and Grant Officers -->
		<div class="card p-6 space-y-6">
			<header>
				<h1 class="h2">Welcome, {user.firstName || user.name}!</h1>
				<p class="opacity-70 mt-1">
					{#if isEncoderView}
						Your job: keep household records complete and correct.
					{:else}
						Your job: award grants to the right households.
					{/if}
				</p>
			</header>

			<!-- Big task buttons -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#if isEncoderView}
					<a href="/dashboard/households" class="card p-8 variant-filled-primary text-center hover:brightness-110">
						<p class="text-4xl mb-2">🏠</p>
						<p class="text-xl font-bold text-white">Households</p>
						<p class="text-white/80 mt-1">Edit details, location & dependents</p>
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
						<li>Press <strong>Update</strong> to fix names, location, or dependents.</li>
						<li>Press <strong>Add Household</strong> to register a new family.</li>
					{:else}
						<li>Press <strong>Award Grants</strong> above.</li>
						<li>Find a family using the search box.</li>
						<li>Press <strong>+ Grant</strong> to give a grant, or <strong>+ Service</strong> to record a patient service.</li>
						<li>To add a new grant program, go to <strong>Grants</strong>.</li>
					{/if}
				</ol>
			</div>
		</div>
	{/if}
</div>
