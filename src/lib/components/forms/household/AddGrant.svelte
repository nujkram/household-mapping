<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { submitJson } from '$lib/utils/apiHelper';
	import type { Grant, HouseholdGrant } from '$lib/utils/types';

	export let drawerStore: DrawerStore;
	export let householdId: string;
	export let householdName: string;
	/** Grants the household already received (excluded from the picker). */
	export let receivedGrants: HouseholdGrant[] = [];
	/** Called after a successful award so the parent page can refresh. */
	export let onSuccess: (() => void) | undefined = undefined;

	const toastStore = getToastStore();
	const isFocused = true;
	let isSubmitting = false;
	let isLoading = true;
	let selectedGrantId = '';
	let availableGrants: Grant[] = [];

	onMount(async () => {
		try {
			const response = await fetch('/api/admin/grant?active=1');
			const result = await response.json();
			const receivedIds = new Set(receivedGrants.map((g) => g.grantId));
			availableGrants = (result.response || []).filter((g: Grant) => !receivedIds.has(g._id));
		} catch (error) {
			showToast(toastStore, 'Failed to load grants', false);
			console.error(error);
		} finally {
			isLoading = false;
		}
	});

	const handleSubmit = async () => {
		if (isSubmitting || !selectedGrantId) return;
		isSubmitting = true;
		try {
			const result = await submitJson('/api/admin/household/grant/add', {
				householdId,
				grantId: selectedGrantId
			});
			onSuccess?.();
			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'Failed to add grant',
				false
			);
			console.error(error);
		} finally {
			isSubmitting = false;
		}
	};
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6"
	use:focusTrap={isFocused}
	on:submit|preventDefault={handleSubmit}
>
	<h2 class="h4">Add Grant to {householdName}</h2>

	{#if isLoading}
		<div class="placeholder animate-pulse mt-4"></div>
	{:else if availableGrants.length === 0}
		<p class="mt-4 opacity-60">
			No grants available — this household has received every active grant, or none exist yet.
		</p>
	{:else}
		<label class="label mt-4">
			<span>Grant</span>
			<select class="select" bind:value={selectedGrantId} required>
				<option value="">Select a grant</option>
				{#each availableGrants as grant (grant._id)}
					<option value={grant._id}>{grant.name} ({grant.year})</option>
				{/each}
			</select>
		</label>
	{/if}

	<div class="flex gap-4 place-content-end w-full">
		<button
			type="submit"
			class="btn variant-filled-success mt-4"
			disabled={isSubmitting || isLoading || availableGrants.length === 0}
		>
			{isSubmitting ? 'Saving...' : 'Add Grant'}
		</button>
		<button
			type="button"
			class="btn variant-filled mt-4"
			disabled={isSubmitting}
			on:click={() => drawerStore.close()}
		>
			Cancel
		</button>
	</div>
</form>
