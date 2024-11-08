<script lang="ts">
	import type { Barangay } from '$lib/utils/types';
	export let data: Barangay[];
	export let handleClickView: (item: Barangay) => void;
	export let handleClickUpdate: (item: Barangay) => void;
</script>

<div class="table-container">
	<table class="table table-hover">
		<thead>
			<tr>
				<th>Name</th>
				<th>Captain</th>
				<th>Phone</th>
				<th class="text-center">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each data as item, i}
				<tr>
					<td>{item.name}</td>
					<td>{item.fullName}</td>
					<td>{item.phone}</td>
					<td>
						<div class="flex flex-row gap-2 items-center justify-center">
							<button class="btn btn-sm variant-filled-primary" on:click={() => handleClickView(item)}>View</button>
							<button class="btn btn-sm variant-filled-secondary" on:click={() => handleClickUpdate(item)}	>Edit</button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
