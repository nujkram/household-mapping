<script lang="ts">
	import { onMount } from 'svelte';
	import { Drawer, getDrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import { goto, invalidateAll } from '$app/navigation';
	import { showToast, showActionConfirmationToast } from '$lib/utils/toastHelper';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { calculateAge } from '$lib/common/utils';
	import { getTagConfig } from '$lib/utils/tagHelper';
	import { submitJson } from '$lib/utils/apiHelper';
	import { canEditHouseholds, canManageGrants } from '$lib/utils/roles';
	import { page } from '$app/stores';
	import Update from '$lib/components/forms/household/Update.svelte';
	import AddGrant from '$lib/components/forms/household/AddGrant.svelte';
	import type { HouseholdGrant } from '$lib/utils/types';

	export let data;

	$: userRole = $page.data.user?.role;
	$: canEdit = canEditHouseholds(userRole);
	$: canGrant = canManageGrants(userRole);

	// Aggregation results are driver `Document`s; this app uses string _ids.
	$: household = data.household as any;
	$: tagConfig = getTagConfig(household.tag);
	$: hasLocation = Boolean(household.latitude && household.longitude);

	// drawer settings
	const drawerUpdate: DrawerSettings = {
		id: 'updateHousehold',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerAddGrant: DrawerSettings = {
		id: 'addGrant',
		width: 'w-[280px] md:w-[520px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerStore = getDrawerStore();
	const toastStore = getToastStore();
	// Close any drawer left open by a previous page (drawer store is global).
	drawerStore.close();

	let map: google.maps.Map | undefined;
	let marker: google.maps.Marker;
	let mapElement: HTMLDivElement;
	let mapsReady = false;

	const defaultLocation = { lat: 11.442339253918387, lng: 122.69376754760742 };

	const formatDate = (value: string | Date | null | undefined): string => {
		if (!value) return '—';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
	};

	// Remove a grant from this household, behind a confirmation toast.
	const handleRemoveGrant = (grant: HouseholdGrant) => {
		showActionConfirmationToast(
			toastStore,
			`Remove "${grant.name} (${grant.year})" from this household?`,
			'Remove',
			async () => {
				try {
					const result = await submitJson('/api/admin/household/grant/remove', {
						householdId: household._id,
						grantId: grant.grantId
					});
					showToast(toastStore, result.message, true);
					await invalidateAll();
				} catch (error) {
					showToast(
						toastStore,
						error instanceof Error ? error.message : 'Failed to remove grant',
						false
					);
					console.error(error);
				}
			}
		);
	};

	const initMap = (): void => {
		const lat = Number.parseFloat(household.latitude);
		const lng = Number.parseFloat(household.longitude);
		const location =
			Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : defaultLocation;

		map = new google.maps.Map(mapElement, {
			center: location,
			zoom: 15,
			mapId: import.meta.env.VITE_GOOGLE_MAPS_ID
		});

		marker = new google.maps.Marker({
			map,
			position: location,
			title: household.fullName
		});
	};

	// Initialize (or re-center) the map once the API is loaded and the map
	// container exists — also covers a location being added via Edit.
	$: if (mapsReady && mapElement && hasLocation) {
		if (!map) {
			initMap();
		} else {
			const lat = Number.parseFloat(household.latitude);
			const lng = Number.parseFloat(household.longitude);
			if (Number.isFinite(lat) && Number.isFinite(lng)) {
				map.setCenter({ lat, lng });
				marker?.setPosition({ lat, lng });
			}
		}
	}

	onMount(async () => {
		const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
		if (!apiKey) {
			showToast(toastStore, 'Google Maps API key is missing', false);
			return;
		}

		try {
			await loadGoogleMaps(apiKey);
			mapsReady = true;
		} catch (error) {
			showToast(toastStore, 'Failed to load Google Maps', false);
			console.error(error);
		}
	});
</script>

<svelte:head>
	<title>{household.fullName || 'Household'} — Household Details</title>
</svelte:head>

<div class="container mx-auto p-4">
	<div class="card p-4">
		<header class="card-header flex flex-wrap items-center justify-between gap-2">
			<h1 class="h2 flex items-center gap-3">
				{household.fullName || 'Unnamed Household'}
				<span class="badge {tagConfig.swatchClass} text-white">{tagConfig.label}</span>
			</h1>
			<div class="btn-group variant-filled">
				{#if canEdit}
					<button type="button" on:click={() => drawerStore.open(drawerUpdate)}>Edit</button>
				{/if}
				<button type="button" on:click={() => goto('/dashboard/households')}>Back to list</button>
			</div>
		</header>

		<section class="p-4 space-y-6">
			<!-- Map -->
			{#if hasLocation}
				<div class="border border-gray-300 rounded-lg overflow-hidden">
					<div bind:this={mapElement} class="h-[300px] w-full"></div>
				</div>
			{:else}
				<div
					class="border border-dashed border-gray-400 rounded-lg h-24 flex items-center justify-center opacity-60"
				>
					No location set for this household — edit it to pin one on the map.
				</div>
			{/if}

			<!-- Details Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Head of family -->
				<div class="card p-4">
					<h2 class="h3 mb-4">Head of the Family</h2>
					<dl class="space-y-2">
						<div>
							<dt class="font-bold inline">Full Name:</dt>
							<dd class="inline">{household.fullName || '—'}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Gender:</dt>
							<dd class="inline">{household.gender || '—'}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Date of Birth:</dt>
							<dd class="inline">{formatDate(household.dateOfBirth)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Age:</dt>
							<dd class="inline">{calculateAge(household.dateOfBirth) || '—'}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Phone:</dt>
							<dd class="inline">{household.phone || '—'}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Voter Status:</dt>
							<dd class="inline">{household.isVoter ? 'Registered Voter' : 'Not Registered'}</dd>
						</div>
						{#if household.precinct}
							<div>
								<dt class="font-bold inline">Precinct:</dt>
								<dd class="inline">{household.precinct}</dd>
							</div>
						{/if}
						{#if household.vin}
							<div>
								<dt class="font-bold inline">VIN:</dt>
								<dd class="inline">{household.vin}</dd>
							</div>
						{/if}
						{#if household.disability}
							<div>
								<dt class="font-bold inline">Disability:</dt>
								<dd class="inline">{household.disability}</dd>
							</div>
						{/if}
					</dl>
				</div>

				<!-- Location / record info -->
				<div class="card p-4">
					<h2 class="h3 mb-4">Location & Record</h2>
					<dl class="space-y-2">
						<div>
							<dt class="font-bold inline">Barangay:</dt>
							<dd class="inline">
								{#if household.barangay}
									<a
										class="anchor"
										href="/dashboard/barangays/{household.barangay._id}"
										>{household.barangay.name}</a
									>
								{:else}
									—
								{/if}
							</dd>
						</div>
						{#if household.address}
							<div>
								<dt class="font-bold inline">Address:</dt>
								<dd class="inline">{household.address}</dd>
							</div>
						{/if}
						<div>
							<dt class="font-bold inline">Coordinates:</dt>
							<dd class="inline">
								{hasLocation ? `${household.latitude}, ${household.longitude}` : 'Not set'}
							</dd>
						</div>
						<div>
							<dt class="font-bold inline">Created:</dt>
							<dd class="inline">
								{formatDate(household.createdAt)}
								{#if household.createdByUser?.fullName}
									by {household.createdByUser.fullName}
								{/if}
							</dd>
						</div>
						<div>
							<dt class="font-bold inline">Last Updated:</dt>
							<dd class="inline">{formatDate(household.updatedAt)}</dd>
						</div>
					</dl>
				</div>
			</div>

			<!-- Grants -->
			<div>
				<div class="flex flex-wrap items-center justify-between gap-2 mb-4">
					<h2 class="h3">Grants Received ({household.grants?.length ?? 0})</h2>
					{#if canGrant}
						<button
							class="btn btn-sm variant-filled-primary"
							on:click={() => drawerStore.open(drawerAddGrant)}
						>
							Add Grant
						</button>
					{/if}
				</div>
				{#if household.grants?.length > 0}
					<div class="table-container">
						<table class="table table-hover">
							<thead>
								<tr>
									<th>Grant</th>
									<th>Year</th>
									<th>Received</th>
									<th class="text-center">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each household.grants as grant (grant.grantId)}
									<tr>
										<td>{grant.name}</td>
										<td>{grant.year}</td>
										<td>{formatDate(grant.receivedAt)}</td>
										<td class="text-center">
											{#if canGrant}
												<button
													class="btn btn-sm variant-filled-error"
													on:click={() => handleRemoveGrant(grant)}
												>
													Remove
												</button>
											{:else}
												<span class="opacity-40">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="opacity-60">No grants received yet.</p>
				{/if}
			</div>

			<!-- Dependents -->
			<div>
				<h2 class="h3 mb-4">
					Dependents ({household.dependentDetails?.length ?? 0})
				</h2>
				{#if household.dependentDetails?.length > 0}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each household.dependentDetails as dependent (dependent._id)}
							<div class="card p-4">
								<h3 class="h4 mb-2">{dependent.fullName || 'Unnamed Dependent'}</h3>
								<dl class="space-y-1">
									<div>
										<dt class="font-bold inline">Gender:</dt>
										<dd class="inline">{dependent.gender || '—'}</dd>
									</div>
									<div>
										<dt class="font-bold inline">Date of Birth:</dt>
										<dd class="inline">{formatDate(dependent.dateOfBirth)}</dd>
									</div>
									<div>
										<dt class="font-bold inline">Age:</dt>
										<dd class="inline">{calculateAge(dependent.dateOfBirth) || '—'}</dd>
									</div>
									<div>
										<dt class="font-bold inline">Voter Status:</dt>
										<dd class="inline">
											{dependent.isVoter ? 'Registered Voter' : 'Not Registered'}
										</dd>
									</div>
									{#if dependent.linkedHouseholdId}
										<div>
											<dt class="font-bold inline">Own Household:</dt>
											<dd class="inline">
												<a
													class="anchor"
													href="/dashboard/households/{dependent.linkedHouseholdId}"
													>View household</a
												>
											</dd>
										</div>
									{/if}
								</dl>
							</div>
						{/each}
					</div>
				{:else}
					<p class="opacity-60">No dependents recorded for this household.</p>
				{/if}
			</div>
		</section>
	</div>
</div>

<Drawer>
	{#if $drawerStore.id === 'updateHousehold'}
		<Update
			data={household}
			barangay={household.barangay || { _id: household.barangayId }}
			{drawerStore}
			onSuccess={() => invalidateAll()}
		/>
	{:else if $drawerStore.id === 'addGrant'}
		<AddGrant
			householdId={household._id}
			householdName={household.fullName}
			receivedGrants={household.grants || []}
			{drawerStore}
			onSuccess={() => invalidateAll()}
		/>
	{/if}
</Drawer>
