<script lang="ts">
	import { onMount } from 'svelte';
	import { focusTrap, type DrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import { showToast } from '$lib/utils/toastHelper';
	import { submitJson } from '$lib/utils/apiHelper';
	import { id } from '$lib/common/utils';
	import { emptySurvey } from '$lib/utils/householdOptions';
	import { toDateInputValue } from '$lib/utils/dateInput';
	import { psgcCodesForName } from '$lib/utils/psgc';
	import type {
		Barangay,
		Dependents,
		GrantAwardInput,
		Household,
		MappingHeadRow
	} from '$lib/utils/types';
	import MappingMembersTable from './MappingMembersTable.svelte';
	import ServicesAvailedFields from './ServicesAvailedFields.svelte';

	export let drawerStore: DrawerStore;
	/** The household record to fill in, or null to create one from the sheet. */
	export let data: Household | null = null;
	/** Barangays the user may create in (create mode only; already cluster-scoped by the page). */
	export let barangays: Barangay[] = [];
	export let barangayName = '';
	/** Called after a successful save so the page can refresh. */
	export let onSuccess: (() => void) | undefined = undefined;

	const toastStore = getToastStore();
	const isFocused = true;
	const isCreate = data === null;
	let isSubmitting = false;

	// --- Where (create mode) ---------------------------------------------------
	let barangayId = data?.barangayId ?? barangays[0]?._id ?? '';
	$: selectedBarangay = barangays.find((b) => b._id === barangayId);
	// Household code: <barangayCode>-<number>, the prefix from the barangay's PSGC code.
	let householdNumber = '';
	$: barangayCodePrefix = isCreate
		? selectedBarangay?.barangayCode || psgcCodesForName(selectedBarangay?.name).barangayCode || ''
		: '';
	$: householdCode =
		barangayCodePrefix && householdNumber.trim()
			? `${barangayCodePrefix}-${householdNumber.trim()}`
			: '';

	// --- Row 1: the head ---------------------------------------------------------
	let head: MappingHeadRow = {
		firstName: data?.firstName ?? '',
		middleName: data?.middleName ?? '',
		lastName: data?.lastName ?? '',
		gender: data?.gender || 'MALE',
		dateOfBirth: toDateInputValue(data?.dateOfBirth),
		categories: [...(data?.categories ?? [])],
		remarks: data?.remarks ?? ''
	};
	// Rows 2+ — full member objects, so whatever the encoder entered round-trips.
	let members: Dependents[] = (data?.dependentDetails ?? []).map((d) => ({
		...emptySurvey(),
		remarks: '',
		...d,
		_id: d._id || id(),
		dateOfBirth: toDateInputValue(d.dateOfBirth)
	}));
	// Services Availed → grant awards (ServicesAvailedFields seeds these from data.grants).
	let grants: GrantAwardInput[] = [];
	let otherServicesAvailed = data?.otherServicesAvailed ?? '';

	// --- Existing household records in the barangay (member linking + duplicate warning)
	let linkableHouseholds: Household[] = [];
	let loadedForBarangay = '';
	const fetchLinkable = async (forBarangay: string) => {
		if (!forBarangay || forBarangay === loadedForBarangay) return;
		loadedForBarangay = forBarangay;
		try {
			const response = await fetch(`/api/admin/household/list/${forBarangay}`);
			if (!response.ok) throw new Error(`Could not load households (${response.status})`);
			const result = await response.json();
			linkableHouseholds = (result.response || []).filter((h: Household) => h._id !== data?._id);
		} catch (error) {
			linkableHouseholds = [];
			console.error(error);
		}
	};
	onMount(() => fetchLinkable(barangayId));
	$: if (isCreate) fetchLinkable(barangayId);

	// Warn (don't block) when the same head-of-family name already exists in the
	// barangay — likely a re-entry. The tagger confirms to add anyway.
	const sameName = (a?: string | null, b?: string | null) =>
		(a || '').trim().toUpperCase() === (b || '').trim().toUpperCase();
	let ackDuplicate = false;
	$: dupMatches =
		isCreate && head.firstName.trim() && head.lastName.trim()
			? linkableHouseholds.filter(
					(h) => sameName(h.firstName, head.firstName) && sameName(h.lastName, head.lastName)
				)
			: [];

	const handleSubmit = async () => {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const sheet = {
				gender: head.gender,
				dateOfBirth: head.dateOfBirth || null,
				categories: head.categories,
				remarks: head.remarks,
				dependentDetails: members,
				grants,
				otherServicesAvailed
			};
			const result = isCreate
				? await submitJson('/api/admin/household/mapping/create', {
						...sheet,
						barangayId,
						householdCode,
						firstName: head.firstName,
						middleName: head.middleName,
						lastName: head.lastName
					})
				: await submitJson('/api/admin/household/mapping', {
						...sheet,
						_id: data?._id,
						// Optimistic concurrency token — the version we loaded. Passed raw: it is
						// a Date on the client and JSON keeps the milliseconds the server matches.
						expectedUpdatedAt: data?.updatedAt
					});
			onSuccess?.();
			showToast(toastStore, result.message, true);
			drawerStore.close();
		} catch (error) {
			showToast(toastStore, error instanceof Error ? error.message : 'Failed to save', false);
			console.error(error);
		} finally {
			isSubmitting = false;
		}
	};
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6 space-y-4"
	use:focusTrap={isFocused}
	on:submit|preventDefault={handleSubmit}
