<script lang="ts">
	import { Drawer, getDrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import Create from '$lib/components/forms/household/Create.svelte';
	import Update from '$lib/components/forms/barangay/Update.svelte';
	import UpdateHousehold from '$lib/components/forms/household/Update.svelte';
	import { onMount } from 'svelte';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { showToast } from '$lib/utils/toastHelper';
	import TableHousehold from './table-household.svelte';
	import type { Household } from '$lib/utils/types';
	import { goto, invalidateAll } from '$app/navigation';
	import { clusterLabel, clusterIdForBarangay } from '$lib/utils/clusters';

	export let data;

	// Single source of truth: the server load (re-run via invalidateAll after
	// edits). No more reconciling against the global barangay store.
	// (Aggregation results are driver `Document`s; this app uses string _ids.)
	$: barangayDetail = data.barangayDetail as any;

	let selectedHousehold: Household;

	// toast settings
	const toastStore = getToastStore();

	// drawer settings
	const drawerCreate: DrawerSettings = {
		id: 'createHousehold',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerUpdate: DrawerSettings = {
		id: 'updateBarangay',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerUpdateHousehold: DrawerSettings = {
		id: 'updateHousehold',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const handleClickView = (item: Household) => {
		goto(`/dashboard/barangays/${barangayDetail._id}/${item._id}`);
	};

	const handleClickUpdate = (item: Household) => {
		selectedHousehold = item;
		drawerStore.open(drawerUpdateHousehold);
	};

	const drawerStore = getDrawerStore();
	drawerStore.close();

	let map: google.maps.Map;
	let marker: google.maps.marker.AdvancedMarkerElement;

	const initMap = (): void => {
		const mapElement = document.getElementById('barangay-map');
		if (!mapElement) {
			console.error('Map element not found');
			return;
		}

		const barangayLocation = {
			lat: Number.parseFloat(barangayDetail.latitude) || 0,
			lng: Number.parseFloat(barangayDetail.longitude) || 0
		};

		try {
			map = new google.maps.Map(mapElement, {
				center: barangayLocation,
				zoom: 13,
				mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
			});

			// Add single marker for barangay center
			marker = new google.maps.marker.AdvancedMarkerElement({
				map,
				position: barangayLocation,
				title: barangayDetail.name || 'Barangay Center'
			});
		} catch (error) {
			console.error('Error initializing map:', error);
		}
	};

	onMount(async () => {
		const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
		if (!apiKey) {
			showToast(toastStore, 'Google Maps API key is missing', false);
			return;
		}

		try {
			await loadGoogleMaps(apiKey, ['marker']);
			initMap();
		} catch (error) {
			showToast(toastStore, 'Failed to load Google Maps', false);
			console.error(error);
		}
	});
</script>

<div class="card p-4 my-2">
	<header class="card-header">
		<h1 class="h1">Barangay Details</h1>
	</header>

	<section class="p-4">
		<!-- Map Section -->
		<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden">
			<div id="barangay-map" class="h-[300px] w-full"></div>
		</div>

		<!-- Details Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Barangay Information -->
			<div class="card p-4">
				<h2 class="h3 mb-4">Barangay Information</h2>
				<div class="space-y-2">
					<div>
						<span class="font-bold">Name:</span>
						<span>{barangayDetail?.name || 'N/A'}</span>
					</div>
					<div>
						<span class="font-bold">Cluster:</span>
						<span>{clusterLabel(clusterIdForBarangay(barangayDetail?.name)) || 'Unassigned'}</span>
					</div>
					<div>
						<span class="font-bold">Coordinates:</span>
						<span>
							{barangayDetail?.latitude || 'N/A'}, {barangayDetail?.longitude || 'N/A'}
						</span>
					</div>
				</div>
			</div>

			<!-- Captain Information -->
			<div class="card p-4">
				<h2 class="h3 mb-4">Barangay Captain</h2>
				<div class="space-y-2">
					<div>
						<span class="font-bold">Full Name:</span>
						<span>{barangayDetail?.fullName || 'N/A'}</span>
					</div>
					<div>
						<span class="font-bold">Contact Number:</span>
						<span>{barangayDetail?.phone || 'N/A'}</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<footer class="card-footer flex justify-end border-t-2 p-4">
		<div class="btn-group variant-filled">
			<button type="button" on:click={() => drawerStore.open(drawerUpdate)}>Edit</button>
			<button type="button" on:click={() => drawerStore.open(drawerCreate)}>Create Household</button
			>
			<button type="button" on:click={() => window.history.back()}>Close</button>
		</div>
	</footer>
</div>

<div class="card p-4 my-2">
	<header class="card-header">
		<h2 class="h3">Household List</h2>
	</header>
	<section class="p-4">
		<TableHousehold
			data={barangayDetail?.households || []}
			{handleClickView}
			{handleClickUpdate}
		/>
	</section>
</div>

<Drawer>
	{#if $drawerStore.id === 'createHousehold'}
		<Create data={barangayDetail} {drawerStore} onSuccess={() => invalidateAll()} />
	{:else if $drawerStore.id === 'updateBarangay'}
		<Update data={barangayDetail} {drawerStore} onSuccess={() => invalidateAll()} />
	{:else if $drawerStore.id === 'updateHousehold'}
		<UpdateHousehold
			data={selectedHousehold}
			barangay={barangayDetail}
			{drawerStore}
			onSuccess={() => invalidateAll()}
		/>
	{/if}
</Drawer>
