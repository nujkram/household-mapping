<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import type { Barangay, Household, Dependents } from '$lib/utils/types';
	import { barangayStore } from '$lib/stores/barangayStore';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { id } from '$lib/common/utils';
	import { householdStore } from '$lib/stores/householdStore';

	export let drawerStore: DrawerStore;
	export let data: Household;
	export let barangay: Barangay;

	const isFocused = true;
	let isLoading = true;
	let isInitializing = true;
	let barangays: Barangay[] = [];
	let dependentFields: Dependents[] = data.dependentDetails || [];
	let map: google.maps.Map;
	let marker: google.maps.Marker;
	let householdsForDependents: Household[] = [];
	let searchQuery = '';
	let filteredHouseholds: Household[] = [];
	let selectedHouseholdId = '';

	// toast settings
	const toastStore = getToastStore();

	onMount(async () => {
		isInitializing = true;
		try {
			const apiKey: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
			if (!apiKey) {
				throw new Error('Google Maps API key is missing. Please check your .env file.');
			}

			// Load all data in parallel for better performance
			const [mapLoaded, barangayResponse] = await Promise.all([
				loadGoogleMaps(apiKey),
				fetch('/api/admin/barangay', {
					method: 'GET',
					headers: { 'Content-Type': 'application/json' }
				})
			]);

			const barangayData = await barangayResponse.json();
			barangays = barangayData.response;

			initMap();
			await fetchHouseholdsForDependents();
		} catch (error: unknown) {
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'An unknown error occurred',
				false
			);
			console.error(error);
		} finally {
			isInitializing = false;
			isLoading = false;
		}
	});

	const initMap = (): void => {
		// Default location (center of Philippines)
		const defaultLocation = { lat: 11.442339253918387, lng: 122.69376754760742 };

		// Try to get coordinates from data first
		let location = defaultLocation;

		try {
			const lat = Number.parseFloat(data.latitude);
			const lng = Number.parseFloat(data.longitude);

			if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
				location = { lat, lng };
			} else {
				// Try barangay coordinates as fallback
				const barangayLat = Number.parseFloat(barangay.latitude);
				const barangayLng = Number.parseFloat(barangay.longitude);

				if (
					!Number.isNaN(barangayLat) &&
					!Number.isNaN(barangayLng) &&
					Math.abs(barangayLat) <= 90 &&
					Math.abs(barangayLng) <= 180
				) {
					location = { lat: barangayLat, lng: barangayLng };
				}
			}
		} catch (error) {
			console.warn('Error parsing coordinates, using default location:', error);
		}

		// Set initial latitude and longitude values
		data.latitude = location.lat.toString();
		data.longitude = location.lng.toString();

		map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
			center: location,
			zoom: 13,
			mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
		});

		marker = new google.maps.Marker({
			map,
			position: location,
			draggable: true
		});

		marker.addListener('dragend', () => {
			const position = marker.getPosition();
			if (position) {
				data.latitude = position.lat().toString();
				data.longitude = position.lng().toString();
			}
		});

		map.addListener('click', (event: google.maps.MapMouseEvent) => {
			if (event.latLng) {
				marker.setPosition(event.latLng);
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

	const filterHouseholds = (query: string) => {
		if (!query?.trim()) {
			filteredHouseholds = [];
			return;
		}

		const searchTerm = query.toLowerCase();
		filteredHouseholds = householdsForDependents
			.filter(
				(h) =>
					h.fullName.toLowerCase().includes(searchTerm) ||
					h.firstName.toLowerCase().includes(searchTerm) ||
					h.lastName.toLowerCase().includes(searchTerm)
			)
			.slice(0, 5); // Limit to 5 results
	};

	const applyHouseholdToDependent = (household: Household, dependentIndex: number) => {
		// Apply to the specified dependent
		const dependent = dependentFields[dependentIndex];
		if (dependent) {
			dependent.linkedHouseholdId = household._id;
			dependent.firstName = household.firstName;
			dependent.middleName = household.middleName;
			dependent.lastName = household.lastName;
			dependent.fullName = household.fullName;
			dependent.dateOfBirth = household.dateOfBirth;
			dependent.gender = household.gender;
			dependent.isVoter = household.isVoter;
		}
		// Clear the search
		searchQuery = '';
		filteredHouseholds = [];
	};

	const clearHouseholdLink = (dependentIndex: number) => {
		const dependent = dependentFields[dependentIndex];
		if (dependent) {
			// Clear all fields
			dependent.linkedHouseholdId = '';
			dependent.firstName = '';
			dependent.middleName = '';
			dependent.lastName = '';
			dependent.fullName = '';
			dependent.dateOfBirth = '';
			dependent.gender = 'MALE';
			dependent.isVoter = false;
			
			// Force Svelte to update the array by creating a new reference
			dependentFields = [...dependentFields];
		}
	};

	$: {
		if (data.dependents) {
			const newLength = Number.parseInt(data.dependents.toString());

			// If we need more fields
			while (dependentFields.length < newLength) {
				dependentFields = [
					...dependentFields,
					{
						_id: id(),
						householdId: data._id,
						linkedHouseholdId: '',
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

	const fetchHouseholdsForDependents = async () => {
		try {
			const response = await fetch(`/api/admin/household/list/${barangay._id}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const result = await response.json();
			// Filter out the current household and format the data
			householdsForDependents = result.response
				.filter((h: Household) => h._id !== data._id)
				.map((h: Household) => ({
					...h,
					fullNameWithId: `${h.fullName} (${h._id})`
				}));
		} catch (error) {
			showToast(toastStore, 'Failed to load households', false);
			console.error(error);
		}
	};
</script>

<!-- Add loading overlay -->
{#if isInitializing}
	<div class="fixed inset-0 bg-surface-100-800-token/50 flex items-center justify-center z-50">
		<div class="card p-4 space-y-4">
			<div class="flex items-center space-x-4">
				<div class="spinner-border" />
				<p>Loading household data...</p>
			</div>
		</div>
	</div>
{/if}

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
					longitude: data.longitude,
					tag: data.tag
				})
			});

			const result = await response.json();

			if (response.ok) {
				// First refresh the stores
				await barangayStore.refresh();
				await householdStore.refresh();

				showToast(toastStore, result.message, true);
				drawerStore.close();
			} else {
				throw new Error(result.error || 'Failed to update household');
			}
		} catch (error) {
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'An unknown error occurred',
				false
			);
			console.error(error);
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
			<input class="input" type="date" name="dateOfBirth" bind:value={data.dateOfBirth} />
		</label>

		<label class="label flex items-center gap-2">
			<span>Is Voter</span>
			<input class="input w-4" type="checkbox" name="isVoter" bind:checked={data.isVoter} />
		</label>

		<label class="label">
			<span>Tag</span>
			<select class="select" bind:value={data.tag}>
				<option value="UNTAGGED">UNTAGGED</option>
				<option value="APIN">APIN</option>
				<option value="KONTRA">KONTRA</option>
			</select>
		</label>

		<label class="label">
			<span>Dependents</span>
			<input class="input" type="number" name="dependents" bind:value={data.dependents} />
		</label>

		{#if dependentFields.length > 0}
			<div class="col-span-2 space-y-4">
				<h3 class="h3 mb-4">Dependent Details</h3>
				{#each dependentFields as dependent, index}
					<div class="card p-4 mb-4">
						<h4 class="h4 mb-2">Dependent {index + 1}</h4>
						<div class="label col-span-2 relative mb-4">
							<span>Link to Existing Household (Optional)</span>
							{#if dependent.linkedHouseholdId}
								<div class="flex items-center gap-2 mt-2">
									<span class="text-sm">Linked to: {dependent.fullName}</span>
									<button
										type="button"
										class="btn btn-sm variant-filled-error"
										on:click={() => clearHouseholdLink(index)}
									>
										Clear Link
									</button>
								</div>
							{:else}
								<input
									class="input"
									type="text"
									placeholder="Search for household..."
									on:input={(e) => filterHouseholds(e.target.value)}
								/>

								{#if filteredHouseholds.length > 0}
									<div
										class="absolute z-50 w-full bg-surface-100-800-token border border-surface-500-400-token rounded-md mt-1 max-h-48 overflow-y-auto"
									>
										{#each filteredHouseholds as household}
											<button
												class="w-full text-left px-4 py-2 hover:bg-surface-hover-token"
												type="button"
												on:click={() => applyHouseholdToDependent(household, index)}
											>
												{household.fullName}
											</button>
										{/each}
									</div>
								{/if}
							{/if}
						</div>

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

<style>
	.spinner-border {
		width: 2rem;
		height: 2rem;
		border: 0.25em solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spinner-border 0.75s linear infinite;
	}

	@keyframes spinner-border {
		to {
			transform: rotate(360deg);
		}
	}
</style>
