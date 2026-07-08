<script lang="ts">
	export let title: string;
	/** Fixed series order — colors follow the series, never the rank. */
	export let series: { key: string; label: string; color: string }[];
	/** One row per category; values keyed by series key. */
	export let rows: { label: string; values: Record<string, number> }[];

	$: maxTotal = Math.max(
		1,
		...rows.map((r) => series.reduce((s, sr) => s + (r.values[sr.key] || 0), 0))
	);

	const rowTotal = (r: { values: Record<string, number> }) =>
		series.reduce((s, sr) => s + (r.values[sr.key] || 0), 0);

	// Lightweight hover tooltip (per-mark).
	let tooltip: { x: number; y: number; text: string } | null = null;
	let container: HTMLDivElement;

	const showTip = (e: MouseEvent, row: string, label: string, value: number, total: number) => {
		const rect = container.getBoundingClientRect();
		const pct = total ? Math.round((value / total) * 100) : 0;
		tooltip = {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top - 8,
			text: `${row} — ${label}: ${value.toLocaleString()} (${pct}%)`
		};
	};
	const hideTip = () => (tooltip = null);
</script>

<div class="card p-4">
	<header class="flex flex-wrap items-center justify-between gap-2 mb-3">
		<h2 class="h5 font-semibold">{title}</h2>
		<!-- Legend: colored chip + ink text (identity never via color alone) -->
		<div class="flex flex-wrap items-center gap-3 text-xs opacity-80">
			{#each series as s (s.key)}
				<span class="flex items-center gap-1.5">
					<span class="inline-block w-3 h-3 rounded-sm" style="background: {s.color};"></span>
					{s.label}
				</span>
			{/each}
		</div>
	</header>

	<div class="relative space-y-2" bind:this={container} on:mouseleave={hideTip} role="img" aria-label={title}>
		{#each rows as row (row.label)}
			{@const total = rowTotal(row)}
			<div class="flex items-center gap-2">
				<span class="w-32 shrink-0 text-xs opacity-70 truncate text-right" title={row.label}>
					{row.label}
				</span>
				<!-- 2px gaps between segments come from the flex gap (surface shows through) -->
				<div class="flex-1 flex items-center gap-[2px] h-[18px]">
					{#each series as s (s.key)}
						{@const v = row.values[s.key] || 0}
						{#if v > 0}
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div
								class="h-full first:rounded-l last:rounded-r flex items-center justify-center overflow-hidden"
								style="width: {(v / maxTotal) * 100}%; background: {s.color}; min-width: 3px;"
								on:mouseenter={(e) => showTip(e, row.label, s.label, v, total)}
								on:mousemove={(e) => showTip(e, row.label, s.label, v, total)}
							>
								<!-- Selective direct label: only when the segment is wide enough -->
								{#if v / maxTotal > 0.08}
									<span class="text-[10px] font-semibold text-white/95 px-1">{v}</span>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
				<span class="w-10 shrink-0 text-xs opacity-60 tabular-nums">{total}</span>
			</div>
		{/each}

		{#if tooltip}
			<div
				class="absolute z-10 pointer-events-none px-2 py-1 rounded text-xs bg-surface-900 text-white shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-full"
				style="left: {tooltip.x}px; top: {tooltip.y}px;"
			>
				{tooltip.text}
			</div>
		{/if}
	</div>

	<!-- Accessible table view of the same data -->
	<details class="mt-3 text-xs opacity-80">
		<summary class="cursor-pointer select-none opacity-70">View as table</summary>
		<table class="table table-compact mt-2">
			<thead>
				<tr>
					<th></th>
					{#each series as s (s.key)}<th>{s.label}</th>{/each}
					<th>Total</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.label)}
					<tr>
						<td>{row.label}</td>
						{#each series as s (s.key)}<td>{row.values[s.key] || 0}</td>{/each}
						<td>{rowTotal(row)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
</div>
