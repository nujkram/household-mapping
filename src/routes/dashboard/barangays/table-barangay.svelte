<script lang="ts">
	import type { Barangay } from '$lib/utils/types';
	import { clusterLabel, resolveClusterId } from '$lib/utils/clusters';
	import { psgcCodesForName } from '$lib/utils/psgc';
	export let data: Barangay[];

	/** Stored barangay code, or the register match for the name. */
	const psgcCode = (b: Barangay): string =>
		b.barangayCode || psgcCodesForName(b.name).barangayCode;
	export let handleClickView: (item: Barangay) => void;
	export let handleClickUpdate: (item: Barangay) => void;
</script>

<div class="table-container">
	<table class="table table-hover">
		<thead>
			<tr>
				<th>Name</th>
				<th>PSGC Code</th>
				<th>Cluster</th>
				<th>Captain</th>
				<th>Phone</th>
				<th class="text-center">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#if data.length === 0}
				<tr>
					<td colspan="6" class="text-center py-8 opacity-60">No barangays yet.</td>
				</tr>
			{/if}
			{#each data as item, i}
				<tr>
					<td>{item.name}</td>
					<td>
						{#if psgcCode(item)}
							<span class="font-mono text-sm">{psgcCode(item)}</span>
						{:else}
							<span class="opacity-40">—</span>
						{/if}
					</td>
					<td>
						{#if resolveClusterId(item)}
							<span class="badge variant-soft">{clusterLabel(resolveClusterId(item))}</span>
						{:else}
							<span class="opacity-40">—</span>
						{/if}
					</td>
					<td>{item.fullName}</td>
					<td>{item.phone}</td>
					<td>
						<div class="flex flex-row gap-2 items-center justify-center">
							<button
								class="btn btn-sm variant-filled-primary"
								on:click={() => handleClickView(item)}>View</button
							>
							<button
								class="btn btn-sm variant-filled-secondary"
								on:click={() => handleClickUpdate(item)}>Edit</button
							>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
