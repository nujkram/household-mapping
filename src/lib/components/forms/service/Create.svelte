<script lang="ts">
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { submitJson } from '$lib/utils/apiHelper';
	import { SERVICE_CATEGORY_OPTIONS } from '$lib/utils/serviceOptions';

	export let drawerStore: DrawerStore;
	/** Household this service is recorded against (from the households flow). */
	export let householdId = '';
	/** Prefilled patient name (usually the household head). Still editable. */
	export let patientName = '';
	/** Called after a successful insert so the parent page can refresh. */
	export let onSuccess: (() => void) | undefined = undefined;

	const toastStore = getToastStore();
	const isFocused = true;
	let isSubmitting = false;

	let categories: string[] = [];
	let amount: number | null = null;
	let dateReceived = '';

	const handleSubmit = async () => {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const result = await submitJson('/api/admin/service/insert', {
				householdId,
				patientName,
				categories,
				amount,
				dateReceived
			});
			onSuccess?.();
			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'Failed to record service',
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
	<h2 class="h4">Record Service</h2>
	<label class="label mt-4">
		<span>Name of Patient</span>
		<input
			class="input"
			type="text"
			placeholder="Patient name"
			bind:value={patientName}
			required
		/>
	</label>

	<div class="label mt-4">
		<span>Category <span class="opacity-60">(check all that apply)</span></span>
		<div class="flex flex-wrap gap-4 mt-1">
			{#each SERVICE_CATEGORY_OPTIONS as o}
				<label class="flex items-center gap-2">
					<input class="checkbox" type="checkbox" value={o.value} bind:group={categories} />
					<span>{o.label}</span>
				</label>
			{/each}
		</div>
	</div>

	<label class="label mt-4">
		<span>Amount (₱)</span>
		<input class="input" type="number" min="0" step="any" placeholder="e.g. 500" bind:value={amount} required />
	</label>
	<label class="label mt-4">
		<span>Date Received</span>
		<input class="input" type="date" bind:value={dateReceived} required />
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
