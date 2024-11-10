<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { barangayStore } from '$lib/stores/barangayStore';
	import type { Barangay } from '$lib/utils/types';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';

	export let drawerStore: DrawerStore;
	export let data: Barangay;

	const isFocused = true;
	let lastName: string;
	let middleName: string;
	let firstName: string;
	let gender: string;
	let dateOfBirth: Date;
	let phone: string;
	let dependents: number;
	let latitude: string;
	let longitude: string;

	let barangays: Barangay[] = [];

	let map: google.maps.Map;
	let marker: google.maps.marker.AdvancedMarkerElement;

	// toast settings
	const toastStore = getToastStore();

	onMount(async () => {
		const apiKey: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
		if (!apiKey) {
			const mapError = 'Google Maps API key is missing. Please check your .env file.';
			showToast(toastStore, mapError, true);
			return;
		}

		try {
			await loadGoogleMaps(apiKey);
			initMap();

			const response = await fetch('/api/admin/barangay', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const result = await response.json();
			barangays = result.response;
		} catch (error) {
			showToast(toastStore, 'Failed to load Google Maps', false);
			console.error(error);
		}
	});

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
			map,
			position: barangayLocation,
			gmpDraggable: true
		});

		marker.addListener('dragend', () => {
			const position = marker.position as google.maps.LatLng;
			if (position) {
				latitude = position.lat().toString();
				longitude = position.lng().toString();
			}
		});

		map.addListener('click', (event: google.maps.MapMouseEvent) => {
			if (event.latLng) {
				marker.position = event.latLng;
				latitude = event.latLng.lat().toString();
				longitude = event.latLng.lng().toString();
			}
		});
	};
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6 space-y-4"
	use:focusTrap={isFocused}
	on:submit|preventDefault={async (event) => {
		try {
			const response = await fetch('/api/admin/household/insert', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					barangayId: data._id,
					lastName,
					middleName,
					firstName,
					gender,
					dateOfBirth,
					phone,
					dependents,
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
	<h2 class="text-2xl font-bold mb-4">Create Household</h2>

	<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden">
		<div id="map" class="h-[300px] w-full"></div>
	</div>

	<div class="grid grid-cols-2 gap-2">
		<label class="label">
			<span>Barangay</span>
			<select class="select" bind:value={data._id}>
				{#each barangays as barangay}
					<option value={barangay._id}>{barangay.name}</option>
				{/each}
			</select>
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

		<label class="label">
			<span>Gender</span>
			<select class="select" bind:value={gender}>
				<option value="male">Male</option>
				<option value="female">Female</option>
			</select>
		</label>

		<label class="label">
			<span>Date of Birth</span>
			<input class="input" type="date" name="dateOfBirth" bind:value={dateOfBirth} required />
		</label>

		<label class="label">
			<span>Dependents</span>
			<input class="input" type="number" name="dependents" bind:value={dependents} required />
		</label>
	</div>

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