>
	<div>
		<h2 class="h3 mb-1">Household Mapping{isCreate ? ' — New Household' : ''}</h2>
		{#if data}
			<p class="text-sm">
				<strong>{data.fullName || `${head.firstName} ${head.lastName}`.trim()}</strong>
				{#if data.householdCode}
					· <span class="font-mono">{data.householdCode}</span>
				{/if}
				{#if barangayName}
					· {barangayName}
				{/if}
			</p>
		{/if}
		<p class="text-sm opacity-60">
			Copy the sheet: the members table, then the services this household has availed.
		</p>
	</div>

	{#if isCreate}
		<section class="card p-4 space-y-3">
			<h3 class="h4">Barangay</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<label class="label">
					<span>Barangay</span>
					<select class="select" bind:value={barangayId} required>
						{#each barangays as barangay (barangay._id)}
							<option value={barangay._id}>{barangay.name}</option>
						{/each}
					</select>
				</label>
				<label class="label">
					<span>Household Code <span class="opacity-60">(optional)</span></span>
					<div class="input-group input-group-divider grid-cols-[auto_1fr]">
						<div class="input-group-shim font-mono">
							{barangayCodePrefix ? `${barangayCodePrefix}-` : '—'}
						</div>
						<input
							type="text"
							inputmode="numeric"
							placeholder="e.g. 05"
							bind:value={householdNumber}
							disabled={!barangayCodePrefix}
						/>
					</div>
				</label>
			</div>
			<p class="text-xs opacity-60">
				The map pin starts at the barangay's location; an encoder can move it to the house later.
			</p>
		</section>
	{/if}

	<section class="card p-4">
		<MappingMembersTable
			bind:head
			headNamesEditable={isCreate}
			bind:members
			households={linkableHouseholds}
		/>
	</section>

	<section class="card p-4">
		<ServicesAvailedFields bind:grants bind:otherServicesAvailed existing={data?.grants || []} />
	</section>

	<!-- Possible-duplicate warning: same head-of-family name in this barangay. -->
	{#if dupMatches.length > 0}
		<div class="card variant-soft-warning p-4 space-y-2">
			<p class="font-semibold">⚠️ Possible duplicate</p>
			<p class="text-sm">
				{dupMatches.length} household{dupMatches.length > 1 ? 's' : ''} in this barangay already have
				this head-of-family name:
			</p>
			<ul class="list-disc list-inside text-sm">
				{#each dupMatches.slice(0, 5) as h (h._id)}
					<li>
						<a class="anchor" href="/dashboard/households/{h._id}" target="_blank" rel="noopener">
							{h.fullName || `${h.firstName} ${h.lastName}`.trim()}
						</a>
					</li>
				{/each}
			</ul>
			<label class="flex items-center gap-2">
				<input class="checkbox" type="checkbox" bind:checked={ackDuplicate} />
				<span>This is a different family — add anyway.</span>
			</label>
		</div>
	{/if}

	<div class="flex justify-end gap-3 pt-2">
		<button type="button" class="btn variant-soft" on:click={() => drawerStore.close()}>
			Cancel
		</button>
		<button
			type="submit"
			class="btn variant-filled-success"
			disabled={isSubmitting || (dupMatches.length > 0 && !ackDuplicate)}
		>
			{isSubmitting ? 'Saving...' : isCreate ? 'Save Household' : 'Save Mapping'}
		</button>
	</div>
</form>
