<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import type { Barangay, Household, Dependents } from '$lib/utils/types';
	import { barangayStore } from '$lib/stores/barangayStore';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import DependentFields from './DependentFields.svelte';
	import SurveyFields from './SurveyFields.svelte';
	import { surveyFrom, emptySurvey } from '$lib/utils/householdOptions';
	import { canTagHouseholds } from '$lib/utils/roles';
	import { psgcCodesForName } from '$lib/utils/psgc';
	import { page } from '$app/stores';

	export let drawerStore: DrawerStore;
	export let data: Household;
	export let barangay: Barangay;
	/** Called after a successful update so the parent page can refresh its list. */
	export let onSuccess: (() => void) | undefined = undefined;

	// Only administrators may set the political tag.
	$: canTag = canTagHouseholds($page.data.user?.role);

	const isFocused = true;
	let isSubmitting = false;
	let isLoading = true;
	let isInitializing = true;
	// Optional census-style survey fields, prefilled from the record.
	const survey = surveyFrom(data as unknown as Record<string, unknown>);
	let barangays: Barangay[] = [];

	// Human-readable household code: <barangayCode>-<number>. Prefill the number
	// from the stored code (the part after the barangay-code prefix); the prefix
	// tracks whichever barangay is currently selected.
	let householdNumber = (data.householdCode || '').includes('-')
		? (data.householdCode || '').slice((data.householdCode || '').indexOf('-') + 1)
		: '';
	$: selectedBarangay = barangays.find((b) => b._id === barangay._id) ?? barangay;
	$: barangayCodePrefix =
		selectedBarangay?.barangayCode || psgcCodesForName(selectedBarangay?.name).barangayCode || '';
	// With a prefix: compose (or blank, if the number was cleared). Without one
	// (barangay has no derivable code) keep the stored code rather than wipe it.
	$: householdCode = barangayCodePrefix
		? householdNumber.trim()
			? `${barangayCodePrefix}-${householdNumber.trim()}`
			: ''
		: data.householdCode || '';
	// Seed survey defaults so every dependent has all optional keys bound.
	let dependentFields: Dependents[] = (data.dependentDetails || []).map((d) => ({
		...emptySurvey(),
		...d
	}));
	let map: google.maps.Map;
	let marker: google.maps.Marker;
	let householdsForDependents: Household[] = [];

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
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const response = await fetch('/api/admin/household/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					_id: data._id,
					barangayId: barangay._id,
					householdCode,
					lastName: data.lastName,
					middleName: data.middleName,
					firstName: data.firstName,
					gender: data.gender,
					dateOfBirth: data.dateOfBirth,
					phone: data.phone,
					isVoter: data.isVoter,
					dependents: dependentFields.length,
					dependentDetails: dependentFields,
					latitude: data.latitude,
					longitude: data.longitude,
					tag: data.tag,
					// Optimistic concurrency token — the version we loaded.
					expectedUpdatedAt: data.updatedAt,
					...survey
				})
			});

			const result = await response.json();

			if (response.ok) {
				// Refresh the barangay store (used by the barangay detail pages) and
				// let the parent page refresh its own list.
				await barangayStore.refresh();
				onSuccess?.();

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
		} finally {
			isSubmitting = false;
		}
	}}
>
	<h2 class="h3 mb-1">Update Household</h2>
	<p class="text-sm opacity-60 mb-4">Edit the head of the family and the household members.</p>

	<!-- 1. Household & Location -->
	<section class="card p-4 space-y-3">
		<h3 class="h4">Household &amp; Location</h3>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<label class="label">
				<span>Barangay</span>
				<select class="select" bind:value={barangay._id}>
					{#each barangays as b}
						<option value={b._id}>{b.name}</option>
					{/each}
				</select>
			</label>
			{#if canTag}
				<label class="label">
					<span>Tag</span>
					<select class="select" bind:value={data.tag}>
						<option value="UNTAGGED">UNTAGGED</option>
						<option value="APIN">APIN</option>
						<option value="KONTRA">KONTRA</option>
					</select>
				</label>
			{/if}
		</div>
		<label class="label">
			<span>Household Code</span>
			<div class="input-group input-group-divider grid-cols-[auto_1fr]">
				<div class="input-group-shim font-mono">
					{barangayCodePrefix ? `${barangayCodePrefix}-` : '—'}
				</div>
				<input
					type="text"
					inputmode="numeric"
					placeholder="e.g. 05"
					bind:value={householdNumber}
					disabled={!barangayCodePrefix}
				/>
			</div>
			<span class="text-xs opacity-60">
				{#if !barangayCodePrefix}
					Select a barangay with a PSGC code to enable the household code.
				{:else if householdCode}
					Will be saved as <span class="font-mono">{householdCode}</span>.
				{:else}
					Enter the household number to complete the code.
				{/if}
			</span>
		</label>
		<div>
			<span class="text-sm opacity-70">Tap the map to move the pin, or drag it.</span>
			<div class="mt-1 border border-surface-500-400-token rounded-lg overflow-hidden">
				<div id="map" class="h-[300px] w-full"></div>
			</div>
		</div>
	</section>

	<!-- 2. Head of the family -->
	<section class="card p-4 space-y-3">
		<h3 class="h4">Head of the Family</h3>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<label class="label">
				<span>First Name</span>
				<input class="input" type="text" placeholder="Juan" bind:value={data.firstName} required />
			</label>
			<label class="label">
				<span>Middle Name</span>
				<input class="input" type="text" placeholder="Alfon" bind:value={data.middleName} />
			</label>
			<label class="label">
				<span>Last Name</span>
				<input class="input" type="text" placeholder="Dela Cruz" bind:value={data.lastName} required />
			</label>
			<label class="label">
				<span>Phone</span>
				<input class="input" type="text" placeholder="09171234567" bind:value={data.phone} />
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
				<input class="input" type="date" bind:value={data.dateOfBirth} />
			</label>
			<label class="label flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={data.isVoter} />
				<span>Registered voter</span>
			</label>
		</div>
	</section>

	<!-- 3. Members -->
	<section class="card p-4">
		<DependentFields bind:dependentFields households={householdsForDependents} />
	</section>

	<!-- 4. Optional census details -->
	<section class="card p-4">
		<SurveyFields {survey} />
	</section>

	<!-- Coordinates captured by the map (hidden). -->
	<input type="hidden" bind:value={data.latitude} />
	<input type="hidden" bind:value={data.longitude} />

	<div class="flex justify-end gap-3 pt-2">
		<button type="button" class="btn variant-soft" on:click={() => drawerStore.close()}>
			Cancel
		</button>
		<button type="submit" class="btn variant-filled-success" disabled={isSubmitting}>
			{isSubmitting ? 'Updating...' : 'Update Household'}
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
