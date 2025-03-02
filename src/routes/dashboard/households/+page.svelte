<script lang="ts">
	import { getToastStore, getDrawerStore, Drawer } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import { onMount } from 'svelte';
	import { showToast } from '$lib/utils/toastHelper';
	import type { Household, Barangay } from '$lib/utils/types';
	import { barangayStore } from '$lib/stores/barangayStore';
	import Create from '$lib/components/forms/household/Create.svelte';
	import Update from '$lib/components/forms/household/Update.svelte';

	interface PageData {
		households: Household[];
		barangays: Barangay[];
	}

	export let data: PageData;
	let { households, barangays } = data;

	// Store instances
	const toastStore = getToastStore();
	const drawerStore = getDrawerStore();

	// Search and filter state
	let searchQuery = '';
	let selectedBarangay = '';
	let selectedTag = '';
	let selectedSortField: 'updatedAt' | 'fullName' = 'updatedAt';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// Selected household for updates
	let selectedHousehold: Household | undefined;

	// Drawer settings
	const drawerCreate: DrawerSettings = {
		id: 'createHousehold',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerUpdate: DrawerSettings = {
		id: 'updateHousehold',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	// Filter households based on search query and filters
	$: filteredHouseholds = households
		.filter((household: Household) => {
			const matchesSearch =
				!searchQuery ||
				household.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(household.phone?.toLowerCase() || '').includes(searchQuery.toLowerCase());

			const matchesBarangay = !selectedBarangay || household.barangayId === selectedBarangay;
			const matchesTag = !selectedTag || household.tag === selectedTag;

			return matchesSearch && matchesBarangay && matchesTag;
		})
		.sort((a: Household, b: Household) => {
			const direction = sortDirection === 'asc' ? 1 : -1;
			if (selectedSortField === 'fullName') {
				return direction * a.fullName.localeCompare(b.fullName);
			}
			return direction * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
		});

	// Handle household tag update
	async function handleSetTag(household: Household, tag: 'APIN' | 'KONTRA' | 'UNTAGGED') {
		try {
			const response = await fetch('/api/admin/household/set-tag', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					householdId: household._id,
					tag
				})
			});

			const result = await response.json();
			if (response.ok) {
				// Update the local state
				households = households.map((h) => (h._id === household._id ? { ...h, tag } : h));

				showToast(toastStore, `Successfully tagged as ${tag}`, true);
			} else {
				showToast(toastStore, result.error || 'Failed to update tag', false);
			}
		} catch (error) {
			showToast(toastStore, 'Failed to update tag', false);
			console.error('Error setting tag:', error);
		}
	}

	function handleUpdate(household: Household) {
		selectedHousehold = household;
		drawerStore.open(drawerUpdate);
	}

	// Get the selected barangay for Create component
	$: selectedBarangayData = selectedBarangay
		? barangays.find((b) => b._id === selectedBarangay)
		: barangays[0] || undefined;

	// Get the barangay for Update component
	$: selectedHouseholdBarangay = selectedHousehold
		? barangays.find((b) => b._id === selectedHousehold.barangayId)
		: undefined;
</script>

<div class="container mx-auto p-4">
	<div class="card p-4">
		<header class="card-header flex justify-between items-center">
			<h1 class="h3">Household Management</h1>
			<button class="btn variant-filled-primary" on:click={() => drawerStore.open(drawerCreate)}>
				Add Household
			</button>
		</header>

		<!-- Filters -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
			<div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
				<div class="input-group-shim">🔍</div>
				<input
					type="search"
					placeholder="Search households..."
					bind:value={searchQuery}
					class="input"
				/>
			</div>

			<select bind:value={selectedBarangay} class="select">
				<option value="">All Barangays</option>
				{#each barangays as barangay}
					<option value={barangay._id}>{barangay.name}</option>
				{/each}
			</select>

			<select bind:value={selectedTag} class="select">
				<option value="">All Tags</option>
				<option value="APIN">APIN</option>
				<option value="KONTRA">KONTRA</option>
				<option value="UNTAGGED">UNTAGGED</option>
			</select>

			<select bind:value={selectedSortField} class="select">
				<option value="updatedAt">Sort by Last Updated</option>
				<option value="fullName">Sort by Name</option>
			</select>
		</div>

		<!-- Households Table -->
		<div class="table-container">
			<table class="table table-hover">
				<thead>
					<tr>
						<th>Name</th>
						<th>Barangay</th>
						<th>Phone</th>
						<th>Tag</th>
						<th>Last Updated</th>
						<th class="text-center">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredHouseholds as household}
						<tr>
							<td>{household.fullName}</td>
							<td>{household.barangayName}</td>
							<td>{household.phone || '-'}</td>
							<td>
								<div class="dropdown">
									<button
										class="btn {household.tag === 'APIN'
											? 'variant-filled-success'
											: household.tag === 'KONTRA'
												? 'variant-filled-primary'
												: 'variant-filled-surface'} btn-sm"
									>
										{household.tag || 'UNTAGGED'}
									</button>
									<div
										class="dropdown-menu absolute top-full left-0 bg-surface-100 rounded-md shadow-md"
									>
										<button
											class="w-full px-4 py-2 text-left hover:bg-surface-400 {household.tag ===
											'APIN'
												? 'bg-success-500/20'
												: ''} variant-filled-surface"
											on:click={() => handleSetTag(household, 'APIN')}
										>
											APIN
										</button>
										<button
											class="w-full px-4 py-2 text-left hover:bg-surface-400 {household.tag ===
											'KONTRA'
												? 'bg-primary-500/20'
												: ''} variant-filled-surface"
											on:click={() => handleSetTag(household, 'KONTRA')}
										>
											KONTRA
										</button>
										<button
											class="w-full px-4 py-2 text-left hover:bg-surface-400 {household.tag ===
											'UNTAGGED'
												? 'bg-surface-500/20'
												: ''} variant-filled-surface"
											on:click={() => handleSetTag(household, 'UNTAGGED')}
										>
											UNTAGGED
										</button>
									</div>
								</div>
							</td>
							<td>{new Date(household.updatedAt).toLocaleDateString()}</td>
							<td class="text-center">
								<button class="btn btn-sm variant-filled" on:click={() => handleUpdate(household)}>
									Update
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Drawers -->
<Drawer>
	{#if $drawerStore.id === 'createHousehold' && selectedBarangayData}
		<Create data={selectedBarangayData} {drawerStore} />
	{:else if $drawerStore.id === 'updateHousehold' && selectedHousehold && selectedHouseholdBarangay}
		<Update data={selectedHousehold} barangay={selectedHouseholdBarangay} {drawerStore} />
	{/if}
</Drawer>

<style>
	.dropdown {
		position: relative;
		display: inline-block;
	}

	.dropdown-menu {
		display: none;
		position: absolute;
		background-color: var(--color-surface-100);
		min-width: 120px;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
		z-index: 1;
	}

	.dropdown:hover .dropdown-menu {
		display: block;
	}

	.dropdown-item {
		padding: 8px 12px;
		display: block;
		width: 100%;
		text-align: left;
		border: none;
		background: none;
		cursor: pointer;
	}
</style>
