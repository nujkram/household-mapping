<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { submitJson } from '$lib/utils/apiHelper';
	import type { Barangay } from '$lib/utils/types';
	import { barangayStore } from '$lib/stores/barangayStore';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { CLUSTER_OPTIONS, clusterIdForBarangay, clusterLabel } from '$lib/utils/clusters';
	import {
		PSGC_BARANGAY_OPTIONS,
		PSGC_REGION,
		PSGC_PROVINCE,
		PSGC_MUNICIPALITY,
		psgcCodesFromBarangayCode,
		psgcCodesForName
	} from '$lib/utils/psgc';

	export let drawerStore: DrawerStore;
	export let data: Barangay;
	/** Called after a successful update so the parent page can refresh its data. */
	export let onSuccess: (() => void) | undefined = undefined;
	const isFocused: boolean = true;
	let cluster = data.cluster ?? '';
	// What the name-based config would assign if left on Auto.
	$: autoCluster = clusterIdForBarangay(data.name);
	let isSubmitting = false;

	// PSGC codes: use the stored codes; if absent, offer the match for this name.
	const seed = data.barangayCode
		? psgcCodesFromBarangayCode(data.barangayCode)
		: psgcCodesForName(data.name);
	let barangayCode = seed.barangayCode;
	let regionCode = seed.regionCode;
	let provinceCode = seed.provinceCode;
	let cityMunicipalityCode = seed.cityMunicipalityCode;

	// Selecting an official barangay fills in its name + all four PSGC codes.
	const applyPsgc = () => {
		const parts = psgcCodesFromBarangayCode(barangayCode);
		regionCode = parts.regionCode;
		provinceCode = parts.provinceCode;
		cityMunicipalityCode = parts.cityMunicipalityCode;
		const match = PSGC_BARANGAY_OPTIONS.find((o) => o.value === barangayCode);
		if (match) data.name = match.label;
	};

	let map: google.maps.Map;
	let marker: google.maps.marker.AdvancedMarkerElement;

	// toast settings
	const toastStore = getToastStore();

	onMount(async () => {
		const initMap = (): void => {
			const defaultLocation = {
				lat: 11.442339253918387,
				lng: 122.69376754760742
			};

			let barangayLocation = {
				lat: Number.parseFloat(data.latitude),
				lng: Number.parseFloat(data.longitude)
			};

			// Use default location if coordinates are invalid
			if (isNaN(barangayLocation.lat) || isNaN(barangayLocation.lng)) {
				showToast(toastStore, 'Using default location due to invalid coordinates.', false);
				console.warn('Invalid coordinates, using default:', data.latitude, data.longitude);
				barangayLocation = defaultLocation;
				// Update the data with default coordinates
				data.latitude = defaultLocation.lat.toString();
				data.longitude = defaultLocation.lng.toString();
			}

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

	const handleSubmit = async () => {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const result = await submitJson('/api/admin/barangay/update', {
				_id: data._id,
				name: data.name,
				lastName: data.lastName,
				middleName: data.middleName,
				firstName: data.firstName,
				phone: data.phone,
				latitude: data.latitude,
				longitude: data.longitude,
				cluster,
				regionCode,
				provinceCode,
				cityMunicipalityCode,
				barangayCode
			});

			// Update the store immediately with the new data
			barangayStore.edit({
				...data,
				cluster,
				fullName: `${data.firstName} ${data.middleName} ${data.lastName}`
			});

			// Then refresh from server to ensure consistency
			await barangayStore.refresh();
			onSuccess?.();

			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(toastStore, error instanceof Error ? error.message : 'Failed to update', false);
			console.error(error);
		} finally {
			isSubmitting = false;
		}
	};
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6 space-y-4"
	use:focusTrap={isFocused}
	on:submit|preventDefault={handleSubmit}
>
	<h2 class="h4">Update Barangay {data.name}</h2>

	<div class="mb-4 border border-gray-300 rounded-lg overflow-hidden mt-4">
		<div id="map" class="h-[300px] w-full"></div>
	</div>

	<label class="label">
		<span>PSGC Barangay <span class="opacity-60">(Sigma, Capiz)</span></span>
		<select class="select" bind:value={barangayCode} on:change={applyPsgc}>
			<option value="">— Select official barangay —</option>
			{#each PSGC_BARANGAY_OPTIONS as o}
				<option value={o.value}>{o.label} ({o.value})</option>
			{/each}
		</select>
	</label>

	{#if barangayCode}
		<div class="card variant-soft p-3 text-sm space-y-1">
			<div><span class="opacity-60">Region:</span> {PSGC_REGION.name} — {regionCode}</div>
			<div><span class="opacity-60">Province:</span> {PSGC_PROVINCE.name} — {provinceCode}</div>
			<div>
				<span class="opacity-60">City/Municipality:</span>
				{PSGC_MUNICIPALITY.name} — {cityMunicipalityCode}
			</div>
			<div><span class="opacity-60">Barangay code:</span> {barangayCode}</div>
		</div>
	{/if}

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

	<label class="label">
		<span>Cluster</span>
		<select class="select" bind:value={cluster}>
			<option value="">
				Auto{autoCluster ? ` — ${clusterLabel(autoCluster)}` : ' (unassigned)'}
			</option>
			{#each CLUSTER_OPTIONS as c}
				<option value={c.value}>{c.label}</option>
			{/each}
		</select>
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
			disabled={isSubmitting}
			class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{isSubmitting ? 'Updating...' : 'Update'}
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
