<script lang="ts">
	import { onMount } from 'svelte';
	import { Drawer, getDrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import { goto, invalidateAll } from '$app/navigation';
	import { showToast, showActionConfirmationToast } from '$lib/utils/toastHelper';
	import { loadGoogleMaps } from '$lib/utils/googleMaps';
	import { calculateAge } from '$lib/common/utils';
	import { getTagConfig } from '$lib/utils/tagHelper';
	import {
		SOCIOECONOMIC_OPTIONS,
		RELATIONSHIP_OPTIONS,
		CIVIL_STATUS_OPTIONS,
		EDUCATIONAL_OPTIONS,
		YES_NO_OPTIONS,
		MEMBERSHIP_TYPE_OPTIONS,
		CATEGORY_OPTIONS,
		HOUSING_TYPE_OPTIONS,
		HOUSING_MATERIALS_OPTIONS,
		LAND_OWNERSHIP_OPTIONS,
		labelFor
	} from '$lib/utils/householdOptions';
	import { submitJson } from '$lib/utils/apiHelper';
	import { canEditHouseholds, canManageGrants, canTagHouseholds } from '$lib/utils/roles';
	import { serviceCentavos, formatCentavos } from '$lib/utils/money';
	import { page } from '$app/stores';
	import Update from '$lib/components/forms/household/Update.svelte';
	import AddGrant from '$lib/components/forms/household/AddGrant.svelte';
	import ServiceCreate from '$lib/components/forms/service/Create.svelte';
	import ServiceUpdate from '$lib/components/forms/service/Update.svelte';
	import { serviceCategoryLabels } from '$lib/utils/serviceOptions';
	import type { HouseholdGrant, Service } from '$lib/utils/types';

	export let data;

	$: userRole = $page.data.user?.role;
	$: canEdit = canEditHouseholds(userRole);
	$: canGrant = canManageGrants(userRole);
	$: canTag = canTagHouseholds(userRole);

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

	const drawerAddService: DrawerSettings = {
		id: 'addService',
		width: 'w-[280px] md:w-[520px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerEditService: DrawerSettings = {
		id: 'editService',
		width: 'w-[280px] md:w-[520px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	$: services = (data.services as unknown as Service[]) || [];
	let selectedService: Service | undefined;

	// Multi-family dwelling composition (derived from dependent links).
	$: subFamilies = (data.subFamilies as any[]) || [];
	$: parentHousehold = data.parentHousehold as any;

	const serviceAmount = (svc: Service) => formatCentavos(serviceCentavos(svc));

	const handleEditService = (service: Service) => {
		selectedService = service;
		drawerStore.open(drawerEditService);
	};

	const handleDeleteService = (service: Service) => {
		showActionConfirmationToast(
			toastStore,
			`Delete the service for "${service.patientName}" (${serviceAmount(service)})?`,
			'Delete',
			async () => {
				try {
					const result = await submitJson('/api/admin/service/delete', { _id: service._id });
					showToast(toastStore, result.message, true);
					await invalidateAll();
				} catch (error) {
					showToast(
						toastStore,
						error instanceof Error ? error.message : 'Failed to delete service',
						false
					);
					console.error(error);
				}
			}
		);
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

	const dash = (value: string | null | undefined): string => value || '—';

	// Occupation flags → readable list, e.g. "Farming, Fishing".
	$: occupations = [
		household.occupationEmployment && 'Employment',
		household.occupationFarming && 'Farming',
		household.occupationFishing && 'Fishing',
		household.occupationVending && 'Vending',
		household.occupationToda && 'TODA',
		household.occupationOther
	]
		.filter(Boolean)
		.join(', ');

	$: categoryLabels = (household.categories || [])
		.map((c: string) => labelFor(CATEGORY_OPTIONS, c))
		.join(', ');

	$: relationshipLabel =
		household.relationshipToHead === '4'
			? household.relationshipOther || 'Others'
			: labelFor(RELATIONSHIP_OPTIONS, household.relationshipToHead);

	// Survey rows for a dependent — only the answered ones.
	const dependentExtras = (dep: any): [string, string][] => {
		const occ = [
			dep.occupationEmployment && 'Employment',
			dep.occupationFarming && 'Farming',
			dep.occupationFishing && 'Fishing',
			dep.occupationVending && 'Vending',
			dep.occupationToda && 'TODA',
			dep.occupationOther
		]
			.filter(Boolean)
			.join(', ');
		const rows: [string, string][] = [
			['Date of Visit', dep.dateOfVisit ? formatDate(dep.dateOfVisit) : ''],
			['Sitio', dep.sitio || ''],
			['Ethnicity', dep.ethnicity || ''],
			['Socioeconomic Status', labelFor(SOCIOECONOMIC_OPTIONS, dep.socioeconomicStatus)],
			[
				'Relationship to HH Head',
				dep.relationshipToHead === '4'
					? dep.relationshipOther || 'Others'
					: labelFor(RELATIONSHIP_OPTIONS, dep.relationshipToHead)
			],
			['Civil Status', labelFor(CIVIL_STATUS_OPTIONS, dep.civilStatus)],
			['Education', labelFor(EDUCATIONAL_OPTIONS, dep.educationalAttainment)],
			[
				'PhilHealth',
				dep.philhealth
					? labelFor(YES_NO_OPTIONS, dep.philhealth) +
						(dep.philhealth === 'YES' && dep.philhealthMembershipType
							? ` (${labelFor(MEMBERSHIP_TYPE_OPTIONS, dep.philhealthMembershipType)})`
							: '')
					: ''
			],
			[
				'Category',
				(dep.categories || []).map((c: string) => labelFor(CATEGORY_OPTIONS, c)).join(', ')
			],
			['Occupation', occ],
			[
				'Average Income',
				dep.averageIncome != null ? `₱${Number(dep.averageIncome).toLocaleString()}` : ''
			],
			['Type of Housing', labelFor(HOUSING_TYPE_OPTIONS, dep.housingType)],
			['Housing Materials', labelFor(HOUSING_MATERIALS_OPTIONS, dep.housingMaterials)],
			['Land Ownership', labelFor(LAND_OWNERSHIP_OPTIONS, dep.landOwnership)],
			['Religion', dep.religion || ''],
			['Length of Stay', dep.lengthOfStay || ''],
			['Interviewed By', dep.interviewedBy || '']
		];
		return rows.filter(([, v]) => v);
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
				{#if canTag}
					<span class="badge {tagConfig.swatchClass} text-white">{tagConfig.label}</span>
				{/if}
			</h1>
			<div class="btn-group variant-filled">
				{#if canEdit}
					<button type="button" on:click={() => drawerStore.open(drawerUpdate)}>Edit</button>
				{/if}
				<button type="button" on:click={() => goto('/dashboard/households')}>Back to list</button>
			</div>
		</header>

		<section class="p-4 space-y-6">
			{#if parentHousehold}
				<!-- This record is one family within another household's dwelling -->
				<div class="card variant-soft p-3 flex flex-wrap items-center gap-2">
					<span aria-hidden="true">🏠</span>
					<span>
						This family lives in
						<strong>{parentHousehold.fullName}</strong>’s household.
					</span>
					<a class="anchor" href="/dashboard/households/{parentHousehold._id}">
						View main household
					</a>
				</div>
			{/if}

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
							<dt class="font-bold inline">Household Code:</dt>
							<dd class="inline font-mono">{household.householdCode || '—'}</dd>
						</div>
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

			<!-- Survey details -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="card p-4">
					<h2 class="h3 mb-4">Background & Membership</h2>
					<dl class="space-y-2">
						<div>
							<dt class="font-bold inline">Date of Visit:</dt>
							<dd class="inline">{formatDate(household.dateOfVisit)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Sitio:</dt>
							<dd class="inline">{dash(household.sitio)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Ethnicity:</dt>
							<dd class="inline">{dash(household.ethnicity)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Socioeconomic Status:</dt>
							<dd class="inline">
								{dash(labelFor(SOCIOECONOMIC_OPTIONS, household.socioeconomicStatus))}
							</dd>
						</div>
						<div>
							<dt class="font-bold inline">Relationship to HH Head:</dt>
							<dd class="inline">{dash(relationshipLabel)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Civil Status:</dt>
							<dd class="inline">{dash(labelFor(CIVIL_STATUS_OPTIONS, household.civilStatus))}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Educational Attainment:</dt>
							<dd class="inline">
								{dash(labelFor(EDUCATIONAL_OPTIONS, household.educationalAttainment))}
							</dd>
						</div>
						<div>
							<dt class="font-bold inline">PhilHealth:</dt>
							<dd class="inline">
								{dash(labelFor(YES_NO_OPTIONS, household.philhealth))}{household.philhealth ===
									'YES' && household.philhealthMembershipType
									? ` (${labelFor(MEMBERSHIP_TYPE_OPTIONS, household.philhealthMembershipType)})`
									: ''}
							</dd>
						</div>
						<div>
							<dt class="font-bold inline">Category:</dt>
							<dd class="inline">{dash(categoryLabels)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Religion:</dt>
							<dd class="inline">{dash(household.religion)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Length of Stay:</dt>
							<dd class="inline">{dash(household.lengthOfStay)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Interviewed By:</dt>
							<dd class="inline">{dash(household.interviewedBy)}</dd>
						</div>
					</dl>
				</div>

				<div class="card p-4">
					<h2 class="h3 mb-4">Occupation & Housing</h2>
					<dl class="space-y-2">
						<div>
							<dt class="font-bold inline">Occupation / Income Source:</dt>
							<dd class="inline">{dash(occupations)}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Average Income:</dt>
							<dd class="inline">
								{household.averageIncome != null
									? `₱${Number(household.averageIncome).toLocaleString()}`
									: '—'}
							</dd>
						</div>
						<div>
							<dt class="font-bold inline">Type of Housing:</dt>
							<dd class="inline">{dash(labelFor(HOUSING_TYPE_OPTIONS, household.housingType))}</dd>
						</div>
						<div>
							<dt class="font-bold inline">Housing Materials:</dt>
							<dd class="inline">
								{dash(labelFor(HOUSING_MATERIALS_OPTIONS, household.housingMaterials))}
							</dd>
						</div>
						<div>
							<dt class="font-bold inline">Land Ownership:</dt>
							<dd class="inline">
								{dash(labelFor(LAND_OWNERSHIP_OPTIONS, household.landOwnership))}
							</dd>
						</div>
					</dl>
				</div>
			</div>

			{#if subFamilies.length > 0}
				<!-- Multi-family dwelling: other families living in this household -->
				<div>
					<h2 class="h3 mb-2">Families in this Household ({subFamilies.length + 1})</h2>
					<p class="text-sm opacity-60 mb-4">
						These families live in the same dwelling but keep their own records, tags, and
						grants. Link a dependent to their own household record to add one.
					</p>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each subFamilies as family (family._id)}
							<div class="card p-4 flex flex-col gap-2">
								<div class="flex items-center gap-2">
									{#if canTag}
										<span
											class="inline-block w-3 h-3 rounded-full shrink-0 {getTagConfig(family.tag)
												.swatchClass}"
											title={getTagConfig(family.tag).label}
										></span>
									{/if}
									<h3 class="h5 font-semibold">{family.fullName}</h3>
								</div>
								<p class="text-sm opacity-60">
									{family.dependentDetails?.length ?? family.dependents ?? 0} dependent{(family
										.dependentDetails?.length ??
										family.dependents ??
										0) === 1
										? ''
										: 's'}
								</p>
								<a class="anchor text-sm" href="/dashboard/households/{family._id}">
									View family record
								</a>
							</div>
						{/each}
					</div>
				</div>
			{/if}

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

			<!-- Services -->
			<div>
				<div class="flex flex-wrap items-center justify-between gap-2 mb-4">
					<h2 class="h3">Services ({services.length})</h2>
					{#if canGrant}
						<button
							class="btn btn-sm variant-filled-primary"
							on:click={() => drawerStore.open(drawerAddService)}
						>
							Record Service
						</button>
					{/if}
				</div>
				{#if services.length > 0}
					<div class="table-container">
						<table class="table table-hover">
							<thead>
								<tr>
									<th>Patient</th>
									<th>Category</th>
									<th>Amount</th>
									<th>Date Received</th>
									{#if canGrant}<th class="text-center">Actions</th>{/if}
								</tr>
							</thead>
							<tbody>
								{#each services as service (service._id)}
									<tr>
										<td>{service.patientName}</td>
										<td>
											{#if service.categories?.length}
												<div class="flex flex-wrap gap-1">
													{#each service.categories as c (c)}
														<span class="badge variant-soft">{serviceCategoryLabels([c])}</span>
													{/each}
												</div>
											{:else}
												<span class="opacity-40">—</span>
											{/if}
										</td>
										<td>{serviceAmount(service)}</td>
										<td>{formatDate(service.dateReceived)}</td>
										{#if canGrant}
											<td class="text-center">
												<div class="flex gap-2 justify-center">
													<button
														class="btn btn-sm variant-filled"
														on:click={() => handleEditService(service)}
													>
														Edit
													</button>
													<button
														class="btn btn-sm variant-filled-error"
														on:click={() => handleDeleteService(service)}
													>
														Delete
													</button>
												</div>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="opacity-60">No services recorded yet.</p>
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

								{#if dependentExtras(dependent).length > 0}
									<details class="mt-3 text-sm">
										<summary class="cursor-pointer select-none opacity-70">
											Additional details ({dependentExtras(dependent).length})
										</summary>
										<dl class="space-y-1 mt-2">
											{#each dependentExtras(dependent) as [label, value] (label)}
												<div>
													<dt class="font-bold inline">{label}:</dt>
													<dd class="inline">{value}</dd>
												</div>
											{/each}
										</dl>
									</details>
								{/if}
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
	{:else if $drawerStore.id === 'addService'}
		<ServiceCreate
			householdId={household._id}
			patientName={household.fullName}
			{drawerStore}
			onSuccess={() => invalidateAll()}
		/>
	{:else if $drawerStore.id === 'editService' && selectedService}
		<ServiceUpdate data={selectedService} {drawerStore} onSuccess={() => invalidateAll()} />
	{/if}
</Drawer>
