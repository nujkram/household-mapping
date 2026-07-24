<script lang="ts">
	import {
		SOCIOECONOMIC_OPTIONS,
		RELATIONSHIP_OPTIONS,
		CIVIL_STATUS_OPTIONS,
		EDUCATIONAL_OPTIONS,
		YES_NO_OPTIONS,
		MEMBERSHIP_TYPE_OPTIONS,
		CATEGORY_OPTIONS,
		HOUSING_TYPE_OPTIONS,
		HOUSING_MATERIALS_OPTIONS,
		LAND_OWNERSHIP_OPTIONS,
		type HouseholdSurvey
	} from '$lib/utils/householdOptions';

	/** Bound survey object (see emptySurvey()/surveyFrom()). All fields optional.
	 * Accepts a household or a dependent — both carry the same survey keys. */
	export let survey: HouseholdSurvey | Record<string, any>;
	/** Heading, e.g. "Additional Details" or a dependent-specific label. */
	export let title = 'Additional Details';
	/** Compact mode (used inside dependent cards): no divider, smaller heading. */
	export let compact = false;
	/** Hide the relationship-to-head field (members show it as a table column). */
	export let hideRelationship = false;
</script>

<div class="col-span-2 space-y-4">
	{#if !compact}
		<hr />
	{/if}
	<details class="space-y-4">
		<summary class="cursor-pointer select-none {compact ? 'h6 font-semibold' : 'h4'} py-1">
			{title}
			<span class="text-sm opacity-60 font-normal">(optional — fill what you know)</span>
		</summary>

		<!-- Visit & Background -->
		<h5 class="h5 opacity-70 mt-2">Visit & Background</h5>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
			<label class="label">
				<span>Date of Visit</span>
				<input class="input" type="date" bind:value={survey.dateOfVisit} />
			</label>
			<label class="label">
				<span>Sitio</span>
				<input class="input" type="text" placeholder="Sitio" bind:value={survey.sitio} />
			</label>
			<label class="label">
				<span>Ethnicity</span>
				<input class="input" type="text" placeholder="Ethnicity" bind:value={survey.ethnicity} />
			</label>
			<label class="label">
				<span>Socioeconomic Status</span>
				<select class="select" bind:value={survey.socioeconomicStatus}>
					<option value="">Not answered</option>
					{#each SOCIOECONOMIC_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
				</select>
			</label>
			{#if !hideRelationship}
				<label class="label">
					<span>Relationship to Household Head</span>
					<select class="select" bind:value={survey.relationshipToHead}>
						<option value="">Not answered</option>
						{#each RELATIONSHIP_OPTIONS as o}<option value={o.value}>{o.value} — {o.label}</option>{/each}
					</select>
				</label>
				{#if survey.relationshipToHead === '4'}
					<label class="label">
						<span>Specify Relation</span>
						<input
							class="input"
							type="text"
							placeholder="e.g. GRANDCHILD"
							bind:value={survey.relationshipOther}
						/>
					</label>
				{/if}
			{/if}
			<label class="label">
				<span>Civil Status</span>
				<select class="select" bind:value={survey.civilStatus}>
					<option value="">Not answered</option>
					{#each CIVIL_STATUS_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
				</select>
			</label>
			<label class="label">
				<span>Educational Attainment</span>
				<select class="select" bind:value={survey.educationalAttainment}>
					<option value="">Not answered</option>
					{#each EDUCATIONAL_OPTIONS as o}<option value={o.value}>{o.value} — {o.label}</option>{/each}
				</select>
			</label>
			<label class="label">
				<span>PhilHealth</span>
				<select class="select" bind:value={survey.philhealth}>
					<option value="">Not answered</option>
					{#each YES_NO_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
				</select>
			</label>
			{#if survey.philhealth === 'YES'}
				<label class="label">
					<span>PhilHealth Membership Type</span>
					<select class="select" bind:value={survey.philhealthMembershipType}>
						<option value="">Not answered</option>
						{#each MEMBERSHIP_TYPE_OPTIONS as o}<option value={o.value}>{o.value} — {o.label}</option>{/each}
					</select>
				</label>
			{/if}
			<label class="label">
				<span>Religion</span>
				<input class="input" type="text" placeholder="Religion" bind:value={survey.religion} />
			</label>
			<label class="label">
				<span>Length of Stay</span>
				<input
					class="input"
					type="text"
					placeholder="e.g. 10 years"
					bind:value={survey.lengthOfStay}
				/>
			</label>
		</div>

		<div class="label">
			<span>Category <span class="opacity-60">(check all that apply)</span></span>
			<div class="flex flex-wrap gap-4 mt-1">
				{#each CATEGORY_OPTIONS as o}
					<label class="flex items-center gap-2">
						<input class="checkbox" type="checkbox" value={o.value} bind:group={survey.categories} />
						<span>{o.label}</span>
					</label>
				{/each}
			</div>
		</div>

		<!-- Occupation / Source of Income -->
		<h5 class="h5 opacity-70 mt-2">Occupation / Source of Income</h5>
		<div class="flex flex-wrap gap-4">
			<label class="flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={survey.occupationEmployment} />
				<span>Employment</span>
			</label>
			<label class="flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={survey.occupationFarming} />
				<span>Farming</span>
			</label>
			<label class="flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={survey.occupationFishing} />
				<span>Fishing</span>
			</label>
			<label class="flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={survey.occupationVending} />
				<span>Vending</span>
			</label>
			<label class="flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={survey.occupationToda} />
				<span>TODA</span>
			</label>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
			<label class="label">
				<span>Other Occupation</span>
				<input
					class="input"
					type="text"
					placeholder="Other type of occupation"
					bind:value={survey.occupationOther}
				/>
			</label>
			<label class="label">
				<span>Average Income (₱)</span>
				<input
					class="input"
					type="number"
					min="0"
					step="any"
					placeholder="e.g. 8000"
					bind:value={survey.averageIncome}
				/>
			</label>
		</div>

		<!-- Housing / Living Condition -->
		<h5 class="h5 opacity-70 mt-2">Housing / Living Condition</h5>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-2">
			<label class="label">
				<span>Type of Housing</span>
				<select class="select" bind:value={survey.housingType}>
					<option value="">Not answered</option>
					{#each HOUSING_TYPE_OPTIONS as o}<option value={o.value}>{o.value} — {o.label}</option>{/each}
				</select>
			</label>
			<label class="label">
				<span>Housing Materials</span>
				<select class="select" bind:value={survey.housingMaterials}>
					<option value="">Not answered</option>
					{#each HOUSING_MATERIALS_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
				</select>
			</label>
			<label class="label">
				<span>Land Ownership</span>
				<select class="select" bind:value={survey.landOwnership}>
					<option value="">Not answered</option>
					{#each LAND_OWNERSHIP_OPTIONS as o}<option value={o.value}>{o.value} — {o.label}</option>{/each}
				</select>
			</label>
		</div>

		<label class="label md:w-1/2">
			<span>Interviewed By</span>
			<input
				class="input"
				type="text"
				placeholder="Name of interviewer"
				bind:value={survey.interviewedBy}
			/>
		</label>
	</details>
</div>
