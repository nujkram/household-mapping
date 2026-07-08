<script lang="ts">
	import type { Household } from '$lib/utils/types';
	import { calculateAge } from '$lib/common/utils';
	import { getToastStore } from '@skeletonlabs/skeleton';
	import { debounce } from '$lib/utils/debounce';

	export let data: Household[] = [];
	export let handleClickView: (item: Household) => void;
	export let handleClickUpdate: (item: Household) => void;

	const toastStore = getToastStore();
	let selectedHousehold: any = null;
	let isDropdownOpen = false;
	let isProcessing = false;

	// Search input is debounced so the table isn't re-filtered per keystroke.
	let searchInput = '';
	let searchQuery = '';
	const applySearch = debounce((value: string) => (searchQuery = value), 250);
	$: applySearch(searchInput);

	let selectedTag: 'APIN' | 'KONTRA' | 'UNTAGGED' | '' = '';

	// Filter households based on search query and tag
	$: filteredHouseholds = (Array.isArray(data) ? data : []).filter((household: Household) => {
		const matchesSearch =
			!searchQuery || (household.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase());

		const matchesTag = !selectedTag || household.tag === selectedTag;

		return matchesSearch && matchesTag;
	});

	async function handleSetTag(household: Household, tag: 'APIN' | 'KONTRA' | 'UNTAGGED') {
		isProcessing = true;
		// Optimistically update the row; roll back if the server rejects it.
		const previousTag = household.tag;
		data = data.map((h) => (h._id === household._id ? { ...h, tag } : h));

		try {
			const response = await fetch('/api/admin/household/set-tag', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					householdId: household._id,
					tag
				})
			});

			const result = await response.json();
			if (response.ok) {
				// Close dropdown
				isDropdownOpen = false;
				selectedHousehold = null;

				// Show success toast
				toastStore.trigger({
					message: `Successfully tagged as ${tag}`,
					background: 'variant-filled-success'
				});
			} else {
				throw new Error(result.error || 'Failed to update tag');
			}
		} catch (error) {
			// Roll back the optimistic change.
			data = data.map((h) => (h._id === household._id ? { ...h, tag: previousTag } : h));
			console.error('Error setting tag:', error);
			toastStore.trigger({
				message: error instanceof Error ? error.message : 'Failed to update tag',
				background: 'variant-filled-error'
			});
		} finally {
			isProcessing = false;
		}
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.tag-dropdown')) {
			isDropdownOpen = false;
			selectedHousehold = null;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<!-- Add filters above the table -->
<div class="flex flex-wrap gap-4 mb-4">
	<!-- Search input -->
	<div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
		<div class="input-group-shim">🔍</div>
		<input
			type="search"
			bind:value={searchInput}
			placeholder="Search by name..."
			class="input"
		/>
	</div>

	<!-- Tag filter -->
	<select
		bind:value={selectedTag}
		class="select"
	>
		<option value="">All Tags</option>
		<option value="APIN">APIN</option>
		<option value="KONTRA">KONTRA</option>
		<option value="UNTAGGED">UNTAGGED</option>
	</select>
</div>

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
				<th>Tag</th>
				<th class="text-center">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#if filteredHouseholds.length === 0}
				<tr>
					<td colspan="8" class="text-center py-8 opacity-60">
						{#if (data?.length ?? 0) === 0}
							No households in this barangay yet.
						{:else}
							No households match your search or filters.
						{/if}
					</td>
				</tr>
			{/if}
			{#each filteredHouseholds as item, i}
				<tr>
					<td>{item.fullName}</td>
					<td>{item.gender || ''}</td>
					<td>{item.dateOfBirth || ''}</td>
					<td>{calculateAge(item.dateOfBirth) || ''}</td>
					<td>{item.phone || ''}</td>
					<td>{item.dependents || ''}</td>
					<td>
						<div class="relative tag-dropdown">
							<button
								class="btn btn-sm {item.tag === 'UNTAGGED'
									? 'variant-filled-surface'
									: item.tag === 'APIN'
										? 'variant-filled-success'
										: 'variant-filled-error'}"
								on:click|stopPropagation={() => {
									selectedHousehold = item;
									isDropdownOpen = !isDropdownOpen;
								}}
								disabled={isProcessing}
							>
								{isProcessing ? 'Processing...' : item.tag || 'Tag'}
							</button>

							{#if isDropdownOpen && selectedHousehold?._id === item._id}
								<div
									class="absolute z-50 mt-1 w-32 bg-surface-100-800-token shadow-lg rounded-lg overflow-hidden"
								>
									<button
										class="w-full px-4 py-2 text-left hover:bg-surface-hover-token {item.tag ===
										'APIN'
											? 'bg-success-500/20'
											: ''}"
										on:click={() => handleSetTag(item, 'APIN')}
									>
										APIN
									</button>
									<button
										class="w-full px-4 py-2 text-left hover:bg-surface-hover-token {item.tag ===
										'KONTRA'
											? 'bg-error-500/20'
											: ''}"
										on:click={() => handleSetTag(item, 'KONTRA')}
									>
										KONTRA
									</button>
									<button
										class="w-full px-4 py-2 text-left hover:bg-surface-hover-token {item.tag ===
										'UNTAGGED'
											? 'bg-surface-500/20'
											: ''}"
										on:click={() => handleSetTag(item, 'UNTAGGED')}
									>
										Untag
									</button>
								</div>
							{/if}
						</div>
					</td>
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
