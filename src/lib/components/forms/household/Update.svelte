<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import type { Barangay, Household, Dependents } from '$lib/utils/types';
	import { barangayStore } from '$lib/stores/barangayStore';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { id } from '$lib/common/utils';

	export let drawerStore: DrawerStore;
	export let data: Household;
	export let barangay: Barangay;

	const isFocused = true;
	let barangays: Barangay[] = [];
	let dependentFields: Dependents[] = data.dependentDetails || [];
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
		// Ensure we have valid coordinates
		let lat = Number.parseFloat(data.latitude);
		let lng = Number.parseFloat(data.longitude);

		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			console.warn('Invalid household coordinates:', data);
			// Use barangay coordinates as fallback
			lat = Number.parseFloat(barangay.latitude);
			lng = Number.parseFloat(barangay.longitude);
		}

		const location = { lat, lng };

		map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
			center: location,
			zoom: 13,
			mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
		});

		marker = new google.maps.marker.AdvancedMarkerElement({
			map,
			position: location,
			gmpDraggable: true
		});

		// Set initial latitude and longitude values
		data.latitude = lat.toString();
		data.longitude = lng.toString();

		marker.addListener('dragend', () => {
			const position = marker.position as google.maps.LatLng;
			if (position) {
				data.latitude = position.lat().toString();
				data.longitude = position.lng().toString();
			}
		});

		map.addListener('click', (event: google.maps.MapMouseEvent) => {
			if (event.latLng) {
				marker.position = event.latLng;
				data.latitude = event.latLng.lat().toString();
				data.longitude = event.latLng.lng().toString();
			}
		});
	};

	const updateDependentFullName = (dependent: Dependents, index: number) => {
		// Convert names to uppercase
		dependent.firstName = dependent.firstName.toUpperCase();
		dependent.middleName = dependent.middleName?.toUpperCase() || '';
		dependent.lastName = dependent.lastName.toUpperCase();
		dependent.fullName = `${dependent.firstName} ${dependent.middleName} ${dependent.lastName}`
			.trim()
			.toUpperCase();
	};

	$: {
		// Reset and regenerate dependent fields when dependents number changes
		if (data.dependents) {
			const newLength = Number.parseInt(data.dependents.toString());

			// If we need more fields
			while (dependentFields.length < newLength) {
				dependentFields = [
					...dependentFields,
					{
						_id: id(),
						householdId: data._id,
						firstName: '',
						middleName: '',
						lastName: '',
						fullName: '',
						dateOfBirth: '',
						gender: 'MALE',
						isVoter: false
					}
				];
			}

			// If we need fewer fields
			if (dependentFields.length > newLength) {
				dependentFields = dependentFields.slice(0, newLength);
			}
		}
	}
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6 space-y-4"
	use:focusTrap={isFocused}
	on:submit|preventDefault={async () => {
		try {
			const response = await fetch('/api/admin/household/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					_id: data._id,
					barangayId: barangay._id,
					lastName: data.lastName,
					middleName: data.middleName,
					firstName: data.firstName,
					gender: data.gender,
					dateOfBirth: data.dateOfBirth,
					phone: data.phone,
					isVoter: data.isVoter,
					dependents: data.dependents,
					dependentDetails: dependentFields,
					latitude: data.latitude,
					longitude: data.longitude
				})
			});

			const result = await response.json();

			// First refresh the store to get updated data with households
			await barangayStore.refresh();

			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			const err = error;
			showToast(toastStore, err.message, false);
			console.error(err);
		}
	}}
>
	<h2 class="text-2xl font-bold mb-4">Update Household</h2>

	<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden">
		<div id="map" class="h-[300px] w-full"></div>
	</div>

	<div class="grid grid-cols-2 gap-2">
		<label class="label">
			<span>Barangay</span>
			<select class="select" bind:value={barangay._id}>
				{#each barangays as b}
					<option value={b._id}>{b.name}</option>
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

		<label class="label">
			<span>Gender</span>
			<select class="select" bind:value={data.gender}>
				<option value="MALE">Male</option>
				<option value="FEMALE">Female</option>
			</select>
		</label>

		<label class="label">
			<span>Date of Birth</span>
			<input class="input" type="date" name="dateOfBirth" bind:value={data.dateOfBirth} required />
		</label>

		<label class="label flex items-center gap-2">
			<span>Is Voter</span>
			<input class="input w-4" type="checkbox" name="isVoter" bind:checked={data.isVoter} />
		</label>

		<label class="label">
			<span>Dependents</span>
			<input class="input" type="number" name="dependents" bind:value={data.dependents} required />
		</label>

		{#if dependentFields.length > 0}
			<div class="col-span-2">
				<h3 class="h3 mb-4">Dependent Details</h3>
				{#each dependentFields as dependent, index}
					<div class="card p-4 mb-4">
						<h4 class="h4 mb-2">Dependent {index + 1}</h4>
						<div class="grid grid-cols-2 gap-2">
							<label class="label">
								<span>First Name</span>
								<input
									class="input"
									type="text"
									placeholder="First Name"
									bind:value={dependent.firstName}
									on:change={() => updateDependentFullName(dependent, index)}
									required
								/>
							</label>

							<label class="label">
								<span>Middle Name</span>
								<input
									class="input"
									type="text"
									placeholder="Middle Name"
									bind:value={dependent.middleName}
									on:change={() => updateDependentFullName(dependent, index)}
								/>
							</label>

							<label class="label">
								<span>Last Name</span>
								<input
									class="input"
									type="text"
									placeholder="Last Name"
									bind:value={dependent.lastName}
									on:change={() => updateDependentFullName(dependent, index)}
									required
								/>
							</label>

							<label class="label">
								<span>Gender</span>
								<select class="select" bind:value={dependent.gender}>
									<option value="MALE">Male</option>
									<option value="FEMALE">Female</option>
								</select>
							</label>

							<label class="label">
								<span>Date of Birth</span>
								<input class="input" type="date" bind:value={dependent.dateOfBirth} required />
							</label>

							<label class="label flex items-center gap-2">
								<span>Is Voter</span>
								<input class="input w-4" type="checkbox" bind:checked={dependent.isVoter} />
							</label>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

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

	<div class="flex justify-end space-x-4">
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
