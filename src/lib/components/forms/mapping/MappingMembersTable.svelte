<script lang="ts">
	import type { Dependents, Household, MappingHeadRow } from '$lib/utils/types';
	import { id, calculateAge } from '$lib/common/utils';
	import { emptySurvey, RELATIONSHIP_OPTIONS } from '$lib/utils/householdOptions';
	import { toDateInputValue } from '$lib/utils/dateInput';

	/** Row 1 — the head of the family (bind from the form). */
	export let head: MappingHeadRow;
	/** Names on row 1 are only editable when creating a household from the sheet. */
	export let headNamesEditable = false;
	/** Rows 2+ — the household members (bind from the form). */
	export let members: Dependents[] = [];
	/** Existing household records a member row can be linked to ("existing member"). */
	export let households: Household[] = [];

	// The sheet's "STATUS (PWD/SC)" column: two of the survey `categories` codes.
	const STATUS_CODES = ['PWD', 'SC'] as const;
	// "Head" is row 1, so members pick from the other relationships.
	const MEMBER_RELATIONSHIPS = RELATIONSHIP_OPTIONS.filter((o) => o.value !== '1');
	const COLUMN_COUNT = 11;

	// Which row's "link to existing" panel is open, and its search results.
	let linkPanel: Record<string, boolean> = {};
	let activeSearchIndex: number | null = null;
	let searchResults: Household[] = [];

	const toggleLinkPanel = (rowId: string) => {
		linkPanel = { ...linkPanel, [rowId]: !linkPanel[rowId] };
		activeSearchIndex = null;
		searchResults = [];
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
			isVoter: false,
			remarks: ''
		} as unknown as Dependents;
		members = [...members, member];
	};

	const removeMember = (index: number) => {
		members = members.filter((_, i) => i !== index);
		if (activeSearchIndex === index) {
			activeSearchIndex = null;
			searchResults = [];
		}
	};

	const upper = (value: string | undefined | null) => value?.toUpperCase() || '';

	const updateHeadNames = () => {
		head = {
			...head,
			firstName: upper(head.firstName),
			middleName: upper(head.middleName),
			lastName: upper(head.lastName)
		};
	};

	const updateFullName = (member: Dependents) => {
		member.firstName = upper(member.firstName);
		member.middleName = upper(member.middleName);
		member.lastName = upper(member.lastName);
		member.fullName = `${member.firstName} ${member.middleName} ${member.lastName}`
			.replace(/\s+/g, ' ')
			.trim();
		members = [...members];
	};

	// --- Link a member row to an existing household record -------------------
	const filterHouseholds = (query: string, index: number) => {
		activeSearchIndex = index;
		const term = query.trim().toLowerCase();
		if (!term) {
			searchResults = [];
			return;
		}
		searchResults = households
			.filter(
				(h) =>
					(h.fullName?.toLowerCase() || '').includes(term) ||
					(h.firstName?.toLowerCase() || '').includes(term) ||
					(h.lastName?.toLowerCase() || '').includes(term)
			)
			.slice(0, 5);
	};

	// Name, gender and birthday come from the linked record (and stay read-only
	// while linked), exactly as in the encoder's form.
	const linkToHousehold = (household: Household, index: number) => {
		const member = members[index];
		if (member) {
			member.linkedHouseholdId = household._id;
			member.firstName = household.firstName || '';
			member.middleName = household.middleName || '';
			member.lastName = household.lastName || '';
			member.fullName =
				household.fullName ||
				`${member.firstName} ${member.middleName} ${member.lastName}`.replace(/\s+/g, ' ').trim();
			member.dateOfBirth = toDateInputValue(household.dateOfBirth);
			member.gender = household.gender || 'MALE';
			member.isVoter = Boolean(household.isVoter);
			members = [...members];
		}
		activeSearchIndex = null;
		searchResults = [];
	};

	const clearLink = (index: number) => {
		const member = members[index];
		if (member) {
			member.linkedHouseholdId = '';
			member.firstName = '';
			member.middleName = '';
			member.lastName = '';
			member.fullName = '';
			member.dateOfBirth = '';
			member.gender = 'MALE';
			member.isVoter = false;
			members = [...members];
		}
	};

	const hasStatus = (row: { categories?: string[] }, code: string): boolean =>
		(row.categories ?? []).includes(code);

	// Deliberately not `bind:group`: Svelte rebuilds a bound group's array from
	// only the checkboxes in that group, which would drop the other categories the
	// encoder ticked (Youth / Single Parent / Pregnant Woman).
	const toggleStatus = (row: { categories?: string[] }, code: string, on: boolean) => {
		const current = row.categories ?? [];
		if (on) {
			if (!current.includes(code)) row.categories = [...current, code];
		} else {
			row.categories = current.filter((c) => c !== code);
		}
		head = head;
		members = [...members];
	};
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<h3 class="h4">Household Members ({members.length + 1})</h3>
			<p class="text-sm opacity-60">
				Row 1 is the head of the family. Add everyone else below — new, or linked to a person who
				already has a household record.
			</p>
		</div>
		<button type="button" class="btn btn-sm variant-filled-primary" on:click={addMember}>
			+ Add member
		</button>
	</div>

	<!-- Columns follow the paper sheet; scrolls sideways on narrow screens. -->
	<div class="table-container">
		<table class="table table-compact min-w-[64rem]">
			<thead>
				<tr>
					<th class="w-8">#</th>
					<th class="min-w-[8rem]">Given Name</th>
					<th class="min-w-[8rem]">Middle Name</th>
					<th class="min-w-[8rem]">Surname</th>
					<th>Gender</th>
					<th class="w-12 text-center">Age</th>
					<th class="min-w-[9.5rem]">Birthday</th>
					<th class="min-w-[8rem]">Relationship</th>
					<th class="whitespace-nowrap">Status (PWD/SC)</th>
					<th class="min-w-[12rem]">Remarks</th>
					<th class="text-center">Actions</th>
				</tr>
			</thead>
			<tbody>
				<!-- Row 1: head of the family. When editing an existing record the name is
				     the encoder's; disabled inputs keep the columns aligned. -->
				<tr class="bg-surface-100-800-token">
					<td class="align-middle">1</td>
					<td>
						<input
							class="input"
							type="text"
							placeholder="Given name"
							bind:value={head.firstName}
							on:change={updateHeadNames}
							disabled={!headNamesEditable}
							title={headNamesEditable ? '' : 'Set by the encoder'}
							required={headNamesEditable}
						/>
					</td>
					<td>
						<input
							class="input"
							type="text"
							placeholder="Middle"
							bind:value={head.middleName}
							on:change={updateHeadNames}
							disabled={!headNamesEditable}
							title={headNamesEditable ? '' : 'Set by the encoder'}
						/>
					</td>
					<td>
						<input
							class="input"
							type="text"
							placeholder="Surname"
							bind:value={head.lastName}
							on:change={updateHeadNames}
							disabled={!headNamesEditable}
							title={headNamesEditable ? '' : 'Set by the encoder'}
							required={headNamesEditable}
						/>
					</td>
					<td>
						<select class="select" bind:value={head.gender}>
							<option value="MALE">Male</option>
							<option value="FEMALE">Female</option>
						</select>
					</td>
					<td class="text-center align-middle">{calculateAge(head.dateOfBirth) || '—'}</td>
					<td><input class="input" type="date" bind:value={head.dateOfBirth} /></td>
					<td><input class="input" type="text" value="Head" disabled /></td>
					<td class="align-middle">
						<div class="flex gap-3 whitespace-nowrap">
							{#each STATUS_CODES as code (code)}
								<label class="flex items-center gap-1 text-sm">
									<input
										class="checkbox"
										type="checkbox"
										checked={hasStatus(head, code)}
										on:change={(e) => toggleStatus(head, code, e.currentTarget.checked)}
									/>
									<span>{code}</span>
								</label>
							{/each}
						</div>
					</td>
					<td
						><input class="input" type="text" placeholder="Remarks" bind:value={head.remarks} /></td
					>
					<td></td>
				</tr>

				{#each members as member, index (member._id)}
					{@const isLinked = Boolean(member.linkedHouseholdId)}
					<tr>
						<td class="align-middle">{index + 2}</td>
						<td>
							<input
								class="input"
								type="text"
								placeholder="Given name"
								bind:value={member.firstName}
								on:change={() => updateFullName(member)}
								disabled={isLinked}
								required
							/>
						</td>
						<td>
							<input
								class="input"
								type="text"
								placeholder="Middle"
								bind:value={member.middleName}
								on:change={() => updateFullName(member)}
								disabled={isLinked}
							/>
						</td>
						<td>
							<input
								class="input"
								type="text"
								placeholder="Surname"
								bind:value={member.lastName}
								on:change={() => updateFullName(member)}
								disabled={isLinked}
								required
							/>
						</td>
						<td>
							<select class="select" bind:value={member.gender} disabled={isLinked}>
								<option value="MALE">Male</option>
								<option value="FEMALE">Female</option>
							</select>
						</td>
						<td class="text-center align-middle">{calculateAge(member.dateOfBirth) || '—'}</td>
						<td>
							<input
								class="input"
								type="date"
								bind:value={member.dateOfBirth}
								disabled={isLinked}
							/>
						</td>
						<td>
							<select class="select" bind:value={member.relationshipToHead}>
								<option value="">—</option>
								{#each MEMBER_RELATIONSHIPS as o}<option value={o.value}>{o.label}</option>{/each}
							</select>
							{#if member.relationshipToHead === '4'}
								<input
									class="input mt-1"
									type="text"
									placeholder="Specify, e.g. GRANDCHILD"
									bind:value={member.relationshipOther}
								/>
							{/if}
						</td>
						<td class="align-middle">
							<div class="flex gap-3 whitespace-nowrap">
								{#each STATUS_CODES as code (code)}
									<label class="flex items-center gap-1 text-sm">
										<input
											class="checkbox"
											type="checkbox"
											checked={hasStatus(member, code)}
											on:change={(e) => toggleStatus(member, code, e.currentTarget.checked)}
										/>
										<span>{code}</span>
									</label>
								{/each}
							</div>
						</td>
						<td>
							<input class="input" type="text" placeholder="Remarks" bind:value={member.remarks} />
						</td>
						<td class="align-middle">
							<div class="flex gap-1 justify-center whitespace-nowrap">
								<button
									type="button"
									class="btn btn-sm {isLinked ? 'variant-filled-secondary' : 'variant-soft'}"
									on:click={() => toggleLinkPanel(member._id)}
									title="Link this row to a person who already has a household record"
								>
									{isLinked ? 'Linked' : 'Existing…'}
								</button>
								<button
									type="button"
									class="btn btn-sm variant-soft-error"
									on:click={() => removeMember(index)}
									disabled={isLinked}
									title={isLinked ? 'Clear the link first' : ''}
								>
									Remove
								</button>
							</div>
						</td>
					</tr>
					{#if linkPanel[member._id]}
						<tr>
							<td colspan={COLUMN_COUNT} class="bg-surface-100-800-token">
								<div class="p-3 relative">
									<span class="text-sm font-semibold"
										>Existing member — link to their household record</span
									>
									{#if isLinked}
										<div class="flex flex-wrap items-center gap-2 mt-1">
											<span class="text-sm">Linked to: {member.fullName}</span>
											<button
												type="button"
												class="btn btn-sm variant-filled-error"
												on:click={() => clearLink(index)}
											>
												Clear link
											</button>
										</div>
										<p class="text-xs opacity-60 mt-1">
											Name, gender and birthday are copied from that record. Clear the link to type
											them here.
										</p>
									{:else}
										<input
											class="input mt-1"
											type="text"
											placeholder="Search by name in this barangay…"
											on:input={(e) => filterHouseholds(e.currentTarget.value, index)}
										/>
										{#if activeSearchIndex === index && searchResults.length > 0}
											<div
												class="absolute z-50 left-3 right-3 bg-surface-100-800-token border border-surface-500-400-token rounded-md mt-1 max-h-48 overflow-y-auto"
											>
												{#each searchResults as household (household._id)}
													<button
														class="w-full text-left px-4 py-2 hover:bg-surface-hover-token"
														type="button"
														on:click={() => linkToHousehold(household, index)}
													>
														{household.fullName}
													</button>
												{/each}
											</div>
										{:else if activeSearchIndex === index && households.length === 0}
											<p class="text-xs opacity-60 mt-1">
												No other household records in this barangay yet.
											</p>
										{/if}
									{/if}
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>
