<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { barangayStore } from '$lib/stores/barangayStore';
	import type { Barangay, Dependents } from '$lib/utils/types';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { id } from '$lib/common/utils';

	export let drawerStore: DrawerStore;
	export let data: Barangay;

	const isFocused = true;
	let lastName: string;
	let middleName: string;
	let firstName: string;
	let gender: string = 'MALE';
	let dateOfBirth: Date;
	let phone: string;
	let isVoter: boolean = false;
	let dependents: number = 0;
	let latitude: string;
	let longitude: string;

	let barangays: Barangay[] = [];
	let dependentFields: Dependents[] = [];

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
		// Ensure we have valid coordinates from the barangay data
		let lat = Number.parseFloat(data.latitude);
		let lng = Number.parseFloat(data.longitude);

		if (isNaN(lat) || isNaN(lng)) {
			console.warn('Invalid barangay coordinates:', data);
			lat = 11.442339253918387;
			lng = 122.69376754760742;
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
		latitude = lat.toString();
		longitude = lng.toString();

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
		if (dependents) {
			const newLength = Number.parseInt(dependents.toString());

			// If we need more fields
			while (dependentFields.length < newLength) {
				dependentFields = [
					...dependentFields,
					{
						_id: id(),
						householdId: '', // Will be set after household creation
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
					isVoter,
					dependents,
					dependentDetails: dependentFields,
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
				<option value="MALE">Male</option>
				<option value="FEMALE">Female</option>
			</select>
		</label>

		<label class="label">
			<span>Date of Birth</span>
			<input class="input" type="date" name="dateOfBirth" bind:value={dateOfBirth} required />
		</label>

		<label class="label flex items-center gap-2">
			<span>Is Voter</span>
			<input class="input w-4" type="checkbox" name="isVoter" bind:checked={isVoter} />
		</label>

		<label class="label">
			<span>Dependents</span>
			<input class="input" type="number" name="dependents" bind:value={dependents} required />
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
									on:input={() => updateDependentFullName(dependent, index)}
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
									on:input={() => updateDependentFullName(dependent, index)}
								/>
							</label>

							<label class="label">
								<span>Last Name</span>
								<input
									class="input"
									type="text"
									placeholder="Last Name"
									bind:value={dependent.lastName}
									on:input={() => updateDependentFullName(dependent, index)}
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
