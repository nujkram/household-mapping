<script lang="ts">
	import { onMount } from 'svelte';
	import { Drawer, getDrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { calculateAge } from '$lib/common/utils';
	import Update from '$lib/components/forms/household/Update.svelte';

	export let data;
	let { householdDetail } = data;

	// drawer settings
	const drawerUpdate: DrawerSettings = {
		id: 'updateHousehold',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerStore = getDrawerStore();
	const toastStore = getToastStore();

	let map: google.maps.Map;
	let marker: google.maps.marker.AdvancedMarkerElement;

	const initMap = (): void => {
		const location = {
			lat: Number(householdDetail.latitude),
			lng: Number(householdDetail.longitude)
		};

		map = new google.maps.Map(document.getElementById('household-map') as HTMLElement, {
			center: location,
			zoom: 15,
			mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
		});

		marker = new google.maps.marker.AdvancedMarkerElement({
			map,
			position: location,
			title: householdDetail.fullName
		});
	};

	onMount(async () => {
		const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
		if (!apiKey) {
			showToast(toastStore, 'Google Maps API key is missing', false);
			return;
		}

		try {
			await loadGoogleMaps(apiKey);
			initMap();
		} catch (error) {
			showToast(toastStore, 'Failed to load Google Maps', false);
			console.error(error);
		}
	});
</script>

<div class="card p-4">
	<header class="card-header">
		<h1 class="h1">Household Details</h1>
	</header>

	<section class="p-4">
		<!-- Map Section -->
		<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden">
			<div id="household-map" class="h-[300px] w-full"></div>
		</div>

		<!-- Details Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Household Information -->
			<div class="card p-4">
				<h2 class="h3 mb-4">Head of Household</h2>
				<div class="space-y-2">
					<div>
						<span class="font-bold">Full Name:</span>
						<span>{householdDetail.fullName}</span>
					</div>
					<div>
						<span class="font-bold">Gender:</span>
						<span>{householdDetail.gender}</span>
					</div>
					<div>
						<span class="font-bold">Date of Birth:</span>
						<span>{householdDetail.dateOfBirth}</span>
					</div>
					<div>
						<span class="font-bold">Age:</span>
						<span>{calculateAge(householdDetail.dateOfBirth)}</span>
					</div>
					<div>
						<span class="font-bold">Phone:</span>
						<span>{householdDetail.phone}</span>
					</div>
					<div>
						<span class="font-bold">Voter Status:</span>
						<span>{householdDetail.isVoter ? 'Registered Voter' : 'Not Registered'}</span>
					</div>
				</div>
			</div>

			<!-- Location Information -->
			<div class="card p-4">
				<h2 class="h3 mb-4">Location Details</h2>
				<div class="space-y-2">
					<div>
						<span class="font-bold">Coordinates:</span>
						<span>{householdDetail.latitude}, {householdDetail.longitude}</span>
					</div>
					<div>
						<span class="font-bold">Created:</span>
						<span>{new Date(householdDetail.createdAt).toLocaleDateString()}</span>
					</div>
					<div>
						<span class="font-bold">Last Updated:</span>
						<span>{new Date(householdDetail.updatedAt).toLocaleDateString()}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Dependents Section -->
		{#if householdDetail.dependentDetails?.length > 0}
			<div class="mt-6">
				<h2 class="h3 mb-4">Dependents ({householdDetail.dependents})</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					{#each householdDetail.dependentDetails as dependent}
						<div class="card p-4">
							<h3 class="h4 mb-2">{dependent.fullName}</h3>
							<div class="space-y-2">
								<div>
									<span class="font-bold">Gender:</span>
									<span>{dependent.gender}</span>
								</div>
								<div>
									<span class="font-bold">Date of Birth:</span>
									<span>{dependent.dateOfBirth}</span>
								</div>
								<div>
									<span class="font-bold">Age:</span>
									<span>{calculateAge(dependent.dateOfBirth)}</span>
								</div>
								<div>
									<span class="font-bold">Voter Status:</span>
									<span>{dependent.isVoter ? 'Registered Voter' : 'Not Registered'}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<footer class="card-footer flex justify-end border-t-2 p-4">
		<div class="btn-group variant-filled">
			<button type="button" on:click={() => drawerStore.open(drawerUpdate)}>Edit</button>
			<button type="button" on:click={() => window.history.back()}>Close</button>
		</div>
	</footer>
</div>

<Drawer>
	{#if $drawerStore.id === 'updateHousehold'}
		<Update data={householdDetail} barangay={{ _id: householdDetail.barangayId }} {drawerStore} />
	{/if}
</Drawer>
