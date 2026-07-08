<script lang="ts">
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { submitJson } from '$lib/utils/apiHelper';

	export let drawerStore: DrawerStore;
	/** Called after a successful insert so the parent page can refresh its list. */
	export let onSuccess: (() => void) | undefined = undefined;

	const toastStore = getToastStore();
	const isFocused = true;
	let isSubmitting = false;

	let name = '';
	let year = new Date().getFullYear();
	let releasedDate = '';

	const handleSubmit = async () => {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const result = await submitJson('/api/admin/grant/insert', {
				name,
				year,
				releasedDate
			});
			onSuccess?.();
			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'Failed to create grant',
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
	<h2 class="h4">Create Grant</h2>
	<label class="label mt-4">
		<span>Name</span>
		<input
			class="input"
			type="text"
			placeholder="e.g. FINANCIAL ASSISTANCE"
			name="name"
			bind:value={name}
			required
		/>
	</label>
	<label class="label mt-4">
		<span>Year</span>
		<input class="input" type="number" name="year" min="1900" max="2100" bind:value={year} required />
	</label>
	<label class="label mt-4">
		<span>Released Date</span>
		<input class="input" type="date" name="releasedDate" bind:value={releasedDate} required />
	</label>
	<div class="flex gap-4 place-content-end w-full">
		<button type="submit" class="btn variant-filled-success mt-4" disabled={isSubmitting}>
			{isSubmitting ? 'Saving...' : 'Submit'}
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
