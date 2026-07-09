<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { debounce } from '$lib/utils/debounce';
	import { CLUSTER_OPTIONS } from '$lib/utils/clusters';

	export let data;

	$: grant = data.grant as any;
	$: recipients = (data.recipients as any[]) || [];

	// URL-driven filters (the Excel export reuses the same params, so the file
	// always matches the table).
	let searchInput = data.q;
	let selectedBarangay = data.barangay;
	let selectedCluster = data.cluster;

	const applyFilters = () => {
		const params = new URLSearchParams();
		if (searchInput.trim()) params.set('q', searchInput.trim());
		if (selectedCluster) params.set('cluster', selectedCluster);
		if (selectedBarangay) params.set('barangay', selectedBarangay);
		goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	};
	const debouncedSearch = debounce(() => applyFilters(), 300);

	$: exportUrl = `/api/admin/grant/${grant._id}/export?${$page.url.searchParams.toString()}`;

	const formatDate = (value: string | Date | null | undefined): string => {
		if (!value) return '—';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
	};

	const today = new Date().toLocaleDateString();
</script>

<svelte:head>
	<title>{grant.name} ({grant.year}) — Recipients</title>
</svelte:head>

<div class="container mx-auto p-4">
	<div class="card p-4" id="print-area">
		<!-- Report header -->
		<header class="mb-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 class="h2">{grant.name} ({grant.year})</h1>
					<p class="opacity-70 mt-1">
						Grant Recipients Report · Released {formatDate(grant.releasedDate)} ·
						{recipients.length} recipient{recipients.length === 1 ? '' : 's'}
					</p>
					<p class="text-sm opacity-50">
						Generated {today}{data.generatedBy ? ` by ${data.generatedBy}` : ''}
					</p>
				</div>
				<div class="flex flex-wrap gap-2 no-print">
					<button class="btn variant-filled-primary" on:click={() => window.print()}>
						🖨 Print
					</button>
					<a class="btn variant-filled-success" href={exportUrl}> ⬇ Export to Excel </a>
					<a class="btn variant-soft" href="/dashboard/grants">Back to Grants</a>
				</div>
			</div>
		</header>

		<!-- Filters (hidden in print) -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 no-print">
			<div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
				<div class="input-group-shim" aria-hidden="true">🔍</div>
				<input
					type="search"
					placeholder="Search by name..."
					bind:value={searchInput}
					on:input={debouncedSearch}
					class="input"
				/>
			</div>
			<select bind:value={selectedCluster} on:change={applyFilters} class="select">
				<option value="">All Clusters</option>
				{#each CLUSTER_OPTIONS as c}
					<option value={c.value}>{c.label}</option>
				{/each}
			</select>
			<select bind:value={selectedBarangay} on:change={applyFilters} class="select">
				<option value="">All Barangays</option>
				{#each data.barangays as b}
					<option value={b._id}>{b.name}</option>
				{/each}
			</select>
		</div>

		<!-- Recipients table -->
		<div class="table-container">
			<table class="table table-hover report-table">
				<thead>
					<tr>
						<th class="w-10">#</th>
						<th>Full Name</th>
						<th>Barangay</th>
						<th>Cluster</th>
						<th>Date Received</th>
						<th>Recorded By</th>
						<th class="print-only signature-col">Signature</th>
					</tr>
				</thead>
				<tbody>
					{#if recipients.length === 0}
						<tr>
							<td colspan="7" class="text-center py-8 opacity-60">
								No recipients match the current filters.
							</td>
						</tr>
					{/if}
					{#each recipients as r, i (r._id)}
						<tr>
							<td>{i + 1}</td>
							<td>
								<a class="anchor no-print-link" href="/dashboard/households/{r._id}">
									{r.fullName}
								</a>
							</td>
							<td>{r.barangayName}</td>
							<td>{r.cluster}</td>
							<td>{formatDate(r.receivedAt)}</td>
							<td>{r.grantedByName || '—'}</td>
							<td class="print-only signature-col"></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Print-only signature blocks -->
		<div class="print-only mt-12 grid grid-cols-2 gap-16">
			<div>
				<div class="border-t border-current pt-1 mt-8 w-64">Prepared by</div>
			</div>
			<div>
				<div class="border-t border-current pt-1 mt-8 w-64">Noted by</div>
			</div>
		</div>
	</div>
</div>

<style>
	.print-only {
		display: none;
	}

	@media print {
		/* Show ONLY the report: hide everything, then re-show the print area. */
		:global(body *) {
			visibility: hidden;
		}
		:global(#print-area),
		:global(#print-area *) {
			visibility: visible;
		}
		:global(#print-area) {
			position: absolute;
			inset: 0 auto auto 0;
			width: 100%;
			box-shadow: none;
			border: none;
		}
		.no-print {
			display: none !important;
		}
		.print-only {
			display: block;
		}
		td.print-only,
		th.print-only {
			display: table-cell;
		}
		.signature-col {
			min-width: 120px;
		}
		.report-table :global(td),
		.report-table :global(th) {
			padding: 4px 8px;
			font-size: 11px;
			color: black !important;
		}
		:global(#print-area) {
			background: white !important;
			color: black !important;
		}
		.no-print-link {
			color: black !important;
			text-decoration: none !important;
		}
	}
</style>
