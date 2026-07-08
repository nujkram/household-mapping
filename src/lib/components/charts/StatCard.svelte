<script lang="ts">
	/** Small muted heading above the number. */
	export let label: string;
	/** The hero number (pre-formatted string or number). */
	export let value: string | number;
	/** Optional muted line under the number, e.g. "62% of households". */
	export let sub = '';
	/** Optional 0–100 progress meter under the text. */
	export let meterPct: number | null = null;
	/** Meter fill color (validated chart color). */
	export let accent = '#3B82F6';
</script>

<div class="card p-4 flex flex-col gap-1">
	<p class="text-sm opacity-60">{label}</p>
	<p class="text-3xl font-bold leading-tight">{value}</p>
	{#if sub}
		<p class="text-xs opacity-60">{sub}</p>
	{/if}
	{#if meterPct !== null}
		<div
			class="mt-2 h-1.5 rounded-full bg-surface-500/30 overflow-hidden"
			role="meter"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={Math.round(meterPct)}
			aria-label="{label}: {Math.round(meterPct)}%"
		>
			<div
				class="h-full rounded-full"
				style="width: {Math.max(0, Math.min(100, meterPct))}%; background: {accent};"
			></div>
		</div>
	{/if}
</div>
