<script lang="ts">
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { submitJson } from '$lib/utils/apiHelper';
	import type { Grant } from '$lib/utils/types';

	export let drawerStore: DrawerStore;
	export let data: Grant;
	/** Called after a successful update so the parent page can refresh its list. */
	export let onSuccess: (() => void) | undefined = undefined;

	const toastStore = getToastStore();
	const isFocused = true;
	let isSubmitting = false;

	// Local copy so cancelling doesn't leave half-edited values in the table.
	let name = data.name;
	let year = data.year;
	let releasedDate = (data.releasedDate || '').slice(0, 10);
	let isActive = data.isActive;

	const handleSubmit = async () => {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const result = await submitJson('/api/admin/grant/update', {
				_id: data._id,
				name,
				year,
				releasedDate,
				isActive
			});
			onSuccess?.();
			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'Failed to update grant',
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
	<h2 class="h4">Update Grant {data.name}</h2>
	<label class="label mt-4">
		<span>Name</span>
		<input class="input" type="text" placeholder="Grant name" bind:value={name} required />
	</label>
	<label class="label mt-4">
		<span>Year</span>
		<input class="input" type="number" min="1900" max="2100" bind:value={year} required />
	</label>
	<label class="label mt-4">
		<span>Released Date</span>
		<input class="input" type="date" bind:value={releasedDate} required />
	</label>
	<label class="label mt-4 flex items-center gap-2">
		<span>Active (can still be awarded)</span>
		<input class="input w-4" type="checkbox" bind:checked={isActive} />
	</label>
	<div class="flex gap-4 place-content-end w-full">
		<button type="submit" class="btn variant-filled-success mt-4" disabled={isSubmitting}>
			{isSubmitting ? 'Updating...' : 'Update'}
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
