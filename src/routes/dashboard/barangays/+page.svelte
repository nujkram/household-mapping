<script lang="ts">
	import { goto } from '$app/navigation';
	import TableBarangay from './table-barangay.svelte';
	import { Drawer, getDrawerStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import Create from '$lib/components/forms/barangay/Create.svelte';
	import Update from '$lib/components/forms/barangay/Update.svelte';
	import { barangayStore } from '$lib/stores/barangayStore';
	import type { Barangay } from '$lib/utils/types';
	export let data: any;

	let isReady: boolean;
	let keyword: string;
	let selectedItem: Barangay;

	// drawer settings
	const drawerCreate: DrawerSettings = {
		id: 'create',
		// Provide your property overrides:
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerUpdate: DrawerSettings = {
		id: 'update',
		width: 'w-[280px] md:w-full',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const handleClickView = (item: any): void => {
		selectedItem = item;
		goto(`/dashboard/barangays/${item._id}`);
	};

	const handleClickUpdate = (item: any): void => {
		selectedItem = item;
		drawerStore.open(drawerUpdate);
	};

	const drawerStore = getDrawerStore();
	drawerStore.close();

	$: isReady = data !== undefined;
	$: if (data?.barangays) barangayStore.set(data.barangays);
</script>

<div class="card mb-4">
	<header class="card-header">
		<h1 class="h3">Barangays</h1>
	</header>
	{#if !isReady}
		<section class="flex p-4 w-full gap-12 items-center">
			<div class="placeholder-circle animate-pulse w-32 h-10" />
			<div class="placeholder animate-pulse w-full" />
		</section>
	{:else}
		<section class="flex p-4 w-full gap-4">
			<button class="btn variant-filled-primary" on:click={() => drawerStore.open(drawerCreate)}
				>Add Barangay</button
			>
			<input class="input ml-auto" type="text" placeholder="Search" bind:value={keyword} />
		</section>
	{/if}
</div>
{#if isReady}
	{#key $barangayStore}
		<TableBarangay data={$barangayStore} {handleClickView} {handleClickUpdate} />
	{/key}
{:else}
	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Address</th>
				<th>Phone</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><div class="placeholder animate-pulse"></div></td>
				<td><div class="placeholder animate-pulse"></div></td>
				<td><div class="placeholder animate-pulse"></div></td>
				<td><div class="placeholder animate-pulse"></div></td>
			</tr>
		</tbody>
	</table>
{/if}

<Drawer>
	{#if $drawerStore.id === 'create'}
		<Create {drawerStore} />
	{:else if $drawerStore.id === 'update'}
		<Update data={selectedItem} {drawerStore} />
	{/if}
</Drawer>
