<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { barangayStore } from '$lib/stores/barangayStore';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';

	export let drawerStore: DrawerStore;

	const isFocused = true;
	let name: string;
	let lastName: string;
	let middleName: string;
	let firstName: string;
	let phone: string;
	let latitude: string;
	let longitude: string;

	let map: google.maps.Map;
	let marker: google.maps.marker.AdvancedMarkerElement;

	// toast settings
	const toastStore = getToastStore();

	onMount(async () => {
		const initMap = (): void => {
			const defaultLocation = { lat: 11.442339253918387, lng: 122.69376754760742 };
			map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
				center: defaultLocation,
				zoom: 13,
				mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
			});

			marker = new google.maps.marker.AdvancedMarkerElement({
				position: defaultLocation,
				map,
				gmpDraggable: true
			});

			google.maps.event.addListener(marker, 'dragend', () => {
				const position = marker.getPosition();
				if (position) {
					latitude = position.lat().toString();
					longitude = position.lng().toString();
				}
			});

			map.addListener('click', (event: google.maps.MapMouseEvent) => {
				marker.setPosition(event.latLng);
				if (event.latLng) {
					latitude = event.latLng.lat().toString();
					longitude = event.latLng.lng().toString();
				}
			});
		};

		const apiKey: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
		if (!apiKey) {
			showToast(toastStore, 'Google Maps API key is missing. Please check your .env file.', true);
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

	// ... rest of the script ...
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6 space-y-4"
	use:focusTrap={isFocused}
	on:submit|preventDefault={async (event) => {
		try {
			const response = await fetch('/api/admin/barangay/insert', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name,
					lastName,
					middleName,
					firstName,
					phone,
					latitude,
					longitude
				})
			});

			const result = await response.json();
			await barangayStore.refresh();

			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(toastStore, error.message, false);
			console.error(error);
		}
	}}
>
	<h2 class="text-2xl font-bold mb-4">Create Barangay</h2>

	<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden">
		<div id="map" class="h-[300px] w-full"></div>
	</div>

	<label class="label">
		<span>Name</span>
		<input
			class="input"
			type="text"
			placeholder="Barangay Name"
			name="name"
			bind:value={name}
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
			bind:value={firstName}
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
			bind:value={middleName}
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
			bind:value={lastName}
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
			bind:value={phone}
			required
		/>
	</label>

	<label class="hidden label">
		<span>Latitude</span>
		<input class="input" type="text" name="latitude" bind:value={latitude} readonly required />
	</label>

	<label class="hidden label">
		<span>Longitude</span>
		<input class="input" type="text" name="longitude" bind:value={longitude} readonly required />
	</label>

	<div class="flex justify-end space-x-4">
		<button
			type="submit"
			class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
		>
			Submit
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
