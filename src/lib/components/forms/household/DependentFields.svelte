<script lang="ts">
	import type { Household, Dependents } from '$lib/utils/types';
	import SurveyFields from './SurveyFields.svelte';
	import { id } from '$lib/common/utils';
	import { emptySurvey, RELATIONSHIP_OPTIONS } from '$lib/utils/householdOptions';

	/** The member rows being edited (bind this from the parent form). */
	export let dependentFields: Dependents[] = [];
	/** Households a member can be linked to (parent excludes the current one). */
	export let households: Household[] = [];

	// Which row's link search is active + its results (per-index so one row's
	// dropdown doesn't open under all rows).
	let activeSearchIndex: number | null = null;
	let searchResults: Household[] = [];
	// Which rows have their "Details" expander open, keyed by member _id.
	let expanded: Record<string, boolean> = {};

	const toggleExpand = (rowId: string) => {
		expanded = { ...expanded, [rowId]: !expanded[rowId] };
	};

	const addMember = () => {
		const member = {
			...emptySurvey(),
			_id: id(),
			householdId: '',
			linkedHouseholdId: '',
			firstName: '',
			middleName: '',
			lastName: '',
			fullName: '',
			dateOfBirth: '',
			gender: 'MALE',
			isVoter: false
		} as unknown as Dependents;
		dependentFields = [...dependentFields, member];
	};

	const removeMember = (index: number) => {
		dependentFields = dependentFields.filter((_, i) => i !== index);
		if (activeSearchIndex === index) {
			activeSearchIndex = null;
			searchResults = [];
		}
	};

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
			.slice(0, 5);
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

<div class="col-span-2 space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<h3 class="h4">Household Members ({dependentFields.length})</h3>
			<p class="text-sm opacity-60">
				List everyone living in this household. Use “Details” for more about a person.
			</p>
		</div>
		<button type="button" class="btn btn-sm variant-filled-primary" on:click={addMember}>
			+ Add member
		</button>
	</div>

	{#if dependentFields.length === 0}
		<p class="opacity-60 text-sm py-3">No members added yet — press <strong>+ Add member</strong>.</p>
	{:else}
		<div class="table-container">
			<table class="table">
				<thead>
					<tr>
						<th class="w-8">#</th>
						<th>First Name</th>
						<th>Last Name</th>
						<th>Relationship</th>
						<th>Gender</th>
						<th>Date of Birth</th>
						<th class="text-center">Voter</th>
						<th class="text-center">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each dependentFields as dependent, index (dependent._id)}
						{@const isLinked = Boolean(dependent.linkedHouseholdId)}
						<tr>
							<td class="align-middle">{index + 1}</td>
							<td>
								<input
									class="input"
									type="text"
									placeholder="First"
									bind:value={dependent.firstName}
									on:change={() => updateDependentFullName(dependent)}
									disabled={isLinked}
									required
								/>
							</td>
							<td>
								<input
									class="input"
									type="text"
									placeholder="Last"
									bind:value={dependent.lastName}
									on:change={() => updateDependentFullName(dependent)}
									disabled={isLinked}
									required
								/>
							</td>
							<td>
								<select class="select" bind:value={dependent.relationshipToHead}>
									<option value="">—</option>
									{#each RELATIONSHIP_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
								</select>
							</td>
							<td>
								<select class="select" bind:value={dependent.gender} disabled={isLinked}>
									<option value="MALE">Male</option>
									<option value="FEMALE">Female</option>
								</select>
							</td>
							<td>
								<input
									class="input"
									type="date"
									bind:value={dependent.dateOfBirth}
									disabled={isLinked}
								/>
							</td>
							<td class="text-center align-middle">
								<input class="checkbox" type="checkbox" bind:checked={dependent.isVoter} disabled={isLinked} />
							</td>
							<td class="align-middle">
								<div class="flex gap-1 justify-center whitespace-nowrap">
									<button
										type="button"
										class="btn btn-sm variant-soft"
										on:click={() => toggleExpand(dependent._id)}
									>
										Details {expanded[dependent._id] ? '▴' : '▾'}
									</button>
									<button
										type="button"
										class="btn btn-sm variant-soft-error"
										on:click={() => removeMember(index)}
									>
										Remove
									</button>
								</div>
							</td>
						</tr>
						{#if expanded[dependent._id]}
							<tr>
								<td colspan="8" class="bg-surface-100-800-token">
									<div class="p-3 space-y-4">
										<!-- Link to an existing household record -->
										<div class="relative">
											<span class="text-sm font-semibold">Link to an existing household (optional)</span>
											{#if isLinked}
												<div class="flex items-center gap-2 mt-1">
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
													Name, gender, birth date and voter status are copied from the linked
													household. Clear the link to edit them here.
												</p>
											{:else}
												<input
													class="input mt-1"
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

										<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
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
											{#if dependent.relationshipToHead === '4'}
												<label class="label">
													<span>Specify Relation</span>
													<input
														class="input"
														type="text"
														placeholder="e.g. GRANDCHILD"
														bind:value={dependent.relationshipOther}
													/>
												</label>
											{/if}
										</div>

										<SurveyFields
											survey={dependent}
											title="More details for this member"
											compact
											hideRelationship
										/>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
