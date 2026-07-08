<script lang="ts">
	export let title: string;
	/** Time-ordered points. */
	export let points: { label: string; count: number }[] = [];
	/** Single-series color (validated for the dark surface). */
	export let color = '#3B82F6';
	/** Y-axis unit for the tooltip, e.g. "awards". */
	export let unit = '';

	let width = 0; // bound to container width → crisp pixel-space rendering
	const height = 200;
	const pad = { top: 12, right: 12, bottom: 24, left: 34 };

	$: innerW = Math.max(0, width - pad.left - pad.right);
	$: innerH = height - pad.top - pad.bottom;
	$: maxY = Math.max(1, ...points.map((p) => p.count));
	// Round the axis top up to a friendly number.
	$: yTop = Math.max(4, Math.ceil(maxY / 4) * 4);
	$: xAt = (i: number) =>
		pad.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
	$: yAt = (v: number) => pad.top + innerH - (v / yTop) * innerH;
	$: linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.count)}`).join(' ');
	$: areaPath =
		points.length > 0
			? `${linePath} L${xAt(points.length - 1)},${yAt(0)} L${xAt(0)},${yAt(0)} Z`
			: '';
	$: gridLines = [0.25, 0.5, 0.75, 1].map((f) => ({
		y: yAt(yTop * f),
		value: Math.round(yTop * f)
	}));

	// Hover: nearest point crosshair + tooltip.
	let hover: number | null = null;
	const onMove = (e: MouseEvent) => {
		if (points.length === 0 || innerW <= 0) return;
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const x = e.clientX - rect.left - pad.left;
		hover = Math.max(
			0,
			Math.min(points.length - 1, Math.round((x / innerW) * (points.length - 1)))
		);
	};
	$: total = points.reduce((s, p) => s + p.count, 0);
</script>

<div class="card p-4">
	<header class="flex items-center justify-between mb-1">
		<h2 class="h5 font-semibold">{title}</h2>
		<span class="text-xs opacity-60">{total.toLocaleString()} in the last 12 months</span>
	</header>

	<div bind:clientWidth={width} class="w-full">
		{#if width > 0}
			<!-- svelte-ignore a11y-no-static-element-interactions a11y-mouse-events-have-key-events -->
			<svg
				{width}
				{height}
				role="img"
				aria-label={title}
				on:mousemove={onMove}
				on:mouseleave={() => (hover = null)}
			>
				<!-- Recessive grid + muted axis labels -->
				{#each gridLines as g}
					<line
						x1={pad.left}
						x2={width - pad.right}
						y1={g.y}
						y2={g.y}
						stroke="currentColor"
						stroke-opacity="0.08"
					/>
					<text
						x={pad.left - 6}
						y={g.y + 3}
						text-anchor="end"
						font-size="10"
						fill="currentColor"
						opacity="0.5">{g.value}</text
					>
				{/each}
				<line
					x1={pad.left}
					x2={width - pad.right}
					y1={yAt(0)}
					y2={yAt(0)}
					stroke="currentColor"
					stroke-opacity="0.2"
				/>

				<!-- Area + 2px line -->
				<path d={areaPath} fill={color} fill-opacity="0.15" />
				<path d={linePath} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" />

				<!-- X labels: thin out when crowded -->
				{#each points as p, i}
					{#if points.length <= 6 || i % 2 === 0}
						<text
							x={xAt(i)}
							y={height - 6}
							text-anchor="middle"
							font-size="10"
							fill="currentColor"
							opacity="0.5">{p.label}</text
						>
					{/if}
				{/each}

				<!-- Crosshair + hovered marker -->
				{#if hover !== null && points[hover]}
					<line
						x1={xAt(hover)}
						x2={xAt(hover)}
						y1={pad.top}
						y2={yAt(0)}
						stroke="currentColor"
						stroke-opacity="0.2"
						stroke-dasharray="3 3"
					/>
					<circle
						cx={xAt(hover)}
						cy={yAt(points[hover].count)}
						r="4"
						fill={color}
						stroke="#1f2937"
						stroke-width="2"
					/>
				{/if}
			</svg>
		{/if}
	</div>

	{#if hover !== null && points[hover]}
		<p class="text-xs opacity-80 -mt-1">
			<strong>{points[hover].label}</strong>: {points[hover].count.toLocaleString()}
			{unit}
		</p>
	{:else}
		<p class="text-xs opacity-40 -mt-1">Hover the chart for monthly values</p>
	{/if}

	<!-- Accessible table view of the same data -->
	<details class="mt-2 text-xs opacity-80">
		<summary class="cursor-pointer select-none opacity-70">View as table</summary>
		<table class="table table-compact mt-2">
			<thead>
				<tr><th>Month</th><th>{unit || 'Count'}</th></tr>
			</thead>
			<tbody>
				{#each points as p (p.label + p.count)}
					<tr><td>{p.label}</td><td>{p.count}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>
</div>
