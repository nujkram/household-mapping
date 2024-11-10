<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import type { Barangay } from '$lib/utils/types';
	import { barangayStore } from '$lib/stores/barangayStore';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';

	export let drawerStore: DrawerStore;
	export let data: Barangay;
	const isFocused: boolean = true;

	let map: google.maps.Map;
	let marker: google.maps.marker.AdvancedMarkerElement;

	// toast settings
	const toastStore = getToastStore();

	onMount(async () => {
		const initMap = (): void => {
			const barangayLocation = {
				lat: Number.parseFloat(data.latitude),
				lng: Number.parseFloat(data.longitude)
			};

			map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
				center: barangayLocation,
				zoom: 13,
				mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
			});

			marker = new google.maps.marker.AdvancedMarkerElement({
				position: barangayLocation,
				map,
				gmpDraggable: true
			});

			google.maps.event.addListener(marker, 'dragend', () => {
				const position = marker.getPosition();
				if (position) {
					data.latitude = position.lat().toString();
					data.longitude = position.lng().toString();
				}
			});

			map.addListener('click', (event: google.maps.MapMouseEvent) => {
				marker.setPosition(event.latLng);
				if (event.latLng) {
					data.latitude = event.latLng.lat().toString();
					data.longitude = event.latLng.lng().toString();
				}
			});
		};

		const apiKey: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
		if (!apiKey) {
			showToast(toastStore, 'Google Maps API key is missing. Please check your .env file.', false);
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

<form
	method="POST"
	autocomplete="off"
	class="p-6 space-y-4"
	use:focusTrap={isFocused}
	on:submit|preventDefault={async () => {
		try {
			const response = await fetch('/api/admin/barangay/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					_id: data._id,
					name: data.name,
					lastName: data.lastName,
					middleName: data.middleName,
					firstName: data.firstName,
					phone: data.phone,
					latitude: data.latitude,
					longitude: data.longitude
				})
			});

			const result = await response.json();

			showToast(toastStore, result.message, true);
			barangayStore.refresh();
			drawerStore.close();
		} catch (error) {
			showToast(toastStore, error.message, false);
			console.error(error);
		}
	}}
>
	<h2 class="h4">Update Barangay {data.name}</h2>

	<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden mt-4">
		<div id="map" class="h-[300px] w-full"></div>
	</div>

	<label class="label">
		<span>Name</span>
		<input
			class="input"
			type="text"
			placeholder="Name"
			name="name"
			bind:value={data.name}
			required
		/>
	</label>

	<label class="label">
		<span>First Name</span>
		<input
			class="input"
			type="text"
			placeholder="Juan"
			name="firstName"
			bind:value={data.firstName}
			required
		/>
	</label>

	<label class="label">
		<span>Middle Name</span>
		<input
			class="input"
			type="text"
			placeholder="Alfon"
			name="middleName"
			bind:value={data.middleName}
			required
		/>
	</label>

	<label class="label">
		<span>Last Name</span>
		<input
			class="input"
			type="text"
			placeholder="Dela Cruz"
			name="lastName"
			bind:value={data.lastName}
			required
		/>
	</label>

	<label class="label">
		<span>Phone</span>
		<input
			class="input"
			type="text"
			placeholder="09171234567"
			name="phone"
			bind:value={data.phone}
			required
		/>
	</label>

	<label class="hidden label">
		<span>Latitude</span>
		<input class="input" type="text" name="latitude" bind:value={data.latitude} readonly required />
	</label>

	<label class="hidden label">
		<span>Longitude</span>
		<input
			class="input"
			type="text"
			name="longitude"
			bind:value={data.longitude}
			readonly
			required
		/>
	</label>

	<div class="flex flex-row gap-2 items-center justify-end mt-4">
		<button
			type="submit"
			class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
		>
			Update
		</button>
		<button
			type="button"
			class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
			on:click={() => drawerStore.close()}
		>
			Cancel
		</button>
	</div>
</form>
