<script lang="ts">
	import { onMount } from 'svelte';
	import type { Grant, GrantAwardInput, HouseholdGrant } from '$lib/utils/types';
	import { toDateInputValue } from '$lib/utils/dateInput';

	/** Ticked services, saved as grant awards (bind from the parent form). */
	export let grants: GrantAwardInput[] = [];
	/**
	 * Awards already on the record (Update form). Prefilled as ticked, and kept
	 * in the list even if their grant was deactivated since, so a save never
	 * silently drops them.
	 */
	export let existing: HouseholdGrant[] = [];
	/** Paper form "OTHERS — specify" (bind from the parent form). */
	export let otherServicesAvailed = '';

	type Row = {
		grantId: string;
		name: string;
		year: number;
		isActive: boolean;
		checked: boolean;
		dateAvailed: string;
	};

	// Start from the record's own awards so an immediate save keeps them; the
	// catalog fills in the rest once loaded.
	let rows: Row[] = existing.map((g) => ({
		grantId: g.grantId,
		name: g.name,
		year: g.year,
		isActive: true,
		checked: true,
		dateAvailed: toDateInputValue(g.receivedAt)
	}));
	let isLoading = true;
	let loadError = '';

	onMount(async () => {
		try {
			const response = await fetch('/api/admin/grant/options');
			if (!response.ok) throw new Error(`Could not load the grants list (${response.status})`);
			const catalog: Grant[] = (await response.json()).response || [];
			const prior = new Map(rows.map((r) => [r.grantId, r]));
			const inCatalog = new Set(catalog.map((g) => g._id));
			rows = [
				...catalog.map((g) => {
					const p = prior.get(g._id);
					return {
						grantId: g._id,
						name: g.name,
						year: g.year,
						isActive: true,
						checked: Boolean(p),
						dateAvailed: p?.dateAvailed ?? ''
					};
				}),
				// Awards whose grant is no longer active: still shown (and kept).
				...rows.filter((r) => !inCatalog.has(r.grantId)).map((r) => ({ ...r, isActive: false }))
			];
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Could not load the grants list';
			console.error(error);
		} finally {
			isLoading = false;
		}
	});

	// Unticking also clears the date, like erasing the paper row.
	const setAvailed = (index: number, on: boolean) => {
		rows[index] = { ...rows[index], checked: on, dateAvailed: on ? rows[index].dateAvailed : '' };
	};

	// Only ticked rows are saved; an unticked row means NO.
	$: grants = rows
		.filter((r) => r.checked)
		.map((r) => ({ grantId: r.grantId, receivedAt: r.dateAvailed || null }));
</script>

<div class="col-span-2 space-y-3">
	<div>
		<h3 class="h4">Services Availed</h3>
		<p class="text-sm opacity-60">
			Tick each service this household has availed and add the date if known. The list is the
			<strong>Grants</strong> catalog — every tick is saved as a grant received, and unticking removes
			it.
		</p>
	</div>

	{#if isLoading && rows.length === 0}
		<div class="placeholder animate-pulse h-10"></div>
	{:else if rows.length === 0}
		{#if loadError}
			<p class="text-sm text-error-500">{loadError}</p>
		{:else}
			<p class="text-sm opacity-60">No active grants yet — add the services under Grants first.</p>
		{/if}
	{:else}
		{#if loadError}
			<p class="text-sm text-error-500">{loadError}</p>
		{/if}
		<div class="table-container">
			<table class="table table-compact">
				<thead>
					<tr>
						<th>Service / Grant</th>
						<th class="w-24 text-center">Availed?</th>
						<th class="min-w-[10rem]">If yes, date availed</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, index (row.grantId)}
						<tr>
							<td class="align-middle">
								{row.name} <span class="opacity-60">({row.year})</span>
								{#if !row.isActive}
									<span class="badge variant-soft ml-1">inactive</span>
								{/if}
							</td>
							<td class="text-center align-middle">
								<input
									class="checkbox"
									type="checkbox"
									aria-label="{row.name} availed"
									checked={row.checked}
									on:change={(e) => setAvailed(index, e.currentTarget.checked)}
								/>
							</td>
							<td>
								<input
									class="input"
									type="date"
									bind:value={row.dateAvailed}
									disabled={!row.checked}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<label class="label">
		<span>Others <span class="opacity-60">(specify)</span></span>
		<input
			class="input"
			type="text"
			placeholder="Other services availed, e.g. FEEDING PROGRAM"
			bind:value={otherServicesAvailed}
		/>
	</label>
</div>
