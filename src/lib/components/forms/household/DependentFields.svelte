<script lang="ts">
	import type { Household, Dependents } from '$lib/utils/types';
	import SurveyFields from './SurveyFields.svelte';

	/** The dependent rows being edited (bind this from the parent form). */
	export let dependentFields: Dependents[] = [];
	/** Households a dependent can be linked to (parent excludes the current one). */
	export let households: Household[] = [];

	// Which dependent's search box is active, and its current results — tracked
	// per index so typing in one dependent's box doesn't open dropdowns in all.
	let activeSearchIndex: number | null = null;
	let searchResults: Household[] = [];

	/** Normalize any stored date into the yyyy-MM-dd shape <input type="date"> needs. */
	const toDateInputValue = (value: string | Date | null | undefined): string => {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
		return date.toISOString().slice(0, 10);
	};

	const filterHouseholds = (query: string, index: number) => {
		activeSearchIndex = index;
		if (!query?.trim()) {
			searchResults = [];
			return;
		}
		const term = query.toLowerCase();
		searchResults = households
			.filter(
				(h) =>
					(h.fullName?.toLowerCase() || '').includes(term) ||
					(h.firstName?.toLowerCase() || '').includes(term) ||
					(h.lastName?.toLowerCase() || '').includes(term)
			)
			.slice(0, 5); // Limit to 5 results
	};

	const applyHouseholdToDependent = (household: Household, index: number) => {
		const dependent = dependentFields[index];
		if (dependent) {
			dependent.linkedHouseholdId = household._id;
			dependent.firstName = household.firstName || '';
			dependent.middleName = household.middleName || '';
			dependent.lastName = household.lastName || '';
			dependent.fullName =
				household.fullName ||
				`${dependent.firstName} ${dependent.middleName} ${dependent.lastName}`
					.replace(/\s+/g, ' ')
					.trim();
			dependent.dateOfBirth = toDateInputValue(household.dateOfBirth);
			dependent.gender = household.gender || 'MALE';
			dependent.isVoter = Boolean(household.isVoter);
			// Reassign so Svelte re-renders the bound inputs with the new values.
			dependentFields = [...dependentFields];
		}
		activeSearchIndex = null;
		searchResults = [];
	};

	const clearHouseholdLink = (index: number) => {
		const dependent = dependentFields[index];
		if (dependent) {
			dependent.linkedHouseholdId = '';
			dependent.firstName = '';
			dependent.middleName = '';
			dependent.lastName = '';
			dependent.fullName = '';
			dependent.dateOfBirth = '';
			dependent.gender = 'MALE';
			dependent.isVoter = false;
			dependentFields = [...dependentFields];
		}
	};

	const updateDependentFullName = (dependent: Dependents) => {
		dependent.firstName = dependent.firstName?.toUpperCase() || '';
		dependent.middleName = dependent.middleName?.toUpperCase() || '';
		dependent.lastName = dependent.lastName?.toUpperCase() || '';
		dependent.fullName = `${dependent.firstName} ${dependent.middleName} ${dependent.lastName}`
			.replace(/\s+/g, ' ')
			.trim();
		dependentFields = [...dependentFields];
	};
</script>

{#if dependentFields.length > 0}
	<div class="col-span-2 space-y-4">
		<h3 class="h3 mb-4">Dependent Details</h3>
		{#each dependentFields as dependent, index (dependent._id)}
			{@const isLinked = Boolean(dependent.linkedHouseholdId)}
			<div class="card p-4 mb-4">
				<h4 class="h4 mb-2">Dependent {index + 1}</h4>
				<div class="label col-span-2 relative mb-4">
					<span>Link to Existing Household (Optional)</span>
					{#if isLinked}
						<div class="flex items-center gap-2 mt-2">
							<span class="text-sm">Linked to: {dependent.fullName}</span>
							<button
								type="button"
								class="btn btn-sm variant-filled-error"
								on:click={() => clearHouseholdLink(index)}
							>
								Clear Link
							</button>
						</div>
						<p class="text-xs opacity-60 mt-1">
							Fields are synced from the linked household — clear the link to edit them manually.
						</p>
					{:else}
						<input
							class="input"
							type="text"
							placeholder="Search for household..."
							on:input={(e) => filterHouseholds(e.currentTarget.value, index)}
						/>

						{#if activeSearchIndex === index && searchResults.length > 0}
							<div
								class="absolute z-50 w-full bg-surface-100-800-token border border-surface-500-400-token rounded-md mt-1 max-h-48 overflow-y-auto"
							>
								{#each searchResults as household (household._id)}
									<button
										class="w-full text-left px-4 py-2 hover:bg-surface-hover-token"
										type="button"
										on:click={() => applyHouseholdToDependent(household, index)}
									>
										{household.fullName}
									</button>
								{/each}
							</div>
						{/if}
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-2" class:opacity-70={isLinked}>
					<label class="label">
						<span>First Name</span>
						<input
							class="input"
							type="text"
							placeholder="First Name"
							bind:value={dependent.firstName}
							on:change={() => updateDependentFullName(dependent)}
							disabled={isLinked}
							required
						/>
					</label>

					<label class="label">
						<span>Middle Name</span>
						<input
							class="input"
							type="text"
							placeholder="Middle Name"
							bind:value={dependent.middleName}
							on:change={() => updateDependentFullName(dependent)}
							disabled={isLinked}
						/>
					</label>

					<label class="label">
						<span>Last Name</span>
						<input
							class="input"
							type="text"
							placeholder="Last Name"
							bind:value={dependent.lastName}
							on:change={() => updateDependentFullName(dependent)}
							disabled={isLinked}
							required
						/>
					</label>

					<label class="label">
						<span>Gender</span>
						<select class="select" bind:value={dependent.gender} disabled={isLinked}>
							<option value="MALE">Male</option>
							<option value="FEMALE">Female</option>
						</select>
					</label>

					<label class="label">
						<span>Date of Birth</span>
						<input
							class="input"
							type="date"
							bind:value={dependent.dateOfBirth}
							disabled={isLinked}
							required
						/>
					</label>

					<label class="label flex items-center gap-2">
						<span>Is Voter</span>
						<input
							class="input w-4"
							type="checkbox"
							bind:checked={dependent.isVoter}
							disabled={isLinked}
						/>
					</label>
				</div>

				<!-- Same optional survey section as the head of household -->
				<div class="mt-3">
					<SurveyFields survey={dependent} title="Additional Details for this dependent" compact />
				</div>
			</div>
		{/each}
	</div>
{/if}
