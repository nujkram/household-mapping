<script lang="ts">
	import { Drawer, getDrawerStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import { invalidateAll } from '$app/navigation';
	import Create from '$lib/components/forms/grant/Create.svelte';
	import Update from '$lib/components/forms/grant/Update.svelte';
	import { debounce } from '$lib/utils/debounce';
	import type { Grant } from '$lib/utils/types';

	export let data;

	const drawerStore = getDrawerStore();
	// Close any drawer left open by a previous page (drawer store is global).
	drawerStore.close();

	let selectedGrant: Grant | undefined;

	// Debounced search
	let searchInput = '';
	let searchQuery = '';
	const applySearch = debounce((value: string) => (searchQuery = value), 250);
	$: applySearch(searchInput);

	$: grants = (data.grants as Grant[]) || [];
	$: filteredGrants = grants.filter(
		(g) =>
			!searchQuery ||
			(g.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
			String(g.year).includes(searchQuery)
	);

	const drawerCreate: DrawerSettings = {
		id: 'createGrant',
		width: 'w-[280px] md:w-[520px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerUpdate: DrawerSettings = {
		id: 'updateGrant',
		width: 'w-[280px] md:w-[520px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const handleClickUpdate = (grant: Grant) => {
		selectedGrant = grant;
		drawerStore.open(drawerUpdate);
	};

	const refreshList = () => invalidateAll();

	const formatDate = (value: string | null | undefined): string => {
		if (!value) return '—';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
	};
</script>

<svelte:head>
	<title>Grants</title>
</svelte:head>

<div class="container mx-auto p-4">
	<div class="card p-4">
		<header class="card-header flex flex-wrap justify-between items-center gap-2">
			<h1 class="h3">Grants</h1>
			<button class="btn variant-filled-primary" on:click={() => drawerStore.open(drawerCreate)}>
				Add Grant
			</button>
		</header>

		<div class="p-4">
			<div class="input-group input-group-divider grid-cols-[auto_1fr_auto] max-w-md">
				<div class="input-group-shim" aria-hidden="true">🔍</div>
				<input
					type="search"
					placeholder="Search by name or year..."
					bind:value={searchInput}
					class="input"
				/>
			</div>
		</div>

		<div class="table-container">
			<table class="table table-hover">
				<thead>
					<tr>
						<th>Name</th>
						<th>Year</th>
						<th>Released Date</th>
						<th>Recipients</th>
						<th>Status</th>
						<th class="text-center">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#if filteredGrants.length === 0}
						<tr>
							<td colspan="6" class="text-center py-8 opacity-60">
								{#if grants.length === 0}
									No grants yet. Click “Add Grant” to create one.
								{:else}
									No grants match your search.
								{/if}
							</td>
						</tr>
					{/if}
					{#each filteredGrants as grant (grant._id)}
						<tr>
							<td>{grant.name}</td>
							<td>{grant.year}</td>
							<td>{formatDate(grant.releasedDate)}</td>
							<td>{grant.recipients ?? 0}</td>
							<td>
								<span class="badge {grant.isActive ? 'variant-filled-success' : 'variant-filled-surface'}">
									{grant.isActive ? 'Active' : 'Inactive'}
								</span>
							</td>
							<td class="text-center">
								<div class="flex gap-2 justify-center">
									<a
										class="btn btn-sm variant-filled-primary"
										href="/dashboard/grants/{grant._id}"
									>
										Recipients
									</a>
									<button
										class="btn btn-sm variant-filled"
										on:click={() => handleClickUpdate(grant)}
									>
										Update
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<Drawer>
	{#if $drawerStore.id === 'createGrant'}
		<Create {drawerStore} onSuccess={refreshList} />
	{:else if $drawerStore.id === 'updateGrant' && selectedGrant}
		<Update data={selectedGrant} {drawerStore} onSuccess={refreshList} />
	{/if}
</Drawer>
