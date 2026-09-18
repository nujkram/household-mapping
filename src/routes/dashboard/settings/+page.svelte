<script lang="ts">
	import { getToastStore } from '@skeletonlabs/skeleton';
	import { invalidateAll } from '$app/navigation';
	import { submitJson } from '$lib/utils/apiHelper';
	import { showToast } from '$lib/utils/toastHelper';

	export let data;

	const toastStore = getToastStore();

	let encoderTagging = data.settings.encoderTagging;
	let isSaving = false;

	// Optimistic flip → POST → roll back on failure, mirroring handleSetTag in
	// dashboard/households/+page.svelte. Driven by on:change rather than
	// bind:checked so the rollback actually sticks to the rendered checkbox.
	const save = async (next: boolean) => {
		const previous = encoderTagging;
		encoderTagging = next;
		isSaving = true;
		try {
			const result = await submitJson('/api/admin/settings', { encoderTagging: next });
			showToast(toastStore, result.message, true);
			// Re-pull layout data so $page.data.encoderTagging — and every tag UI
			// derived from it — is correct without a hard reload.
			await invalidateAll();
		} catch (error) {
			encoderTagging = previous;
			showToast(
				toastStore,
				error instanceof Error ? error.message : 'Failed to save settings',
				false
			);
			console.error(error);
		} finally {
			isSaving = false;
		}
	};
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<div class="container mx-auto p-4">
	<div class="card p-4">
		<header class="card-header">
			<h1 class="h3">Settings</h1>
		</header>

		<div class="p-4 space-y-4">
			<section>
				<h2 class="h4 mb-2">Household tagging</h2>
				<label class="flex items-start gap-3">
					<input
						class="checkbox mt-1"
						type="checkbox"
						checked={encoderTagging}
						disabled={isSaving}
						on:change={(e) => save(e.currentTarget.checked)}
					/>
					<span>
						<span class="font-semibold">Allow encoders to tag households</span>
						<span class="block text-sm opacity-70">
							Encoders can view and set household tags (APIN / KONTRA / UNTAGGED). Administrators
							can always tag, regardless of this setting.
						</span>
					</span>
				</label>
			</section>
		</div>
	</div>
</div>
