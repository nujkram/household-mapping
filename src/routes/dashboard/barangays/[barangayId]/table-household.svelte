<script lang="ts">
	import type { Household } from '$lib/utils/types';
	import { calculateAge } from '$lib/common/utils';
	import { barangayStore } from '$lib/stores/barangayStore';

	export let data: Household[] = [];
	export let handleClickView: (item: Household) => void;
	export let handleClickUpdate: (item: Household) => void;

	// Make the table reactive to store changes and ensure it's always an array
	$: households = Array.isArray(data) ? data : [];
</script>

<div class="table-container">
	<table class="table table-hover">
		<thead>
			<tr>
				<th>Name</th>
				<th>Gender</th>
				<th>Date of Birth</th>
				<th>Age</th>
				<th>Phone</th>
				<th>Dependents</th>
				<th class="text-center">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each households as item, i}
				<tr>
					<td>{item.fullName}</td>
					<td>{item.gender}</td>
					<td>{item.dateOfBirth}</td>
					<td>{calculateAge(item.dateOfBirth)}</td>
					<td>{item.phone}</td>
					<td>{item.dependents}</td>
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
