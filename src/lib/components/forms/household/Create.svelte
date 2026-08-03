<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { submitJson } from '$lib/utils/apiHelper';
	import { barangayStore } from '$lib/stores/barangayStore';
	import type { Barangay, Dependents, Household } from '$lib/utils/types';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import DependentFields from './DependentFields.svelte';
	import SurveyFields from './SurveyFields.svelte';
	import { emptySurvey } from '$lib/utils/householdOptions';
	import { psgcCodesForName } from '$lib/utils/psgc';

	export let drawerStore: DrawerStore;
	export let data: Barangay;
	/** Called after a successful insert so the parent page can refresh its list. */
	export let onSuccess: (() => void) | undefined = undefined;

	const isFocused = true;
	let isSubmitting = false;
	let lastName: string;
	let middleName: string;
	let firstName: string;
	let gender: string = 'MALE';
	let dateOfBirth: Date;
	let phone: string;
	let isVoter: boolean = false;
	let latitude: string;
	let longitude: string;

	let barangays: Barangay[] = [];
	let dependentFields: Dependents[] = [];
	let householdsForDependents: Household[] = [];
	// Optional census-style survey fields.
	const survey = emptySurvey();

	// Human-readable household code: <barangayCode>-<number>. The prefix comes
	// from the selected barangay; the number is typed manually.
	let householdNumber = '';
	$: selectedBarangay = barangays.find((b) => b._id === data._id) ?? data;
	$: barangayCodePrefix =
		selectedBarangay?.barangayCode || psgcCodesForName(selectedBarangay?.name).barangayCode || '';
	$: householdCode =
		barangayCodePrefix && householdNumber.trim()
			? `${barangayCodePrefix}-${householdNumber.trim()}`
			: '';

	// Warn (don't block) when the head-of-family name already exists in the
	// selected barangay — likely a re-entry. The encoder confirms to override.
	const sameName = (a?: string | null, b?: string | null) =>
		(a || '').trim().toUpperCase() === (b || '').trim().toUpperCase();
	let ackDuplicate = false;
	$: dupMatches =
		firstName?.trim() && lastName?.trim()
			? householdsForDependents.filter(
					(h) => sameName(h.firstName, firstName) && sameName(h.lastName, lastName)
				)
			: [];

	let map: google.maps.Map;
	let marker: google.maps.marker.AdvancedMarkerElement;

	// toast settings
	const toastStore = getToastStore();

	// Households in the selected barangay that a dependent can be linked to.
	const fetchHouseholdsForDependents = async (barangayId: string) => {
		if (!barangayId) return;
		try {
			const response = await fetch(`/api/admin/household/list/${barangayId}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			const result = await response.json();
			householdsForDependents = result.response || [];
		} catch (error) {
			console.error('Failed to load households for linking:', error);
			householdsForDependents = [];
		}
	};

	onMount(async () => {
		// Barangays (the dropdown) + linkable households are the critical data —
		// load them independently so a Google Maps failure can't blank the form.
		try {
			const response = await fetch('/api/admin/barangay', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			const result = await response.json();
			barangays = result.response ?? [];
			await fetchHouseholdsForDependents(data._id);
		} catch (error) {
			showToast(toastStore, 'Failed to load barangays', false);
			console.error(error);
		}

		// The location map is secondary; its failure must not break data entry.
		const apiKey: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
		if (!apiKey) {
			showToast(toastStore, 'Map unavailable: Google Maps API key is missing.', false);
			return;
		}
		try {
			await loadGoogleMaps(apiKey, ['marker']);
			initMap();
		} catch (error) {
			showToast(toastStore, 'The location map could not be loaded.', false);
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

</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6 space-y-4"
	use:focusTrap={isFocused}
	on:submit|preventDefault={async () => {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const result = await submitJson('/api/admin/household/insert', {
				barangayId: data._id,
				householdCode,
				lastName,
				middleName,
				firstName,
				gender,
				dateOfBirth,
				phone,
				isVoter,
				dependents: dependentFields.length,
				dependentDetails: dependentFields,
				latitude,
				longitude,
				...survey
			});
			await barangayStore.refresh();
			onSuccess?.();

			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(toastStore, error instanceof Error ? error.message : 'Failed to save', false);
			console.error(error);
		} finally {
			isSubmitting = false;
		}
	}}
>
	<h2 class="h3 mb-1">Add Household</h2>
	<p class="text-sm opacity-60 mb-4">Fill in the head of the family, then add the other members.</p>

	<!-- 1. Household & Location -->
	<section class="card p-4 space-y-3">
		<h3 class="h4">Household &amp; Location</h3>
		<label class="label">
			<span>Barangay</span>
			<select
				class="select"
				bind:value={data._id}
				on:change={() => fetchHouseholdsForDependents(data._id)}
			>
				{#each barangays as barangay}
					<option value={barangay._id}>{barangay.name}</option>
				{/each}
			</select>
		</label>
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
			<span class="text-sm opacity-70">Tap the map to drop the pin on the house, or drag it.</span>
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
				<input class="input" type="text" placeholder="Juan" bind:value={firstName} required />
			</label>
			<label class="label">
				<span>Middle Name</span>
				<input class="input" type="text" placeholder="Alfon" bind:value={middleName} />
			</label>
			<label class="label">
				<span>Last Name</span>
				<input class="input" type="text" placeholder="Dela Cruz" bind:value={lastName} required />
			</label>
			<label class="label">
				<span>Phone</span>
				<input class="input" type="text" placeholder="09171234567" bind:value={phone} />
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
				<input class="input" type="date" bind:value={dateOfBirth} />
			</label>
			<label class="label flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={isVoter} />
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
	<input type="hidden" bind:value={latitude} />
	<input type="hidden" bind:value={longitude} />

	<!-- Possible-duplicate warning: same head-of-family name in this barangay. -->
	{#if dupMatches.length > 0}
		<div class="card variant-soft-warning p-4 space-y-2">
			<p class="font-semibold">⚠️ Possible duplicate</p>
			<p class="text-sm">
				{dupMatches.length} household{dupMatches.length > 1 ? 's' : ''} in this barangay already have
				this head-of-family name:
			</p>
			<ul class="list-disc list-inside text-sm">
				{#each dupMatches.slice(0, 5) as h (h._id)}
					<li>
						<a class="anchor" href="/dashboard/households/{h._id}" target="_blank" rel="noopener">
							{h.fullName || `${h.firstName} ${h.lastName}`.trim()}
						</a>
					</li>
				{/each}
				{#if dupMatches.length > 5}
					<li class="opacity-70">…and {dupMatches.length - 5} more</li>
				{/if}
			</ul>
			<label class="flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={ackDuplicate} />
				<span>This is a different family — add anyway.</span>
			</label>
		</div>
	{/if}

	<div class="flex justify-end gap-3 pt-2">
		<button type="button" class="btn variant-soft" on:click={() => drawerStore.close()}>
			Cancel
		</button>
		<button
			type="submit"
			class="btn variant-filled-success"
			disabled={isSubmitting || (dupMatches.length > 0 && !ackDuplicate)}
		>
			{isSubmitting ? 'Saving...' : 'Save Household'}
		</button>
	</div>
</form>
