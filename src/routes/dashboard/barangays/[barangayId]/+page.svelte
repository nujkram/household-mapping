<script lang="ts">
	import { Drawer, getDrawerStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import Update from '$lib/components/forms/barangay/Update.svelte';
	export let data;

	let { barangayDetail } = data;

	// drawer settings
	const drawerUpdate: DrawerSettings = {
		id: 'updateBarangay',
		bgDrawer: 'bg-gradient-to-t from-slate-900 via-gray-950 to-zinc-950 text-white',
		bgBackdrop: 'bg-gradient-to-tr from-slate-900/50 via-gray-950/50 to-zinc-950/50',
		width: 'w-[280px] md:w-[480px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerStore = getDrawerStore();
	drawerStore.close();

	let map: google.maps.Map;
	let marker: google.maps.Marker;

	const initMap = (): void => {
		const barangayLocation = {
			lat: Number.parseFloat(barangayDetail.latitude),
			lng: Number.parseFloat(barangayDetail.longitude)
		};

		map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
			center: barangayLocation,
			zoom: 13
		});

		marker = new google.maps.Marker({
			position: barangayLocation,
			map: map
		});
	};

	// Initialize Google Maps
	const loadGoogleMaps = () => {
		const script = document.createElement('script');
		script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&callback=initMap`;
		script.async = true;
		script.defer = true;
		document.head.appendChild(script);

		// @ts-ignore
		window.initMap = initMap;
	};

	$: if (barangayDetail) {
		loadGoogleMaps();
	}
</script>

<div class="card p-4">
	<header class="card-header">
		<h1 class="h1">Barangay Details</h1>
	</header>

	<section class="p-4">
		<!-- Map Section -->
		<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden">
			<div id="map" class="h-[300px] w-full"></div>
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
			<button type="button" on:click={() => window.history.back()}>Close</button>
		</div>
	</footer>
</div>

<Drawer>
	{#if $drawerStore.id === 'updateBarangay'}
		<Update data={barangayDetail} moduleName="barangays" {drawerStore} />
	{/if}
</Drawer>
