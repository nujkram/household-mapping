<script lang="ts">
	import { CLUSTER_OPTIONS } from '$lib/utils/clusters';
	import type { ScopeMode } from '$lib/utils/clusters';
	import type { Barangay } from '$lib/utils/types';

	/** Which scoping rule applies to this encoder. */
	export let scopeMode: ScopeMode = 'CLUSTER';
	/** Used in CLUSTER mode; '' means all clusters. */
	export let cluster = '';
	/** Used in BARANGAYS mode. */
	export let barangayIds: string[] = [];
	/** All selectable barangays, already loaded by the parent form. */
	export let barangays: Barangay[] = [];

	let search = '';

	$: filtered = search.trim()
		? barangays.filter((b) => (b.name || '').toLowerCase().includes(search.trim().toLowerCase()))
		: barangays;

	const toggle = (id: string, checked: boolean) => {
		// Reassign rather than mutate so Svelte sees the change.
		barangayIds = checked ? [...barangayIds, id] : barangayIds.filter((b) => b !== id);
	};

	// Select/clear act on what's currently visible, so a search narrows them.
	const selectVisible = () => {
		const ids = filtered.map((b) => b._id);
		barangayIds = [...new Set([...barangayIds, ...ids])];
	};
	const clearVisible = () => {
		const ids = new Set(filtered.map((b) => b._id));
		barangayIds = barangayIds.filter((b) => !ids.has(b));
	};
</script>

<div class="mt-4 card variant-soft p-4 space-y-3">
	<span class="font-semibold">Household access</span>

	<label class="flex items-center gap-2">
		<input class="radio" type="radio" value="CLUSTER" bind:group={scopeMode} />
		<span>By cluster</span>
	</label>
	<label class="flex items-center gap-2">
		<input class="radio" type="radio" value="BARANGAYS" bind:group={scopeMode} />
		<span>By assigned barangays</span>
	</label>

	{#if scopeMode === 'CLUSTER'}
		<label class="label">
			<span>Assigned Cluster</span>
			<select class="select" bind:value={cluster}>
				<option value="">All clusters (no restriction)</option>
				{#each CLUSTER_OPTIONS as c}
					<option value={c.value}>{c.label}</option>
				{/each}
			</select>
			<span class="text-xs opacity-60">Encoder will only see households in this cluster.</span>
		</label>
	{:else}
		<div class="space-y-2">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<span class="text-sm">
					<strong>{barangayIds.length}</strong> of {barangays.length} selected
				</span>
				<div class="flex gap-2">
					<button type="button" class="btn btn-sm variant-soft" on:click={selectVisible}>
						Select shown
					</button>
					<button type="button" class="btn btn-sm variant-soft" on:click={clearVisible}>
						Clear shown
					</button>
				</div>
			</div>

			<input class="input" type="search" placeholder="Search barangays..." bind:value={search} />

			<div class="max-h-56 overflow-y-auto rounded border border-surface-500/30 p-2 space-y-1">
				{#each filtered as b (b._id)}
					<label class="flex items-center gap-2">
						<input
							class="checkbox"
							type="checkbox"
							checked={barangayIds.includes(b._id)}
							on:change={(e) => toggle(b._id, e.currentTarget.checked)}
						/>
						<span>{b.name}</span>
					</label>
				{:else}
					<p class="text-sm opacity-60 p-2">No barangays match your search.</p>
				{/each}
			</div>

			{#if barangayIds.length === 0}
				<p class="text-xs text-warning-500">
					No barangays selected — this encoder will not see any households until you assign some.
				</p>
			{:else}
				<span class="text-xs opacity-60">
					Encoder will only see households in the barangays ticked above.
				</span>
			{/if}
		</div>
	{/if}
</div>
