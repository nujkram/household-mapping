<script lang="ts">
	import { getToastStore, getDrawerStore, Drawer, Paginator } from '@skeletonlabs/skeleton';
	import type { DrawerSettings, PaginationSettings } from '@skeletonlabs/skeleton';
	import { goto, invalidateAll } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { showToast } from '$lib/utils/toastHelper';
	import type { Household, Barangay } from '$lib/utils/types';
	import Create from '$lib/components/forms/household/Create.svelte';
	import Update from '$lib/components/forms/household/Update.svelte';
	import AddGrant from '$lib/components/forms/household/AddGrant.svelte';
	import ServiceCreate from '$lib/components/forms/service/Create.svelte';
	import TableSkeleton from '$lib/components/common/TableSkeleton.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { canEditHouseholds, canManageGrants } from '$lib/utils/roles';
	import { getTagConfig } from '$lib/utils/tagHelper';
	import { CLUSTER_OPTIONS, clusterLabel, resolveClusterId } from '$lib/utils/clusters';

	interface PageData {
		households: Household[];
		barangays: Barangay[];
		total: number;
		page: number;
		limit: number;
		q: string;
		barangay: string;
		tag: string;
		sort: string;
		dir: string;
		cluster: string;
		lockedCluster: string;
	}

	export let data: PageData;

	// Store instances
	const toastStore = getToastStore();
	const drawerStore = getDrawerStore();
	// The drawer store is global and persists across navigation — close any
	// drawer left open by a previous page (same pattern as the other pages).
	drawerStore.close();

	// Filter state, initialized from the URL (the server load echoes it back).
	let searchInput = data.q;
	let selectedBarangay = data.barangay;
	let selectedTag = data.tag;
	let selectedCluster = data.cluster;
	let selectedSortField = data.sort;
	let sortDirection = data.dir;

	// A cluster-scoped encoder can't change cluster; the dropdown is hidden.
	$: isClusterLocked = Boolean(data.lockedCluster);

	// Barangay dropdown narrows to the chosen cluster (data.barangays is already
	// limited to a locked encoder's cluster server-side).
	$: barangayChoices = selectedCluster
		? data.barangays.filter((b) => resolveClusterId(b) === selectedCluster)
		: data.barangays;

	const onClusterChange = () => {
		// Clear a barangay that's no longer in the chosen cluster.
		if (
			selectedBarangay &&
			!barangayChoices.some((b) => b._id === selectedBarangay)
		) {
			selectedBarangay = '';
		}
		applyFilters();
	};

	// Role-based capabilities (Encoder edits/tags; Grant Officer awards grants).
	$: userRole = $page.data.user?.role;
	$: canEdit = canEditHouseholds(userRole);
	$: canGrant = canManageGrants(userRole);

	// Selected household for updates / grant awards
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

	const drawerAddGrant: DrawerSettings = {
		id: 'addGrant',
		width: 'w-[280px] md:w-[520px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const handleAddGrant = (household: Household) => {
		selectedHousehold = household;
		drawerStore.open(drawerAddGrant);
	};

	const drawerAddService: DrawerSettings = {
		id: 'addService',
		width: 'w-[280px] md:w-[520px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const handleAddService = (household: Household) => {
		selectedHousehold = household;
		drawerStore.open(drawerAddService);
	};

	// Push the current filter state into the URL — the server load re-runs and
	// returns just the matching page of households.
	const applyFilters = (opts: { page?: number; limit?: number } = {}) => {
		const params = new URLSearchParams();
		if (searchInput.trim()) params.set('q', searchInput.trim());
		if (selectedCluster) params.set('cluster', selectedCluster);
		if (selectedBarangay) params.set('barangay', selectedBarangay);
		if (selectedTag) params.set('tag', selectedTag);
		if (selectedSortField !== 'updatedAt') params.set('sort', selectedSortField);
		if (sortDirection !== 'desc') params.set('dir', sortDirection);
		if (opts.page) params.set('page', String(opts.page));
		const limit = opts.limit ?? data.limit;
		if (limit !== 20) params.set('limit', String(limit));
		goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	};

	const debouncedSearch = debounce(() => applyFilters(), 300);

	const toggleSortDirection = () => {
		sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		applyFilters();
	};

	// Pagination (server-side): size comes from the DB count.
	let paginationSettings: PaginationSettings = {
		page: data.page,
		limit: data.limit,
		size: data.total,
		amounts: [10, 20, 50, 100]
	};
	$: {
		paginationSettings.page = data.page;
		paginationSettings.limit = data.limit;
		paginationSettings.size = data.total;
	}

	const onPageChange = (e: CustomEvent) => applyFilters({ page: e.detail });
	const onAmountChange = (e: CustomEvent) => applyFilters({ limit: e.detail });

	$: hasFilters = Boolean(data.q || data.barangay || data.tag);

	// Optimistically update the row, then confirm with the server — no full
	// refetch for a one-field change.
	async function handleSetTag(household: Household, tag: 'APIN' | 'KONTRA' | 'UNTAGGED') {
		const previousTag = household.tag;
		data.households = data.households.map((h) =>
			h._id === household._id ? { ...h, tag } : h
		);

		try {
			const response = await fetch('/api/admin/household/set-tag', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ householdId: household._id, tag })
			});
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to update tag');
			}
			showToast(toastStore, `Successfully tagged as ${tag}`, true);
		} catch (error) {
			// Roll back the optimistic change.
			data.households = data.households.map((h) =>
				h._id === household._id ? { ...h, tag: previousTag } : h
			);
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'Failed to update tag',
				false
			);
			console.error('Error setting tag:', error);
		}
	}

	function handleUpdate(household: Household) {
		selectedHousehold = household;
		drawerStore.open(drawerUpdate);
	}

	// Re-run the server load after a create/update so the table reflects it.
	const refreshList = () => invalidateAll();

	// Get the selected barangay for Create component
	$: selectedBarangayData = selectedBarangay
		? data.barangays.find((b) => b._id === selectedBarangay)
		: data.barangays[0] || undefined;

	// Get the barangay for Update component
	$: selectedHouseholdBarangay = selectedHousehold
		? data.barangays.find((b) => b._id === selectedHousehold?.barangayId)
		: undefined;
</script>

<div class="container mx-auto p-4">
	<div class="card p-4">
		<header class="card-header flex justify-between items-center">
			<h1 class="h3">Household Management</h1>
			{#if canEdit}
				<button class="btn variant-filled-primary" on:click={() => drawerStore.open(drawerCreate)}>
					Add Household
				</button>
			{/if}
		</header>

		{#if isClusterLocked}
			<p class="px-4 pt-2 text-sm opacity-70">
				Showing households in <strong>{clusterLabel(data.lockedCluster)}</strong> (your assigned cluster).
			</p>
		{/if}

		<!-- Filters -->
		<div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 p-4">
			<div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
				<div class="input-group-shim" aria-hidden="true">🔍</div>
				<input
					type="search"
					placeholder="Search households..."
					bind:value={searchInput}
					on:input={debouncedSearch}
					class="input"
				/>
			</div>

			{#if !isClusterLocked}
				<select bind:value={selectedCluster} on:change={onClusterChange} class="select">
					<option value="">All Clusters</option>
					{#each CLUSTER_OPTIONS as c}
						<option value={c.value}>{c.label}</option>
					{/each}
				</select>
			{/if}

			<select bind:value={selectedBarangay} on:change={() => applyFilters()} class="select">
				<option value="">All Barangays</option>
				{#each barangayChoices as barangay}
					<option value={barangay._id}>{barangay.name}</option>
				{/each}
			</select>

			<select bind:value={selectedTag} on:change={() => applyFilters()} class="select">
				<option value="">All Tags</option>
				<option value="APIN">APIN</option>
				<option value="KONTRA">KONTRA</option>
				<option value="UNTAGGED">UNTAGGED</option>
			</select>

			<div class="flex gap-2">
				<select
					bind:value={selectedSortField}
					on:change={() => applyFilters()}
					class="select flex-1"
				>
					<option value="updatedAt">Sort by Last Updated</option>
					<option value="fullName">Sort by Name</option>
				</select>
				<button
					type="button"
					class="btn variant-soft px-3"
					title="Toggle sort direction ({sortDirection === 'asc' ? 'ascending' : 'descending'})"
					on:click={toggleSortDirection}
				>
					{sortDirection === 'asc' ? '↑' : '↓'}
				</button>
			</div>
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
						{#if canGrant}
							<th>Grants</th>
							<th>Services</th>
						{/if}
						<th>Last Updated</th>
						<th class="text-center">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#if $navigating}
						<TableSkeleton rows={6} cols={canGrant ? 8 : 6} />
					{:else if data.households.length === 0}
						<tr>
							<td colspan={canGrant ? 8 : 6} class="text-center py-8 opacity-60">
								{#if !hasFilters && data.total === 0}
									No households yet. Click “Add Household” to create one.
								{:else}
									No households match your search or filters.
								{/if}
							</td>
						</tr>
					{:else}
						{#each data.households as household (household._id)}
							<tr>
								<td>
									{household.fullName}
									{#if (household.subFamilyCount ?? 0) > 0}
										<span
											class="badge variant-soft-primary ml-1"
											title="{household.subFamilyCount} other famil{household.subFamilyCount === 1
												? 'y lives'
												: 'ies live'} in this household"
										>
											+{household.subFamilyCount}
											famil{household.subFamilyCount === 1 ? 'y' : 'ies'}
										</span>
									{:else if household.parentHouseholdId}
										<span
											class="badge variant-soft ml-1"
											title="This family lives in another household's dwelling"
										>
											shares household
										</span>
									{/if}
								</td>
								<td>{household.barangayName}</td>
								<td>{household.phone || '-'}</td>
								<td>
									{#if canEdit}
										<div class="dropdown">
											<button
												class="btn {household.tag === 'APIN'
													? 'variant-filled-success'
													: household.tag === 'KONTRA'
														? 'variant-filled-error'
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
														? 'bg-error-500/20'
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
									{:else}
										<!-- Read-only color dot only: green APIN / red KONTRA / grey UNTAGGED.
										     Label is in the title attr for accessibility, not shown. -->
										<span
											class="inline-block w-5 h-5 rounded-full {getTagConfig(household.tag)
												.swatchClass}"
											title={getTagConfig(household.tag).label}
											role="img"
											aria-label={getTagConfig(household.tag).label}
										></span>
									{/if}
								</td>
								{#if canGrant}
									<td>
										{#if household.grants?.length}
											<div class="flex flex-wrap gap-1 max-w-[220px]">
												{#each household.grants as grant (grant.grantId)}
													<span
														class="badge variant-soft-success whitespace-nowrap"
														title="{grant.name} ({grant.year})"
													>
														{grant.name}
														<span class="opacity-60 ml-1">{grant.year}</span>
													</span>
												{/each}
											</div>
										{:else}
											<span class="opacity-40">None</span>
										{/if}
									</td>
									<td>
										{#if household.serviceCount}
											<span
												class="badge variant-soft-tertiary whitespace-nowrap"
												title="{household.serviceCount} service{household.serviceCount === 1
													? ''
													: 's'} · ₱{Number(household.serviceTotal).toLocaleString()} total"
											>
												{household.serviceCount} · ₱{Number(household.serviceTotal).toLocaleString()}
											</span>
										{:else}
											<span class="opacity-40">None</span>
										{/if}
									</td>
								{/if}
								<td>{new Date(household.updatedAt).toLocaleDateString()}</td>
								<td class="text-center">
									<div class="flex gap-2 justify-center">
										<a
											class="btn btn-sm variant-filled-primary"
											href="/dashboard/households/{household._id}"
										>
											View
										</a>
										{#if canEdit}
											<button
												class="btn btn-sm variant-filled"
												on:click={() => handleUpdate(household)}
											>
												Update
											</button>
										{/if}
										{#if canGrant}
											<button
												class="btn btn-sm variant-filled-success"
												on:click={() => handleAddGrant(household)}
											>
												+ Grant
											</button>
											<button
												class="btn btn-sm variant-filled-tertiary"
												on:click={() => handleAddService(household)}
											>
												+ Service
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		<div class="p-4">
			<Paginator
				bind:settings={paginationSettings}
				on:page={onPageChange}
				on:amount={onAmountChange}
				showFirstLastButtons={true}
				showPreviousNextButtons={true}
			/>
		</div>
	</div>
</div>

<!-- Drawers -->
<Drawer>
	{#if $drawerStore.id === 'createHousehold' && selectedBarangayData}
		<Create data={selectedBarangayData} {drawerStore} onSuccess={refreshList} />
	{:else if $drawerStore.id === 'updateHousehold' && selectedHousehold && selectedHouseholdBarangay}
		<Update
			data={selectedHousehold}
			barangay={selectedHouseholdBarangay}
			{drawerStore}
			onSuccess={refreshList}
		/>
	{:else if $drawerStore.id === 'addGrant' && selectedHousehold}
		<AddGrant
			householdId={selectedHousehold._id}
			householdName={selectedHousehold.fullName}
			receivedGrants={selectedHousehold.grants || []}
			{drawerStore}
			onSuccess={refreshList}
		/>
	{:else if $drawerStore.id === 'addService' && selectedHousehold}
		<ServiceCreate
			householdId={selectedHousehold._id}
			patientName={selectedHousehold.fullName}
			{drawerStore}
			onSuccess={refreshList}
		/>
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

	/* focus-within keeps the menu reachable by keyboard and touch, not just hover */
	.dropdown:hover .dropdown-menu,
	.dropdown:focus-within .dropdown-menu {
		display: block;
	}
</style>
